<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { Refresh, Bell } from '@element-plus/icons-vue'
import { api } from '@/api'
import { wsService } from '@/utils/websocket'
import type { Order } from '@/api/types'
import { formatAmount, formatDate } from '@/utils/format'
import { OrderStatusMap } from '@/utils/constants'

// 加载状态
const loading = ref(false)
const autoRefresh = ref(true)

// 实时订单列表
const realtimeOrders = ref<Order[]>([])

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

// 获取实时订单（待接单/待配送）
async function fetchRealtimeOrders(showTip = false) {
  loading.value = true
  try {
    const res = await api.order.getList({ current: 1, size: 100 })
    const pendingOrders = res.data.list.filter((item) => item.status === 1 || item.status === 2)
    realtimeOrders.value = pendingOrders

    // 仅在非WS触发的轮询刷新时（即兜底轮询），不弹出声音/消息提示
    // 声音和弹窗通知统一由wsService内置的handleNewOrder处理，避免重复
    if (showTip && pendingOrders.length > lastOrderCount.value) {
      newOrderTip.value = true
      const diff = pendingOrders.length - lastOrderCount.value
      ElMessage.success(`收到 ${diff} 笔新订单`)
      setTimeout(() => {
        newOrderTip.value = false
      }, 3000)
    }
    lastOrderCount.value = pendingOrders.length
  } finally {
    loading.value = false
  }
}

// 接单
async function handleAccept(row: Order) {
  try {
    await api.order.updateStatus(row.id, 2)
    ElMessage.success('接单成功')
    delete countdownMap.value[row.id]
    fetchRealtimeOrders()
  } catch {
    ElMessage.error('接单失败')
  }
}

// 拒单
async function handleReject(row: Order) {
  try {
    await ElMessageBox.confirm(`确认拒绝订单 ${row.orderNo} 吗？`, '提示', {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await api.order.updateStatus(row.id, 5)
    ElMessage.success('已拒单')
    delete countdownMap.value[row.id]
    fetchRealtimeOrders()
  } catch {
    // 用户取消操作
  }
}

// 倒计时格式化
function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')
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

// 启动兜底轮询（低频，仅作数据一致性保障，不触发提示音）
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

  // 通过WebSocket监听新订单，实时刷新列表（声音/弹窗由wsService统一处理，此处仅刷新数据）
  offWsNewOrder = wsService.on('NEW_ORDER', () => {
    fetchRealtimeOrders(false)
  })

  onUnmounted(() => {
    stopPolling()
    stopCountdown()
    if (offWsNewOrder) {
      offWsNewOrder()
      offWsNewOrder = null
    }
  })
})
</script>

<template>
  <div class="merchant-order-realtime">
    <app-header title="实时订单" subtitle="实时订单推送">
      <template #right>
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
          <app-card class="order-card" :class="{ 'order-card--urgent': countdownMap[order.id] !== undefined && countdownMap[order.id] <= 60 }">
            <div class="order-card__header">
              <span class="order-no">{{ order.orderNo }}</span>
              <el-tag :type="order.status === 1 ? 'danger' : 'warning'" size="small">
                {{ OrderStatusMap[order.status] || '未知' }}
              </el-tag>
            </div>

            <div class="order-card__body">
              <div class="info-row">
                <span class="info-label">用户：</span>
                <span class="info-value">{{ order.userNickname || order.userName || '-' }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">商品：</span>
                <span class="info-value">{{ order.merchantName }}</span>
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
              <el-button type="primary" size="small" @click="handleAccept(order)">接单</el-button>
              <el-button type="danger" plain size="small" @click="handleReject(order)">拒单</el-button>
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
