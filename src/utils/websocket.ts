/**
 * WebSocket 工具类
 * 支持商家端（新订单通知）和管理端（告警通知）实时消息
 *
 * 商家端：ws://host/ws/merchant/orders?token=xxx
 * 管理端：ws://host/ws/admin/notifications?token=xxx
 */
import { getToken } from './storage'
import { ElNotification } from 'element-plus'
import { playNewOrderSound, playAlertSound } from './sound'
import type { UserType } from './constants'

export interface WSMessage {
  type: string
  orderId?: number | string
  orderNo?: string
  merchantId?: number | string
  amount?: number
  payType?: number
  payTime?: string
  content?: string
  timestamp?: number
  /** 告警级别：info/warning/urgent（前端规范化后） */
  level?: 'info' | 'warning' | 'urgent'
  /** 后端原始告警级别：INFO/WARN/ERROR */
  alertLevel?: string
  /** 告警标题 */
  title?: string
  /** 告警分类：order_timeout/complaint/refund/system/risk */
  category?: string
  /** 关联ID（如订单ID） */
  refId?: number | string
  /** 是否已读 */
  read?: boolean
  /** 告警时间 */
  alertTime?: string
  /** 消息唯一ID */
  msgId?: string
  /** 目标管理员ID */
  toAdminId?: number
  /** 事件时间 */
  eventTime?: string
}

type MessageHandler = (msg: WSMessage) => void

/**
 * 单个用户类型的WebSocket连接管理
 */
class SingleWebSocketService {
  private ws: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private reconnectCount = 0
  private maxReconnectCount = 10
  /** 基础重连间隔（毫秒），实际延迟为指数退避 + 抖动 */
  private baseReconnectInterval = 1000
  private heartbeatInterval = 30000
  /** pong 超时定时器：发送 ping 后启动，收到 pong 时清除；超时则主动断开重连 */
  private pongTimeoutTimer: ReturnType<typeof setTimeout> | null = null
  /** pong 超时时间（毫秒）：超过此时间未收到 pong 视为半开连接 */
  private pongTimeoutMs = 10000
  private handlers: Map<string, Set<MessageHandler>> = new Map()
  private connected = false
  private manuallyClosed = false
  private authFailed = false
  private endpoint: string
  private userType: UserType
  /** 防重复播报：已播报过的订单号集合 */
  private notifiedOrderNos: Set<string> = new Set()
  /** notifiedOrderNos 最大容量，超过则清空避免内存泄漏 */
  private static readonly MAX_NOTIFIED_KEYS = 200

  constructor(userType: UserType, endpoint: string) {
    this.userType = userType
    this.endpoint = endpoint
  }

  /**
   * 连接WebSocket
   */
  connect() {
    const token = getToken()
    if (!token) {
      console.warn(`[WebSocket:${this.userType}] 无token，跳过连接`)
      return
    }

    if (this.authFailed) {
      return
    }

    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return
    }

    this.manuallyClosed = false
    this.cleanup()

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = import.meta.env.VITE_WS_HOST || window.location.host
    const url = `${protocol}//${host}${this.endpoint}?token=${token}`

    console.log(`[WebSocket:${this.userType}] 正在连接:`, url)

