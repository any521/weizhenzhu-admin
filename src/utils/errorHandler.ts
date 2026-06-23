import { ElMessage } from 'element-plus'
import axios, { type AxiosError } from 'axios'
import { ApiErrorCode } from '@/types/api'

interface ApiErrorData {
  code?: number
  message?: string
}

/**
 * 统一处理接口错误
 * - 网络错误
 * - 401 / 403 / 500
 * - 业务错误码
 */
export function handleApiError(error: unknown) {
  const err = error as AxiosError<ApiErrorData>

  // 被取消的请求不再弹提示
  if (axios.isCancel?.(error)) {
    return
  }

  // 有 HTTP 响应状态
  if (err.response) {
    const status = err.response.status
    const data = err.response.data

    if (status === ApiErrorCode.UNAUTHORIZED) {
      ElMessage.error('登录已过期，请重新登录')
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
    ElMessage.error('网络异常，请检查网络连接')
    return
  }

  ElMessage.error((error as Error)?.message || '未知错误')
}
