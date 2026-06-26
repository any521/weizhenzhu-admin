<script setup lang="ts">
import { computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Fold, Expand, ArrowDown } from '@element-plus/icons-vue'
import { useUserStore, useAppStore } from '@/store'
import type { UserType } from '@/utils/constants'
import { wsService } from '@/utils/websocket'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const appStore = useAppStore()

const userType = computed(() => userStore.currentUserType || 'merchant')
const isCollapsed = computed(() => appStore.isSidebarCollapsed)
const sidebarWidth = computed(() => (isCollapsed.value ? '64px' : '220px'))

// 菜单配置
interface MenuItem {
  title: string
  path?: string
  icon: string
  children?: MenuItem[]
}

const merchantMenus: MenuItem[] = [
  { title: '工作台', path: '/merchant/dashboard', icon: 'HomeFilled' },
  {
    title: '订单管理',
    icon: 'Document',
    children: [
      { title: '订单列表', path: '/merchant/orders', icon: 'Document' },
      { title: '实时订单', path: '/merchant/orders/realtime', icon: 'Timer' },
    ],
  },
  {
    title: '菜品管理',
    icon: 'Food',
    children: [
      { title: '菜品列表', path: '/merchant/dishes', icon: 'Food' },
      { title: '编辑菜品', path: '/merchant/dishes/edit', icon: 'Edit' },
      { title: '分类管理', path: '/merchant/categories', icon: 'FolderOpened' },
    ],
  },
  { title: '评价管理', path: '/merchant/reviews', icon: 'ChatDotRound' },
  { title: '营销活动', path: '/merchant/promotions', icon: 'Present' },
  { title: '优惠券管理', path: '/merchant/coupons', icon: 'Ticket' },
  { title: '店铺设置', path: '/merchant/settings', icon: 'Setting' },
  { title: '财务中心', path: '/merchant/finance', icon: 'Money' },
  { title: '数据统计', path: '/merchant/stats', icon: 'TrendCharts' },
  { title: '回收站', path: '/merchant/recycle-bin', icon: 'Delete' },
]

const adminMenus: MenuItem[] = [
  { title: '控制台', path: '/admin/dashboard', icon: 'Odometer' },
  { title: '用户管理', path: '/admin/users', icon: 'UserFilled' },
  {
    title: '商家管理',
    icon: 'Shop',
    children: [
      { title: '商家列表', path: '/admin/merchants', icon: 'Shop' },
      { title: '商家审核', path: '/admin/merchants/audit', icon: 'CircleCheck' },
    ],
  },
  { title: '骑手管理', path: '/admin/riders', icon: 'Bicycle' },
  { title: '订单管理', path: '/admin/orders', icon: 'DocumentCopy' },
  { title: '退款管理', path: '/admin/refunds', icon: 'RefreshLeft' },
  { title: '评价管理', path: '/admin/reviews', icon: 'ChatLineRound' },
  { title: '优惠券管理', path: '/admin/coupons', icon: 'Ticket' },
  { title: '品类管理', path: '/admin/categories', icon: 'Grid' },
  { title: '菜品管理', path: '/admin/dishes', icon: 'Food' },
  { title: '财务管理', path: '/admin/finance', icon: 'Coin' },
  { title: '风控管理', path: '/admin/risk', icon: 'WarningFilled' },
  { title: '操作日志', path: '/admin/logs', icon: 'List' },
  { title: '回收站', path: '/admin/recycle-bin', icon: 'Delete' },
  { title: '系统设置', path: '/admin/system', icon: 'Tools' },
]

const menus = computed(() => (userType.value === 'admin' ? adminMenus : merchantMenus))

// 面包屑
const breadcrumbs = computed(() => {
  const matched = route.matched
    .filter((item) => item.meta?.title)
    .map((item) => ({ title: item.meta.title as string, path: item.path }))
  return matched.length ? matched : [{ title: route.meta?.title as string || '首页' }]
})

// 默认激活菜单
const activeMenu = computed(() => route.path)

// 下拉菜单命令处理
function handleCommand(command: string) {
  if (command === 'logout') {
    userStore.logout()
    router.push('/login')
  } else if (command === 'profile') {
    if (userType.value === 'admin') {
      router.push('/admin/profile')
    } else {
      router.push('/merchant/profile')
    }
  }
}

// 切换侧边栏
function toggleSidebar() {
  appStore.toggleSidebar()
}

// 生成动态图标组件
function getIcon(name: string) {
  // 图标已在 main.ts 全局注册，直接返回组件名
  return name
}

watch(
  () => route.path,
  () => {
    appStore.setBreadcrumbs(breadcrumbs.value)
  },
  { immediate: true }
)

// 商家端进入时连接WebSocket，退出时断开
onMounted(() => {
  if (userType.value === 'merchant') {
    wsService.connect()
  }
})

onUnmounted(() => {
  wsService.disconnect()
})

// 监听用户类型变化，商家端才连接
watch(userType, (newType, oldType) => {
  if (newType === 'merchant' && oldType !== 'merchant') {
    wsService.connect()
  } else if (newType !== 'merchant') {
    wsService.disconnect()
  }
})
</script>

