import { ElMessage } from 'element-plus'
import axios, { type AxiosError } from 'axios'
import { ApiErrorCode } from '@/types/api'
import { isRedirecting } from './request'

interface ApiErrorData {
  code?: number
  message?: string
}

/**
 * 统一处理接口错误
 * - 网络错误
 * - 401 / 403 / 500
 * - 业务错误码
 *
 * 注意：401 在 request.ts 的响应拦截器中已做特殊处理（token 刷新/全局登出），
 * 此处只处理认证接口自身返回的 401（如密码错误），优先展示后端返回的 message。
 */
export function handleApiError(error: unknown) {
  // 正在跳转登录页，静默处理所有错误，避免重复弹提示
  if (isRedirecting()) {
    return
  }

  const err = error as AxiosError<ApiErrorData>

  // 被取消的请求不再弹提示
  if (axios.isCancel?.(error)) {
    return
  }

  // 有 HTTP 响应状态
  if (err.response) {
    const status = err.response.status
    const data = err.response.data

    // 双重检查：在开始处理后如果已开始跳转，也不再弹提示
    if (isRedirecting()) {
      return
    }

    if (status === ApiErrorCode.UNAUTHORIZED) {
      // 优先使用后端返回的错误信息，避免在登录失败时误报"登录已过期"
      const msg = data?.message || '认证失败，请重新登录'
      ElMessage.error(msg)
      return
    }

    if (status === ApiErrorCode.FORBIDDEN) {
      ElMessage.error('没有权限执行该操作')
      return
    }

    if (status >= ApiErrorCode.INTERNAL_ERROR) {
      ElMessage.error('服务器繁忙，请稍后重试')
      return
    }

    if (data && typeof data.code === 'number' && data.code !== ApiErrorCode.SUCCESS) {
      ElMessage.error(data.message || `业务异常（${data.code}）`)
      return
    }

    ElMessage.error(err.message || `请求失败（${status}）`)
    return
  }

  // 网络错误或无响应
  if (err.request) {
    if (!isRedirecting()) {
      ElMessage.error('网络异常，请检查网络连接')
    }
    return
  }

  if (!isRedirecting()) {
    ElMessage.error((error as Error)?.message || '未知错误')
  }
}
