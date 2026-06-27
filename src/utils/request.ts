import axios, {
  type AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
  type CancelTokenSource,
  type AxiosRequestConfig,
} from 'axios'
import { ElMessage } from 'element-plus'
import {
  getToken,
  removeToken,
  getRefreshToken,
  removeRefreshToken,
  setToken,
  setRefreshToken,
  removeStorage,
  getStorage,
} from './storage'
import { handleApiError } from './errorHandler'
import type { RefreshTokenResult } from '@/types/api'
import type { UserType } from '@/utils/constants'
import { wsService } from './websocket'

// 读取环境变量中的 API 基础地址
const baseURL = import.meta.env.VITE_API_BASE_URL || ''

// 创建 axios 实例
export const service = axios.create({
  baseURL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 活跃的 CancelToken 源
const activeSources = new Set<CancelTokenSource>()

/**
 * 创建请求取消令牌
 */
export function createCancelToken(): CancelTokenSource {
  const source = axios.CancelToken.source()
  activeSources.add(source)
  return source
}

/**
 * 取消所有活跃请求
 */
export function cancelRequest(message = '请求已取消') {
  activeSources.forEach((source) => {
    try {
      source.cancel(message)
    } catch (error) {
      // ignore
    }
  })
  activeSources.clear()
}

// 生成 UUID（简易版）
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// ========== 防重复跳转登录 ==========
let isRedirectingToLogin = false

/**
 * 检查是否正在跳转登录页（供 errorHandler 等外部模块判断是否静默处理错误）
 */
export function isRedirecting(): boolean {
  return isRedirectingToLogin
}

/**
 * 重置跳转登录标记（登录页挂载时调用）
 */
export function resetRedirectFlag() {
  isRedirectingToLogin = false
}

/**
 * 手动登出前调用：标记正在跳转，取消请求，避免后续 401 弹"登录已过期"提示。
 * 注意：此函数不弹提示、不跳转、不清存储（由调用方负责）。
 */
export function prepareManualLogout() {
  isRedirectingToLogin = true
  try {
    wsService.disconnect()
  } catch {
    // ignore
  }
  cancelRequest('手动登出')
  isRefreshing = false
  refreshSubscribers = []
}

/**
 * 判断是否为认证接口（登录、短信验证码、刷新 token 等）
 * 这些接口的 401 属于正常业务错误（如密码错误），不应触发全局登出
 */
function isAuthEndpoint(url: string | undefined): boolean {
  if (!url) return false
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/sms-code') ||
    url.includes('/auth/refresh') ||
    url.includes('/auth/logout')
  )
}

// 路由引用（通过 setRouter 注入，避免循环依赖）
let _router: import('vue-router').Router | null = null
export function setRouter(router: import('vue-router').Router) {
  _router = router
}

// 请求拦截器：自动注入 Token、TraceId
service.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getToken()
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    if (config.headers) {
      config.headers['X-Trace-Id'] = generateUUID()
    }
    return config
  },
  (error: AxiosError) => {
    return Promise.reject(error)
  },
)

let isRefreshing = false
let refreshSubscribers: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = []

function onRefreshed(token: string) {
  refreshSubscribers.forEach(({ resolve }) => resolve(token))
  refreshSubscribers = []
}

function onRefreshFailed(err: any) {
  refreshSubscribers.forEach(({ reject }) => reject(err))
  refreshSubscribers = []
}

function addRefreshSubscriber(resolve: (token: string) => void, reject: (err: any) => void) {
  refreshSubscribers.push({ resolve, reject })
}

/**
 * 清除登录态并跳转登录页（全局单例，防止并发 401 重复提示/跳转）
 */
export function handleLogout() {
  if (isRedirectingToLogin) return
  isRedirectingToLogin = true

  // 断开 WebSocket，防止继续重连
  try {
    wsService.disconnect()
  } catch {
    // ignore
  }

  // 取消所有正在进行的请求
  cancelRequest('登录已过期')

  // 清除本地登录态
  removeToken()
  removeRefreshToken()
  removeStorage('user_info')
  removeStorage('user_type')

  // 重置刷新状态，拒绝所有排队请求
  isRefreshing = false
  onRefreshFailed(new Error('登录已过期'))

  // 只提示一次
  ElMessage.error('登录已过期，请重新登录')

  // 延迟跳转，确保当前事件循环中的其他 401 请求都能被 isRedirectingToLogin 拦截
  setTimeout(() => {
    if (_router) {
      _router.push('/login')
    } else {
      window.location.href = '/login'
    }
  }, 300)
}

