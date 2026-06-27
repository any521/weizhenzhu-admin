<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Bell, WarningFilled, CircleClose, Check } from '@element-plus/icons-vue'
import { wsService, type WSMessage } from '@/utils/websocket'
import { ElPopover, ElBadge, ElButton, ElEmpty, ElTag } from 'element-plus'
import { useRouter } from 'vue-router'

interface AlertItem extends WSMessage {
  id: string
  receivedAt: number
  isRead: boolean
}

const router = useRouter()

// 告警列表（最近50条）
const alerts = ref<AlertItem[]>([])
const maxAlerts = 50
const popoverVisible = ref(false)

// 未读数
const unreadCount = computed(() => alerts.value.filter((a) => !a.isRead).length)

// 是否有紧急未读告警
const hasUrgent = computed(() =>
  alerts.value.some((a) => !a.isRead && a.level === 'urgent')
)

// 告警级别标签类型
function getLevelTagType(level?: string): 'danger' | 'warning' | 'info' {
  if (level === 'urgent') return 'danger'
  if (level === 'warning') return 'warning'
  return 'info'
}

// 告警级别文字
function getLevelText(level?: string): string {
  if (level === 'urgent') return '紧急'
  if (level === 'warning') return '警告'
  return '通知'
}

// 告警类型图标颜色
function getAlertIconColor(level?: string): string {
  if (level === 'urgent') return '#f56c6c'
  if (level === 'warning') return '#e6a23c'
  return '#909399'
}

// 获取告警分类图标
function getCategoryIcon(category?: string): string {
  const iconMap: Record<string, string> = {
    order_timeout: 'AlarmClock',
    complaint: 'WarningFilled',
    refund: 'RefreshLeft',
    system: 'InfoFilled',
    risk: 'WarningFilled',
    merchant_audit: 'Shop',
    rider_audit: 'Bicycle',
  }
  return iconMap[category || ''] || 'Bell'
}

