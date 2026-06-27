<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { Refresh, Bell, Mute } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '@/api'
import { wsService } from '@/utils/websocket'
import type { Order } from '@/api/types'
import { formatAmount, formatDate } from '@/utils/format'
import { OrderStatusMap, OrderStatusTagType, OrderStatus } from '@/utils/constants'
import { isSoundEnabled, setSoundEnabled, playNewOrderSound } from '@/utils/sound'

// 加载状态
const loading = ref(false)
const autoRefresh = ref(true)
const soundEnabled = ref(isSoundEnabled()) // 声音开关，从全局状态读取

// 实时订单列表
const realtimeOrders = ref<Order[]>([])

// 防重复播报：记录已播报过的订单号
const notifiedOrderNos = ref<Set<string>>(new Set())

// 新订单提示
const newOrderTip = ref(false)
const lastOrderCount = ref(0)

// 倒计时映射 orderId -> remainingSeconds
const countdownMap = ref<Record<number, number>>({})

// 定时器
let countdownTimer: ReturnType<typeof setInterval> | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
// 较慢的轮询间隔（30秒），作为WebSocket的兜底刷新，不触发提示音
const POLL_INTERVAL = 30000

// 需要在实时页显示的状态：待接单(1)、备餐中(2)、骑手已接单(3)、骑手已到店(11)
const REALTIME_STATUSES = [
  OrderStatus.PENDING_ACCEPT,
  OrderStatus.MERCHANT_ACCEPTED,
  OrderStatus.RIDER_ACCEPTED,
  OrderStatus.RIDER_ARRIVED,
]

// 获取实时订单（待接单/备餐中/等待骑手/骑手已到店）
async function fetchRealtimeOrders(showTip = false) {
  loading.value = true
  try {
    const res = await api.order.getList({ current: 1, size: 100 })
    const pendingOrders = res.data.list.filter((item) => REALTIME_STATUSES.includes(item.status as any))
    realtimeOrders.value = pendingOrders

    if (showTip && pendingOrders.length > lastOrderCount.value) {
      newOrderTip.value = true
      const diff = pendingOrders.length - lastOrderCount.value
      ElMessage.success(`收到 ${diff} 笔新订单`)
      // 播放新订单语音
      playNewOrderSound(diff)
      setTimeout(() => {
        newOrderTip.value = false
      }, 3000)
    }
    lastOrderCount.value = pendingOrders.length
  } finally {
    loading.value = false
  }
}

// ================== 语音播报 ==================
// 使用全局 sound.ts 提供的 playNewOrderSound / setSoundEnabled

function toggleSound() {
  const newVal = !soundEnabled.value
  setSoundEnabled(newVal)
  soundEnabled.value = newVal
  ElMessage.success(newVal ? '已开启声音提醒' : '已关闭声音提醒')
  if (newVal) {
    // 开启时播放一个短提示音
    playNewOrderSound(1)
  }
}

// ================== 订单操作 ==================

// 接单（待接单 → 备餐中）
async function handleAccept(row: Order) {
  try {
    await api.order.accept(row.id)
    ElMessage.success('接单成功，请尽快备餐')
    delete countdownMap.value[row.id]
    fetchRealtimeOrders()
  } catch {
    ElMessage.error('接单失败')
  }
}

// 拒单
async function handleReject(row: Order) {
  try {
    const { value: reason } = await ElMessageBox.prompt(`确认拒绝订单 ${row.orderNo} 吗？请输入拒单原因`, '拒单确认', {
      confirmButtonText: '确认拒单',
      cancelButtonText: '取消',
      inputPlaceholder: '请输入拒单原因',
      type: 'warning',
    })
    if (!reason || !reason.trim()) {
      ElMessage.warning('请输入拒单原因')
      return
    }
    await api.order.reject(row.id, reason.trim())
    ElMessage.success('已拒单')
    delete countdownMap.value[row.id]
    fetchRealtimeOrders()
  } catch {
    // 用户取消操作
  }
}

// 出餐完成（备餐中 → 等待骑手）
async function handleReady(row: Order) {
  try {
    await ElMessageBox.confirm(`订单 ${row.orderNo} 已出餐？确认后将通知骑手取餐。`, '出餐确认', {
      confirmButtonText: '确认出餐',
      cancelButtonText: '取消',
      type: 'success',
    })
    await api.order.ready(row.id)
    ElMessage.success('已通知骑手取餐')
    fetchRealtimeOrders()
  } catch {
    // 用户取消操作
  }
}

