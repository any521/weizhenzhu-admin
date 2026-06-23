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
 * @param amount 金额（分）
 * @param prefix 前缀
 */
export function formatAmount(amount?: number, prefix = '¥'): string {
  if (amount === undefined || amount === null) return '-'
  const value = (amount / 100).toFixed(2)
  return `${prefix}${value}`
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
