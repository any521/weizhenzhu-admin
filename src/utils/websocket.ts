/**
 * WebSocket 工具类
 * 用于商家端实时接收新订单通知
 */
import { getToken } from './storage'
import { ElNotification } from 'element-plus'
import { playNewOrderSound } from './sound'

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
}

type MessageHandler = (msg: WSMessage) => void

class WebSocketService {
  private ws: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private reconnectCount = 0
  private maxReconnectCount = 10
  private reconnectInterval = 5000
  private heartbeatInterval = 30000
  private handlers: Map<string, Set<MessageHandler>> = new Map()
  private connected = false
  private manuallyClosed = false

  /**
   * 连接WebSocket
   */
  connect() {
    const token = getToken()
    if (!token) {
      console.warn('[WebSocket] 无token，跳过连接')
      return
    }

    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return
    }

    // 重置手动关闭标记（主动调用connect意味着期望连接）
    this.manuallyClosed = false

    // 清理旧连接
    this.cleanup()

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = import.meta.env.VITE_WS_HOST || window.location.host
    const url = `${protocol}//${host}/ws/merchant/orders?token=${token}`

    console.log('[WebSocket] 正在连接:', url)

    try {
      this.ws = new WebSocket(url)

      this.ws.onopen = () => {
        console.log('[WebSocket] 连接成功')
        this.connected = true
        this.reconnectCount = 0
        this.startHeartbeat()
      }

      this.ws.onmessage = (event) => {
        try {
          const data: WSMessage = JSON.parse(event.data)
          console.log('[WebSocket] 收到消息:', data)
          this.handleMessage(data)
        } catch (e) {
          // pong等非JSON消息
          if (event.data === 'pong') {
            // 心跳响应
          } else {
            console.warn('[WebSocket] 解析消息失败:', event.data)
          }
        }
      }

      this.ws.onerror = (error) => {
        console.error('[WebSocket] 连接错误:', error)
      }

      this.ws.onclose = (event) => {
        console.log('[WebSocket] 连接关闭:', event.code, event.reason)
        this.connected = false
        this.stopHeartbeat()

        // 非手动关闭且token存在时自动重连
        if (!this.manuallyClosed && getToken()) {
          this.scheduleReconnect()
        }
      }
    } catch (e) {
      console.error('[WebSocket] 创建连接失败:', e)
      this.scheduleReconnect()
    }
  }

  /**
   * 断开连接
   */
  disconnect() {
    this.manuallyClosed = true
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
      console.warn('[WebSocket] 连接未就绪，无法发送消息')
      return
    }
    const message = typeof data === 'string' ? data : JSON.stringify(data)
    this.ws.send(message)
  }

  private handleMessage(msg: WSMessage) {
    // 通知所有类型处理器
    this.handlers.get('*')?.forEach((h) => h(msg))
    // 通知特定类型处理器
    if (msg.type) {
      this.handlers.get(msg.type)?.forEach((h) => h(msg))

      // 默认处理新订单通知
      if (msg.type === 'NEW_ORDER') {
        this.handleNewOrder(msg)
      }
    }
  }

  /**
   * 处理新订单通知（弹窗+声音）
   */
  private handleNewOrder(msg: WSMessage) {
    try {
      playNewOrderSound()
    } catch (e) {
      console.warn('[WebSocket] 播放提示音失败:', e)
    }

    ElNotification({
      title: '🔔 新订单提醒',
      message: msg.content || `您有新订单 ${msg.orderNo || ''}，金额 ¥${msg.amount?.toFixed(2) || '0.00'}`,
      type: 'warning',
      duration: 10000,
      position: 'top-right',
    })
  }

  private startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send('ping')
      }
    }, this.heartbeatInterval)
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private scheduleReconnect() {
    if (this.reconnectCount >= this.maxReconnectCount) {
      console.warn('[WebSocket] 达到最大重连次数，停止重连')
      return
    }
    if (this.reconnectTimer) return

    this.reconnectCount++
    const delay = Math.min(this.reconnectInterval * this.reconnectCount, 30000)
    console.log(`[WebSocket] ${delay / 1000}秒后尝试第${this.reconnectCount}次重连...`)

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.manuallyClosed = false
      this.connect()
    }, delay)
  }

  private cleanup() {
    this.stopHeartbeat()
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

export const wsService = new WebSocketService()