// 判断订单当前阶段，返回需要显示的按钮
function getOrderActions(order: Order) {
  const s = order.status
  if (s === OrderStatus.PENDING_ACCEPT) {
    // 待接单：接单 + 拒单
    return [
      { text: '接单', type: 'primary', action: 'accept' },
      { text: '拒单', type: 'danger', plain: true, action: 'reject' },
    ]
  }
  if (s === OrderStatus.MERCHANT_ACCEPTED || s === 4) {
    // 备餐中（含旧code=4）：出餐完成（无论是否有骑手接单）
    return [
      { text: '出餐完成', type: 'success', action: 'ready' },
    ]
  }
  // 骑手已接单(3)、骑手已到店(11)、配送中(5)：显示配送进度，无操作按钮
  // 已送达(6)/已完成(7)：完成状态，无操作按钮
  return []
}

function handleAction(row: Order, action: string) {
  if (action === 'accept') handleAccept(row)
  else if (action === 'reject') handleReject(row)
  else if (action === 'ready') handleReady(row)
}

// 获取状态标签类型
function getStatusTagType(status?: number): '' | 'success' | 'warning' | 'info' | 'danger' | 'primary' {
  if (status === undefined || status === null) return 'info'
  return OrderStatusTagType[status] || 'info'
}

// 倒计时格式化
function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

// 启动倒计时
function startCountdown() {
  if (countdownTimer) return
  countdownTimer = setInterval(() => {
    Object.keys(countdownMap.value).forEach((key) => {
      const id = Number(key)
      if (countdownMap.value[id] > 0) {
        countdownMap.value[id] -= 1
      }
    })
  }, 1000)
}

// 停止倒计时
function stopCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

// 启动兜底轮询
function startPolling() {
  if (pollTimer) return
  pollTimer = setInterval(() => {
    fetchRealtimeOrders(false)
  }, POLL_INTERVAL)
}

// 停止轮询
function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

// 切换自动刷新
function toggleAutoRefresh() {
  if (autoRefresh.value) {
    startPolling()
  } else {
    stopPolling()
  }
}

let offWsNewOrder: (() => void) | null = null

onMounted(() => {
  fetchRealtimeOrders()
  startCountdown()
  startPolling()

  // 请求通知权限
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission()
  }

  // WebSocket监听新订单（实时刷新 + 显示提示条）
  // 使用Set防重复播报，避免重连后重复提醒
  offWsNewOrder = wsService.on('NEW_ORDER', (msg: any) => {
    const orderNo = msg?.orderNo || String(msg?.orderId || '')
    // 防重复：已播报过的订单不再重复提醒
    if (orderNo && notifiedOrderNos.value.has(orderNo)) {
      fetchRealtimeOrders(false)
      return
    }
    if (orderNo) {
      notifiedOrderNos.value.add(orderNo)
    }
    fetchRealtimeOrders(false)
    if (soundEnabled.value) {
      newOrderTip.value = true
      setTimeout(() => { newOrderTip.value = false }, 3000)
      // 浏览器桌面通知
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('新订单提醒', {
          body: msg?.content || '您有新订单，请及时处理',
          icon: '/favicon.ico',
        })
      }
    }
  })

  // 监听其他状态变更（商家已接单、骑手已到店、商家出餐等），刷新列表
  const offStatusChange = wsService.on('ORDER_STATUS_CHANGED', () => {
    fetchRealtimeOrders(false)
  })

  // 监听MERCHANT_READY消息（其他商家端操作的出餐通知，此处仅刷新；自己操作的由handleReady处理）
  const offMerchantReady = wsService.on('MERCHANT_READY', () => {
    fetchRealtimeOrders(false)
  })

  onUnmounted(() => {
    stopPolling()
    stopCountdown()
    if (offWsNewOrder) {
      offWsNewOrder()
      offWsNewOrder = null
    }
    offStatusChange?.()
    offMerchantReady?.()
    // 清空防重复播报记录
    notifiedOrderNos.value.clear()
    // 停止语音
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  })
})
</script>

