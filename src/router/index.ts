import { createRouter, createWebHistory } from 'vue-router'
import NProgress from 'nprogress'
import routes from './routes'
import { useUserStore } from '@/store'
import { resetRedirectFlag } from '@/utils/request'

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})

// 判断是否为登录页（含 admin/merchant 登录别名路由）
function isLoginRoute(path: string): boolean {
  return path === '/login' || path === '/admin/login' || path === '/merchant/login'
}

// 路由守卫
router.beforeEach((to, from, next) => {
  NProgress.start()

  const userStore = useUserStore()
  const isLoggedIn = userStore.isLoggedIn
  const userType = userStore.currentUserType

  // 公开页面（登录页等）
  if (to.meta.public) {
    // 已登录用户访问登录页 → 根据角色跳转到对应首页
    if (isLoggedIn && isLoginRoute(to.path)) {
      const dashboard = userType === 'admin' ? '/admin/dashboard' : '/merchant/dashboard'
      return next(dashboard)
    }
    // 访问登录页时重置跳转标记，防止标记卡住
    if (isLoginRoute(to.path)) {
      resetRedirectFlag()
    }
    return next()
  }

  // 未登录 → 跳转到统一登录页，携带 redirect 参数
  if (!isLoggedIn) {
    return next({
      path: '/login',
      query: { redirect: to.fullPath },
    })
  }

  // 已登录访问根路径 → 根据角色重定向
  if (to.path === '/') {
    return next(userType === 'admin' ? '/admin/dashboard' : '/merchant/dashboard')
  }

  // 校验用户类型与路由类型是否匹配
  const routeType = to.meta.type as string | undefined
  if (routeType && routeType !== userType) {
    return next(userType === 'admin' ? '/admin/dashboard' : '/merchant/dashboard')
  }

  next()
})

router.afterEach(() => {
  NProgress.done()
})

export default router
