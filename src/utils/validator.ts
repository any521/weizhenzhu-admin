/**
 * 校验手机号
 */
export function isPhone(phone?: string): boolean {
  if (!phone) return false
  return /^1[3-9]\d{9}$/.test(phone)
}

/**
 * 校验邮箱
 */
export function isEmail(email?: string): boolean {
  if (!email) return false
  return /^[\w.-]+@[\w.-]+\.\w+$/.test(email)
}

/**
 * 校验密码强度
 * @param password 密码
 * @returns 强度等级：0-弱 1-中 2-强
 */
export function checkPasswordStrength(password?: string): number {
  if (!password || password.length < 6) return 0

  let score = 0
  if (password.length >= 8) score += 1
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1
  if (/\d/.test(password)) score += 1
  if (/[^a-zA-Z0-9]/.test(password)) score += 1

  if (score <= 2) return 0
  if (score === 3) return 1
  return 2
}

/**
 * 校验是否为有效 URL
 */
export function isUrl(url?: string): boolean {
  if (!url) return false
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * 校验是否为非空字符串
 */
export function isNotEmpty(value?: string): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * 校验身份证号码（简单校验）
 */
export function isIdCard(idCard?: string): boolean {
  if (!idCard) return false
  return /^\d{17}[\dXx]$/.test(idCard)
}