<template>
  <el-container class="admin-layout">
    <!-- 侧边栏 -->
    <el-aside class="admin-layout__sidebar" :width="sidebarWidth">
      <div class="sidebar-logo">
        <div class="logo-icon">味</div>
        <span v-show="!isCollapsed" class="logo-text">味真族</span>
      </div>

      <el-scrollbar class="sidebar-menu-wrap">
        <el-menu
          :default-active="activeMenu"
          :collapse="isCollapsed"
          :collapse-transition="false"
          router
          class="sidebar-menu"
        >
          <template v-for="menu in menus" :key="menu.title">
            <el-sub-menu v-if="menu.children && menu.children.length" :index="menu.title">
              <template #title>
                <el-icon>
                  <component :is="getIcon(menu.icon)" />
                </el-icon>
                <span>{{ menu.title }}</span>
              </template>
              <el-menu-item
                v-for="child in menu.children"
                :key="child.path"
                :index="child.path"
              >
                <template #title>
                  <el-icon>
                    <component :is="getIcon(child.icon)" />
                  </el-icon>
                  <span>{{ child.title }}</span>
                </template>
              </el-menu-item>
            </el-sub-menu>

            <el-menu-item v-else :index="menu.path">
              <el-icon>
                <component :is="getIcon(menu.icon)" />
              </el-icon>
              <template #title>
                <span>{{ menu.title }}</span>
              </template>
            </el-menu-item>
          </template>
        </el-menu>
      </el-scrollbar>
    </el-aside>

    <!-- 右侧主体 -->
    <el-container class="admin-layout__main">
      <!-- 顶栏 -->
      <el-header class="admin-layout__header">
        <div class="header-left">
          <div class="collapse-btn" @click="toggleSidebar">
            <el-icon :size="18">
              <Fold v-if="!isCollapsed" />
              <Expand v-else />
            </el-icon>
          </div>
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item v-for="(item, index) in breadcrumbs" :key="index" :to="item.path">
              {{ item.title }}
            </el-breadcrumb-item>
          </el-breadcrumb>
        </div>

        <div class="header-right">
          <span class="app-name">{{ appStore.appName }}</span>
          <el-dropdown trigger="click" @command="handleCommand">
            <div class="user-info">
              <el-avatar :size="32" :src="userStore.userInfo?.avatar" class="user-avatar">
                {{ userStore.userInfo?.nickname?.charAt(0) || 'U' }}
              </el-avatar>
              <span class="user-name">{{ userStore.userInfo?.nickname || '管理员' }}</span>
              <el-icon class="user-arrow"><ArrowDown /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">个人设置</el-dropdown-item>
                <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <!-- 内容区 -->
      <el-main class="admin-layout__content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped lang="scss">
.admin-layout {
  height: 100vh;
  overflow: hidden;

  &__sidebar {
    background-color: $sidebar-bg;
    box-shadow: $shadow;
    transition: width 0.3s;
    display: flex;
    flex-direction: column;
    z-index: 10;
  }

  &__main {
    background-color: $bg;
    display: flex;
    flex-direction: column;
  }

  &__header {
    background-color: $header-bg;
    height: $header-height;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 $spacing-lg;
    box-shadow: $shadow;
    z-index: 5;
  }

  &__content {
    flex: 1;
    padding: $spacing-md;
    overflow: auto;
  }
}

.sidebar-logo {
  height: $header-height;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid $border-light;
  padding: 0 $spacing-md;
  overflow: hidden;
  white-space: nowrap;

  .logo-icon {
    width: 36px;
    height: 36px;
    border-radius: $radius-md;
    background: linear-gradient(135deg, $primary-light, $primary);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: bold;
    flex-shrink: 0;
  }

  .logo-text {
    margin-left: $spacing-sm;
    font-size: $font-size-lg;
    font-weight: bold;
    color: $text;
  }
}

.sidebar-menu-wrap {
  flex: 1;
  overflow: hidden;
}

.sidebar-menu {
  border-right: none;

  :deep(.el-menu-item.is-active) {
    color: $sidebar-active-text;
    background-color: $sidebar-active-bg;
    border-right: 3px solid $primary;
  }

  :deep(.el-menu-item:hover),
  :deep(.el-sub-menu__title:hover) {
    background-color: $sidebar-hover-bg;
  }

  :deep(.el-sub-menu.is-active .el-sub-menu__title) {
    color: $primary;
  }
}

.header-left {
  display: flex;
  align-items: center;
  gap: $spacing-md;

  .collapse-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: $radius-md;
    cursor: pointer;
    transition: background-color $transition-fast;

    &:hover {
      background-color: $border-light;
    }
  }
}

.header-right {
  display: flex;
  align-items: center;
  gap: $spacing-lg;

  .app-name {
    font-size: $font-size-md;
    color: $text-light;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    cursor: pointer;
    padding: $spacing-xs $spacing-sm;
    border-radius: $radius-md;
    transition: background-color $transition-fast;

    &:hover {
      background-color: $border-light;
    }

    .user-avatar {
      background-color: $primary;
      color: #fff;
      font-size: 14px;
    }

    .user-name {
      font-size: $font-size-md;
      color: $text;
    }

    .user-arrow {
      color: $text-muted;
    }
  }
}

</style>