    try {
      this.ws = new WebSocket(url)

      this.ws.onopen = () => {
        console.log(`[WebSocket:${this.userType}] 连接成功`)
        this.connected = true
        this.reconnectCount = 0
        this.authFailed = false
        this.startHeartbeat()
      }

      this.ws.onmessage = (event) => {
        // 收到 pong：清除超时定时器，连接健康
        if (event.data === 'pong') {
          this.clearPongTimeout()
          return
        }
        try {
          const data: WSMessage = JSON.parse(event.data)
          console.log(`[WebSocket:${this.userType}] 收到消息:`, data)
          this.handleMessage(data)
        } catch (e) {
          console.warn(`[WebSocket:${this.userType}] 解析消息失败:`, event.data)
        }
      }

      this.ws.onerror = (error) => {
        console.error(`[WebSocket:${this.userType}] 连接错误:`, error)
      }

      this.ws.onclose = (event) => {
        console.log(`[WebSocket:${this.userType}] 连接关闭:`, event.code, event.reason)
        this.connected = false
        this.stopHeartbeat()

        if (event.code === 1008 || event.code === 1003) {
          console.warn(`[WebSocket:${this.userType}] 认证失败，停止自动重连`)
          this.authFailed = true
          return
        }

        if (!getToken()) {
          return
        }

        if (!this.manuallyClosed) {
          this.scheduleReconnect()
        }
      }
    } catch (e) {
      console.error(`[WebSocket:${this.userType}] 创建连接失败:`, e)
      this.scheduleReconnect()
    }
  }

  /**
   * 断开连接
   */
  disconnect() {
    this.manuallyClosed = true
    this.authFailed = false
    this.cleanup()
  }

  /**
   * 是否连接中
   */
  isConnected(): boolean {
    return this.connected
  }

  /**
   * 注册消息处理器
   */
  on(type: string, handler: MessageHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set())
    }
    this.handlers.get(type)!.add(handler)
    return () => this.off(type, handler)
  }

  /**
   * 移除消息处理器
   */
  off(type: string, handler: MessageHandler) {
    this.handlers.get(type)?.delete(handler)
  }

  /**
   * 发送消息
   */
  send(data: string | object) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn(`[WebSocket:${this.userType}] 连接未就绪，无法发送消息`)
      return
    }
    const message = typeof data === 'string' ? data : JSON.stringify(data)
    this.ws.send(message)
  }

  /**
   * 重置认证失败状态（重新登录后调用）
   */
  resetAuthFailed() {
    this.authFailed = false
  }

  private handleMessage(msg: WSMessage) {
    this.handlers.get('*')?.forEach((h) => h(msg))
    if (msg.type) {
      this.handlers.get(msg.type)?.forEach((h) => h(msg))

      // 默认处理：根据用户类型分发
      if (this.userType === 'merchant' && msg.type === 'NEW_ORDER') {
        this.handleNewOrder(msg)
      } else if (this.userType === 'merchant' && msg.type === 'MERCHANT_READY') {
        // 商家出餐通知：商家端自己操作的不需要通知自己，只派发给处理器刷新列表
        // 不播放声音、不弹通知
      } else if (this.userType === 'admin' && this.isAlertType(msg.type)) {
        // 管理端仅对告警类型消息弹出通知，其他消息只派发给处理器
        this.handleAdminAlert(msg)
      }
    }
  }

  /**
   * 判断是否为告警类型消息（需要弹窗+声音提醒）
   */
  private isAlertType(type?: string): boolean {
    if (!type) return false
    const upper = type.toUpperCase()
    return upper === 'ADMIN_ALERT'
      || upper.includes('TIMEOUT')
      || upper.includes('ALERT')
      || upper.includes('COMPLAINT')
      || upper.includes('REFUND')
      || upper === 'NEW_COMPLAINT'
      || upper === 'REFUND_PENDING'
      || upper === 'RISK_ALERT'
      || upper === 'SYSTEM_ALERT'
  }

  /**
   * 处理商家端新订单通知（弹窗+声音），使用Set防重复播报
   */
  private handleNewOrder(msg: WSMessage) {
    const orderKey = msg.orderNo || String(msg.orderId || '')
    // 防重复：已播报过的订单不再重复播放声音和弹窗
    if (orderKey && this.notifiedOrderNos.has(orderKey)) {
      // 仍然通知ORDER_STATUS_CHANGED处理器以刷新列表
      this.handlers.get('ORDER_STATUS_CHANGED')?.forEach((h) => h(msg))
      return
    }
    if (orderKey) {
      // 容量保护：超过上限清空集合，避免长时间运行内存泄漏
      if (this.notifiedOrderNos.size >= SingleWebSocketService.MAX_NOTIFIED_KEYS) {
        this.notifiedOrderNos.clear()
      }
      this.notifiedOrderNos.add(orderKey)
    }

    try {
      playNewOrderSound(1)
    } catch (e) {
      console.warn(`[WebSocket:${this.userType}] 播放提示音失败:`, e)
    }

    ElNotification({
      title: '🔔 新订单提醒',
      message: msg.content || `您有新订单 ${msg.orderNo || ''}，金额 ¥${msg.amount?.toFixed(2) || '0.00'}`,
      type: 'warning',
      duration: 10000,
      position: 'top-right',
    })

    this.handlers.get('ORDER_STATUS_CHANGED')?.forEach((h) => h(msg))
  }

  /**
   * 处理管理端告警通知（弹窗+声音+添加到告警列表）
   * 后端字段映射：alertLevel (INFO/WARN/ERROR) -> level (info/warning/urgent)
   */
  private handleAdminAlert(rawMsg: WSMessage) {
    // 规范化消息：将后端的 alertLevel 映射为前端的 level
    const msg: WSMessage = { ...rawMsg }
    if (!msg.level && rawMsg.alertLevel) {
      const alertLevel = rawMsg.alertLevel.toUpperCase()
      if (alertLevel === 'ERROR') {
        msg.level = 'urgent'
      } else if (alertLevel === 'WARN') {
        msg.level = 'warning'
      } else {
        msg.level = 'info'
      }
    }
    if (!msg.level) {
      msg.level = 'warning'
    }

    // 推断告警分类（基于消息类型）
    if (!msg.category) {
      msg.category = this.inferCategory(msg.type)
    }

    const level = msg.level

    // 紧急告警播放提示音
    if (level === 'urgent') {
      try {
        playAlertSound()
      } catch (e) {
        console.warn('[WebSocket:admin] 播放告警音失败:', e)
      }
    }

    // 弹出通知
    const notifyType = level === 'urgent' ? 'error' : level === 'warning' ? 'warning' : 'info'
    ElNotification({
      title: msg.title || this.getAlertTitle(msg.type),
      message: msg.content || '您有一条新的系统告警',
      type: notifyType as 'error' | 'warning' | 'info',
      duration: level === 'urgent' ? 0 : 8000,
      position: 'top-right',
    })

    // 派发给告警列表处理器
    this.handlers.get('ADMIN_ALERT')?.forEach((h) => h(msg))
  }

  /**
   * 根据消息类型推断告警分类
   */
  private inferCategory(type?: string): string {
    if (!type) return 'system'
    const upper = type.toUpperCase()
    if (upper.includes('TIMEOUT') || upper.includes('DELIVERY')) return 'order_timeout'
    if (upper.includes('COMPLAINT') || upper.includes('REVIEW')) return 'complaint'
    if (upper.includes('REFUND')) return 'refund'
    if (upper.includes('RISK')) return 'risk'
    if (upper.includes('MERCHANT') && upper.includes('AUDIT')) return 'merchant_audit'
    if (upper.includes('RIDER') && upper.includes('AUDIT')) return 'rider_audit'
    return 'system'
  }

  private getAlertTitle(type: string): string {
    const titleMap: Record<string, string> = {
      ORDER_TIMEOUT: '订单超时告警',
      ORDER_DELIVERY_TIMEOUT: '配送超时告警',
      ORDER_MERCHANT_TIMEOUT: '商家接单超时',
      ADMIN_ALERT: '系统告警',
      NEW_COMPLAINT: '新投诉提醒',
      REFUND_PENDING: '退款待处理',
      SYSTEM_ALERT: '系统告警',
      RISK_ALERT: '风控告警',
      NEW_MERCHANT_AUDIT: '商家入驻审核',
      NEW_RIDER_AUDIT: '骑手审核',
    }
    return titleMap[type] || '系统通知'
  }

  private startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send('ping')
        // 发送 ping 后启动 pong 超时检测，超时则视为半开连接，主动断开重连
        this.schedulePongTimeout()
      }
    }, this.heartbeatInterval)
  }

  /**
   * 启动 pong 超时检测：在 pongTimeoutMs 内未收到 pong 则主动断开连接
   * 用于发现半开连接（TCP 已断但 onClose 未触发）
   */
  private schedulePongTimeout() {
    this.clearPongTimeout()
    this.pongTimeoutTimer = setTimeout(() => {
      console.warn(`[WebSocket:${this.userType}] pong 超时，连接可能半开，主动断开重连`)
      this.forceReconnect()
    }, this.pongTimeoutMs)
  }

  private clearPongTimeout() {
    if (this.pongTimeoutTimer) {
      clearTimeout(this.pongTimeoutTimer)
      this.pongTimeoutTimer = null
    }
  }

  /**
   * 强制断开并重连（用于半开连接场景）
   */
  private forceReconnect() {
    this.connected = false
    this.cleanup()
    this.scheduleReconnect()
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private scheduleReconnect() {
    if (this.reconnectCount >= this.maxReconnectCount) {
      console.warn(`[WebSocket:${this.userType}] 达到最大重连次数，停止重连`)
      return
    }
    if (this.reconnectTimer) return

    this.reconnectCount++
    // 指数退避：delay = base * 2^(n-1)，封顶 30s；叠加 ±20% 抖动避免雪崩
    const exponential = Math.min(this.baseReconnectInterval * Math.pow(2, this.reconnectCount - 1), 30000)
    const jitter = exponential * (0.8 + Math.random() * 0.4)
    const delay = Math.round(jitter)
    console.log(`[WebSocket:${this.userType}] ${delay / 1000}秒后尝试第${this.reconnectCount}次重连...`)

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.manuallyClosed = false
      this.connect()
    }, delay)
  }

  private cleanup() {
    this.stopHeartbeat()
    this.clearPongTimeout()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      try {
        this.ws.close()
      } catch (e) {
        // ignore
      }
      this.ws = null
    }
  }
}

