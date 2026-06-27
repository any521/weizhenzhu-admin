import dayjs from 'dayjs'

/**
 * 日期格式化
 * @param date 日期
 * @param format 格式模板
 */
export function formatDate(date?: string | number | Date, format = 'YYYY-MM-DD HH:mm:ss'): string {
  if (!date) return '-'
  return dayjs(date).format(format)
}

/**
 * 日期格式化（仅日期）
 */
export function formatDateOnly(date?: string | number | Date): string {
  return formatDate(date, 'YYYY-MM-DD')
}

/**
 * 金额格式化
 * @param amount 金额（元）
 * @param prefix 前缀
 */
export function formatAmount(amount?: number | string, prefix = '¥'): string {
  if (amount === undefined || amount === null || amount === '') return '-'
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(num)) return '-'
  return `${prefix}${num.toFixed(2)}`
}

/**
 * 数字千分位格式化
 */
export function formatNumber(num?: number): string {
  if (num === undefined || num === null) return '-'
  return num.toLocaleString('zh-CN')
}

/**
 * 状态映射
 * @param value 状态值
 * @param map 状态映射表
 * @param defaultText 默认文本
 */
export function mapStatus<T>(value: T, map: Record<string, string>, defaultText = '未知'): string {
  const key = String(value)
  return map[key] ?? defaultText
}

/**
 * 手机号脱敏
 */
export function maskPhone(phone?: string): string {
  if (!phone) return '-'
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}

/**
 * 文本截断
 */
export function truncateText(text?: string, length = 20): string {
  if (!text) return '-'
  return text.length > length ? `${text.slice(0, length)}...` : text
}

/**
 * 将后端返回的相对路径图片 URL 补全为完整可访问的 URL
 *
 * 后端 LocalStorageService.getAccessUrl() 返回的是相对路径（如 "/static/xxx.jpg"），
 * el-image 作为标准 <img> 会基于当前页面域名解析相对路径，
 * 导致开发环境下请求 http://localhost:5173/static/xxx.jpg 而 404。
 *
 * 本函数将 /static/、/api/ 等相对路径补全为后端 API 域名（VITE_API_BASE_URL）。
 * 已是完整 URL（http/https/data:）或 data URI 的原样返回。
 *
 * @param url 后端返回的图片 URL
 * @returns 补全后的完整 URL
 */
export function resolveImageUrl(url?: string | null): string {
  if (!url) return ''
  const trimmed = url.trim()
  if (!trimmed) return ''
  // 完整 URL（含协议）或 data URI 原样返回
  if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed
  // 相对路径补全后端域名
  const base = (import.meta.env.VITE_API_BASE_URL as string) || ''
  if (!base) return trimmed // 未配置 base 则原样返回（生产环境可能通过 nginx 同域代理）
  return base + (trimmed.startsWith('/') ? trimmed : '/' + trimmed)
}

