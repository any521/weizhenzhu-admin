import { createRouter, createWebHistory } from 'vue-router'
import NProgress from 'nprogress'
import routes from './routes'
import { useUserStore } from '@/store'

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})

// 路由守卫
router.beforeEach((to, from, next) => {
  NProgress.start()

  const userStore = useUserStore()
  const isLoggedIn = userStore.isLoggedIn
  const userType = userStore.currentUserType

  // 公开页面直接放行
  if (to.meta.public) {
    return next()
  }

  // 未登录跳登录页
  if (!isLoggedIn) {
    return next('/login')
  }

  // 已登录访问根路径，根据用户类型重定向
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