<template>
  <div class="merchant-order-realtime">
    <app-header title="实时订单" subtitle="实时订单推送">
      <template #right>
        <el-tooltip :content="soundEnabled ? '关闭声音提醒' : '开启声音提醒'" placement="bottom">
          <el-button :icon="soundEnabled ? Bell : Mute" circle @click="toggleSound" />
        </el-tooltip>
        <el-switch
          v-model="autoRefresh"
          active-text="自动刷新"
          inactive-text="停止刷新"
          @change="toggleAutoRefresh"
        />
        <el-button type="primary" :icon="Refresh" @click="fetchRealtimeOrders(true)">立即刷新</el-button>
      </template>
    </app-header>

    <!-- 新订单提示 -->
    <el-alert
      v-if="newOrderTip"
      title="您有新的订单，请及时处理！"
      type="success"
      :closable="false"
      show-icon
      class="new-order-alert"
    />

    <!-- 订单卡片列表 -->
    <div v-loading="loading" class="order-card-list">
      <app-empty v-if="!realtimeOrders.length" description="暂无待处理订单" />

      <el-row v-else :gutter="16">
        <el-col v-for="order in realtimeOrders" :key="order.id" :xs="24" :sm="12" :lg="8" :xl="6">
          <app-card class="order-card" :class="{
            'order-card--urgent': countdownMap[order.id] !== undefined && countdownMap[order.id] <= 60,
            'order-card--preparing-no-rider': order.status === 2 && !order.deliveryManId,
            'order-card--preparing-with-rider': order.status === 2 && order.deliveryManId,
            'order-card--rider-accepted': order.status === 3,
            'order-card--arrived': order.status === 11,
          }">
            <div class="order-card__header">
              <span class="order-no">{{ order.orderNo }}</span>
              <el-tag :type="getStatusTagType(order.status)" size="small" effect="dark">
                {{ OrderStatusMap[order.status] || '未知' }}
              </el-tag>
            </div>

            <div class="order-card__body">
              <div class="info-row">
                <span class="info-label">用户：</span>
                <span class="info-value">{{ order.userNickname || order.userName || '-' }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">电话：</span>
                <span class="info-value">{{ order.userPhone || '-' }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">地址：</span>
                <span class="info-value text-ellipsis">{{ order.address || '-' }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">金额：</span>
                <span class="info-value text-primary font-bold">{{ formatAmount(order.payAmount) }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">配送费：</span>
                <span class="info-value">{{ formatAmount(order.deliveryFee) }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">下单时间：</span>
                <span class="info-value">{{ formatDate(order.createdAt || order.createTime) }}</span>
              </div>
              <div v-if="countdownMap[order.id] !== undefined" class="info-row countdown-row">
                <span class="info-label">剩余：</span>
                <span class="info-value countdown-value">
                  <el-icon><Bell /></el-icon>
                  {{ formatCountdown(countdownMap[order.id]) }}
                </span>
              </div>
            </div>

            <div class="order-card__footer">
              <template v-for="(btn, idx) in getOrderActions(order)" :key="idx">
                <el-button
                  :type="btn.type as any"
                  :plain="btn.plain"
                  :disabled="btn.disabled"
                  size="small"
                  @click="handleAction(order, btn.action)"
                >
                  {{ btn.text }}
                </el-button>
              </template>
            </div>
          </app-card>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<style scoped lang="scss">
.merchant-order-realtime {
  .new-order-alert {
    margin-bottom: $spacing-md;
  }

  .order-card-list {
    min-height: 400px;
  }

  .order-card {
    margin-bottom: $spacing-md;

    &--urgent {
      border: 1px solid $danger;
      box-shadow: 0 0 12px rgba($danger, 0.2);
    }

    // 备餐中且无骑手：蓝色（等待骑手接单）
    &--preparing-no-rider {
      border-left: 4px solid $primary;
    }

    // 备餐中且有骑手：橙色
    &--preparing-with-rider {
      border-left: 4px solid $warning;
    }

    // 骑手已接单：橙色
    &--rider-accepted {
      border-left: 4px solid $warning;
    }

    // 骑手已到店：深橙色
    &--arrived {
      border-left: 4px solid #E65100;
    }

    &__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: $spacing-md;
      padding-bottom: $spacing-sm;
      border-bottom: 1px solid $border-light;

      .order-no {
        font-weight: 600;
        color: $text;
        font-size: $font-size-md;
      }
    }

    &__body {
      .info-row {
        display: flex;
        margin-bottom: $spacing-sm;

        .info-label {
          color: $text-muted;
          width: 70px;
          flex-shrink: 0;
        }

        .info-value {
          color: $text;
          flex: 1;
        }

        .text-ellipsis {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }

      .countdown-row {
        .countdown-value {
          color: $primary;
          font-weight: bold;
          display: flex;
          align-items: center;
          gap: $spacing-xs;
        }
      }
    }

    &__footer {
      display: flex;
      gap: $spacing-sm;
      margin-top: $spacing-md;
      padding-top: $spacing-sm;
      border-top: 1px solid $border-light;
    }
  }

  .text-primary {
    color: $primary;
  }

  .font-bold {
    font-weight: 600;
  }
}
</style>