// 响应拦截器：统一处理错误、Token 刷新
service.interceptors.response.use(
  (response: AxiosResponse) => {
    const { data } = response
    // 后端统一格式 { code, data, message }
    if (data && typeof data.code === 'number' && data.code !== 200) {
      // 已在跳转登录中，静默拒绝所有业务错误
      if (isRedirectingToLogin) {
        return Promise.reject(data)
      }

      // 业务层面 401（未登录/登录过期），统一走防重复登出逻辑
      if (data.code === 401) {
        const config = response.config as InternalAxiosRequestConfig | undefined
        // 认证接口（登录/验证码/刷新）的401交给业务处理
        if (!isAuthEndpoint(config?.url)) {
          handleLogout()
          return Promise.reject(new Error(data.message || '登录已过期'))
        }
      }

      const error = new Error(data.message || '请求失败') as AxiosError
      ;(error as any).response = { data, status: response.status }
      handleApiError(error)
      return Promise.reject(data)
    }
    return data
  },
  async (error: AxiosError) => {
    // 被取消的请求不再弹提示
    if (axios.isCancel?.(error)) {
      return Promise.reject(error)
    }

    const status = error.response?.status
    const config = error.config as InternalAxiosRequestConfig | undefined

    // 401 自动刷新 token
    if (status === 401) {
      // 已在跳转中，直接拒绝，不弹任何提示
      if (isRedirectingToLogin) {
        return Promise.reject(error)
      }

      // 认证接口本身的 401（如密码错误、验证码错误）不触发全局登出，交给业务处理
      if (isAuthEndpoint(config?.url)) {
        handleApiError(error)
        return Promise.reject(error)
      }

      const refreshToken = getRefreshToken()
      const userType = (() => {
        try {
          return getStorage<UserType | undefined>('user_type')
        } catch {
          return undefined
        }
      })()
      const isRefreshRequest = config?.url?.includes('/auth/refresh')

      if (refreshToken && userType && !isRefreshRequest) {
        if (!isRefreshing) {
          isRefreshing = true
          try {
            const res = await axios.post<{
              code: number
              data: RefreshTokenResult
              message: string
            }>(
              `${baseURL}/api/${userType}/auth/refresh`,
              { refreshToken },
              {
                headers: { 'X-Trace-Id': generateUUID() },
              },
            )
            if (res.data.code !== 200 || !res.data.data) {
              throw new Error(res.data.message || '刷新 token 失败')
            }
            const { token: newToken, refreshToken: newRefreshToken } = res.data.data
            setToken(newToken)
            setRefreshToken(newRefreshToken)
            onRefreshed(newToken)
            isRefreshing = false

            // 重试原始请求
            if (config) {
              config.headers = config.headers || {}
              config.headers.Authorization = `Bearer ${newToken}`
              return service(config)
            }
          } catch (refreshError) {
            isRefreshing = false
            onRefreshFailed(refreshError)
            handleLogout()
            return Promise.reject(refreshError)
          }
        } else {
          // 正在刷新，排队等待
          return new Promise((resolve, reject) => {
            addRefreshSubscriber(
              (newToken) => {
                if (config) {
                  config.headers = config.headers || {}
                  config.headers.Authorization = `Bearer ${newToken}`
                  resolve(service(config))
                } else {
                  reject(error)
                }
              },
              (err) => reject(err),
            )
          })
        }
      } else {
        // 没有 refreshToken 或没有 userType，直接登出
        handleLogout()
        return Promise.reject(error)
      }
    }

    // 已在跳转登录中，不再弹其他错误提示
    if (isRedirectingToLogin) {
      return Promise.reject(error)
    }

    handleApiError(error)
    return Promise.reject(error)
  },
)

/**
 * 通用请求方法（返回 response.data）
 */
async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const response = (await service.request(config)) as unknown as T
  return response
}

export default request