/**
 * 统一WebSocket服务管理（支持商家端和管理端多连接）
 */
class WebSocketService {
  private merchantWs: SingleWebSocketService
  private adminWs: SingleWebSocketService

  constructor() {
    this.merchantWs = new SingleWebSocketService('merchant', '/ws/merchant/orders')
    this.adminWs = new SingleWebSocketService('admin', '/ws/admin/notifications')
  }

  /**
   * 根据用户类型连接对应的WebSocket
   */
  connectForUser(userType: UserType) {
    if (userType === 'merchant') {
      this.merchantWs.resetAuthFailed()
      this.merchantWs.connect()
    } else if (userType === 'admin') {
      this.adminWs.resetAuthFailed()
      this.adminWs.connect()
    }
  }

  /**
   * 断开所有连接
   */
  disconnectAll() {
    this.merchantWs.disconnect()
    this.adminWs.disconnect()
  }

  /**
   * 断开指定用户类型的连接
   */
  disconnect(userType?: UserType) {
    if (!userType) {
      this.disconnectAll()
      return
    }
    if (userType === 'merchant') {
      this.merchantWs.disconnect()
    } else if (userType === 'admin') {
      this.adminWs.disconnect()
    }
  }

  /**
   * 商家端WS服务（兼容旧API）
   */
  get merchant() {
    return this.merchantWs
  }

  /**
   * 管理端WS服务
   */
  get admin() {
    return this.adminWs
  }

  // ========== 兼容旧版API（商家端） ==========

  connect() {
    this.connectForUser('merchant')
  }

  isConnected(): boolean {
    return this.merchantWs.isConnected()
  }

  on(type: string, handler: MessageHandler) {
    return this.merchantWs.on(type, handler)
  }

  off(type: string, handler: MessageHandler) {
    this.merchantWs.off(type, handler)
  }

  send(data: string | object) {
    this.merchantWs.send(data)
  }

  /**
   * 注册管理端告警消息处理器
   */
  onAdminAlert(handler: MessageHandler) {
    return this.adminWs.on('ADMIN_ALERT', handler)
  }

  /**
   * 注册管理端任意消息处理器
   */
  onAdminMessage(type: string, handler: MessageHandler) {
    return this.adminWs.on(type, handler)
  }
}

export const wsService = new WebSocketService()
