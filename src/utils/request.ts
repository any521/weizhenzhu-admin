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
let refreshSubscribers: Array<(token: string) => void> = []

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token))
  refreshSubscribers = []
}

function addRefreshSubscriber(cb: (token: string) => void) {
  refreshSubscribers.push(cb)
}

/**
 * 清除登录态并跳转登录页
 */
export function handleLogout() {
  removeToken()
  removeRefreshToken()
  removeStorage('user_info')
  removeStorage('user_type')
  ElMessage.error('登录已过期，请重新登录')
  if (typeof window !== 'undefined') {
    window.location.href = '/login'
  }
}

// 响应拦截器：统一处理错误、Token 刷新
service.interceptors.response.use(
  (response: AxiosResponse) => {
    const { data } = response
    // 后端统一格式 { code, data, message }
    if (data && typeof data.code === 'number' && data.code !== 200) {
      const error = new Error(data.message || '请求失败') as AxiosError
      ;(error as any).response = { data, status: response.status }
      handleApiError(error)
      return Promise.reject(data)
    }
    return data
  },
  async (error: AxiosError) => {
    const status = error.response?.status
    const config = error.config as InternalAxiosRequestConfig | undefined

    // 401 自动刷新 token
    if (status === 401) {
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
            const { token, refreshToken: newRefreshToken } = res.data.data
            setToken(token)
            setRefreshToken(newRefreshToken)
            onRefreshed(token)
            isRefreshing = false

            // 重试原始请求
            if (config) {
              config.headers = config.headers || {}
              config.headers.Authorization = `Bearer ${token}`
              return service(config)
            }
          } catch (refreshError) {
            isRefreshing = false
            refreshSubscribers = []
            handleLogout()
            handleApiError(refreshError as AxiosError)
            return Promise.reject(refreshError)
          }
        } else {
          // 正在刷新，排队等待
          return new Promise((resolve, reject) => {
            addRefreshSubscriber((newToken) => {
              if (config) {
                config.headers = config.headers || {}
                config.headers.Authorization = `Bearer ${newToken}`
                resolve(service(config))
              } else {
                reject(error)
              }
            })
          })
        }
      } else {
        handleLogout()
      }
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