// 格式化时间
function formatTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  const date = new Date(timestamp)
  return `${date.getMonth() + 1}-${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

// 处理收到的告警
function handleAlert(msg: WSMessage) {
  const item: AlertItem = {
    ...msg,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    receivedAt: Date.now(),
    isRead: false,
  }
  alerts.value.unshift(item)
  // 限制列表长度
  if (alerts.value.length > maxAlerts) {
    alerts.value = alerts.value.slice(0, maxAlerts)
  }
}

// 标记为已读
function markAsRead(alert: AlertItem) {
  alert.isRead = true
}

// 全部标为已读
function markAllAsRead() {
  alerts.value.forEach((a) => (a.isRead = true))
}

// 清空所有告警
function clearAll() {
  alerts.value = []
}

// 点击告警项，跳转到对应页面
function handleAlertClick(alert: AlertItem) {
  alert.isRead = true
  popoverVisible.value = false

  // 根据告警类型跳转到对应页面
  const category = alert.category || ''
  if (category === 'order_timeout' || category.startsWith('order')) {
    router.push('/admin/orders')
  } else if (category === 'refund' || category.includes('refund')) {
    router.push('/admin/refunds')
  } else if (category === 'complaint' || category === 'review') {
    router.push('/admin/reviews')
  } else if (category === 'merchant_audit' || category.includes('merchant')) {
    router.push('/admin/merchants/audit')
  } else if (category === 'rider_audit' || category.includes('rider')) {
    router.push('/admin/riders')
  } else if (category === 'risk') {
    router.push('/admin/risk')
  } else if (category === 'system') {
    router.push('/admin/system')
  }
}

// WS消息处理引用（用于解绑）
let unsubAdminAlert: (() => void) | null = null

onMounted(() => {
  // 注册管理端告警消息监听（监听规范化后的ADMIN_ALERT事件）
  unsubAdminAlert = wsService.onAdminMessage('ADMIN_ALERT', handleAlert)
})

onUnmounted(() => {
  if (unsubAdminAlert) {
    unsubAdminAlert()
  }
})
</script>

<template>
  <el-popover
    v-model:visible="popoverVisible"
    placement="bottom-end"
    :width="380"
    trigger="click"
    popper-class="alert-popover"
  >
    <template #reference>
      <div class="alert-bell" :class="{ 'alert-bell--urgent': hasUrgent }">
        <el-badge :value="unreadCount" :hidden="unreadCount === 0" :max="99" :type="hasUrgent ? 'danger' : 'warning'">
          <el-icon :size="20" class="bell-icon">
            <Bell />
          </el-icon>
        </el-badge>
      </div>
    </template>

    <div class="alert-panel">
      <!-- 面板头部 -->
      <div class="alert-panel__header">
        <span class="alert-panel__title">
          <el-icon><WarningFilled /></el-icon>
          系统告警
          <el-tag v-if="unreadCount > 0" size="small" type="danger" effect="dark" class="unread-tag">
            {{ unreadCount }}条未读
          </el-tag>
        </span>
        <div class="alert-panel__actions">
          <el-button
            v-if="unreadCount > 0"
            type="primary"
            link
            size="small"
            @click="markAllAsRead"
          >
            <el-icon><Check /></el-icon>
            全部已读
          </el-button>
          <el-button
            v-if="alerts.length > 0"
            type="danger"
            link
            size="small"
            @click="clearAll"
          >
            <el-icon><CircleClose /></el-icon>
            清空
          </el-button>
        </div>
      </div>

      <!-- 告警列表 -->
      <div class="alert-panel__list">
        <div v-if="alerts.length === 0" class="alert-panel__empty">
          <el-empty description="暂无告警消息" :image-size="80" />
        </div>

        <div
          v-for="alert in alerts"
          :key="alert.id"
          class="alert-item"
          :class="{ 'alert-item--unread': !alert.isRead, 'alert-item--urgent': alert.level === 'urgent' }"
          @click="handleAlertClick(alert)"
        >
          <div class="alert-item__icon" :style="{ color: getAlertIconColor(alert.level) }">
            <el-icon :size="18">
              <component :is="getCategoryIcon(alert.category)" />
            </el-icon>
          </div>
          <div class="alert-item__content">
            <div class="alert-item__top">
              <span class="alert-item__title">{{ alert.title || '系统通知' }}</span>
              <el-tag :type="getLevelTagType(alert.level)" size="small" effect="light" class="alert-item__level">
                {{ getLevelText(alert.level) }}
              </el-tag>
            </div>
            <p class="alert-item__msg">{{ alert.content || '您有一条新的系统消息' }}</p>
            <span class="alert-item__time">{{ formatTime(alert.receivedAt) }}</span>
          </div>
          <div v-if="!alert.isRead" class="alert-item__dot"></div>
        </div>
      </div>

      <!-- 面板底部 -->
      <div v-if="alerts.length > 0" class="alert-panel__footer">
        <el-button type="primary" text size="small" @click="router.push('/admin/dashboard')">
          查看控制台详情
        </el-button>
      </div>
    </div>
  </el-popover>
</template>

<style scoped lang="scss">
.alert-bell {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: $radius-md;
  cursor: pointer;
  transition: background-color $transition-fast;
  position: relative;

  &:hover {
    background-color: $border-light;
  }

  .bell-icon {
    color: $text-light;
    transition: color 0.2s;
  }

  &--urgent {
    animation: bell-shake 0.5s ease-in-out infinite;

    .bell-icon {
      color: #f56c6c;
    }
  }
}

@keyframes bell-shake {
  0%, 100% { transform: rotate(0deg); }
  20% { transform: rotate(-12deg); }
  40% { transform: rotate(12deg); }
  60% { transform: rotate(-8deg); }
  80% { transform: rotate(8deg); }
}

.alert-panel {
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: $spacing-sm;
    border-bottom: 1px solid $border-light;
    margin-bottom: $spacing-sm;
  }

  &__title {
    display: flex;
    align-items: center;
    gap: $spacing-xs;
    font-size: $font-size-md;
    font-weight: 600;
    color: $text;

    .unread-tag {
      margin-left: $spacing-xs;
    }
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
  }

  &__list {
    max-height: 400px;
    overflow-y: auto;
    margin: 0 -$spacing-sm;
    padding: 0 $spacing-xs;
  }

  &__empty {
    padding: $spacing-lg 0;
  }

  &__footer {
    padding-top: $spacing-sm;
    border-top: 1px solid $border-light;
    text-align: center;
    margin-top: $spacing-sm;
  }
}

.alert-item {
  display: flex;
  align-items: flex-start;
  gap: $spacing-sm;
  padding: $spacing-sm;
  border-radius: $radius-md;
  cursor: pointer;
  transition: background-color $transition-fast;
  position: relative;

  &:hover {
    background-color: $bg;
  }

  &--unread {
    background-color: rgba(64, 158, 255, 0.05);

    &:hover {
      background-color: rgba(64, 158, 255, 0.1);
    }
  }

  &--urgent.alert-item--unread {
    background-color: rgba(245, 108, 108, 0.08);

    &:hover {
      background-color: rgba(245, 108, 108, 0.14);
    }
  }

  &__icon {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background-color: rgba(144, 147, 153, 0.1);
    margin-top: 2px;
  }

  &__content {
    flex: 1;
    min-width: 0;
  }

  &__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-xs;
    margin-bottom: 2px;
  }

  &__title {
    font-size: $font-size-sm;
    font-weight: 600;
    color: $text;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__level {
    flex-shrink: 0;
  }

  &__msg {
    font-size: $font-size-sm;
    color: $text-light;
    line-height: 1.4;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  &__time {
    font-size: $font-size-xs;
    color: $text-muted;
    margin-top: 4px;
    display: block;
  }

  &__dot {
    position: absolute;
    top: 14px;
    right: 10px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: #f56c6c;
    flex-shrink: 0;
  }
}

:global(.alert-popover) {
  padding: $spacing-md !important;
}
</style>
