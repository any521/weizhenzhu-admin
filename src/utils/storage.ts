// localStorage 封装
const STORAGE_KEY_PREFIX = 'weizhenzu_admin_'

/**
 * 获取本地存储值
 * @param key 键名
 * @param defaultValue 默认值
 */
export function getStorage<T>(key: string, defaultValue?: T): T | undefined {
  try {
    const value = localStorage.getItem(`${STORAGE_KEY_PREFIX}${key}`)
    if (value === null) return defaultValue
    return JSON.parse(value) as T
  } catch (error) {
    console.error('读取本地存储失败:', error)
    return defaultValue
  }
}

/**
 * 设置本地存储值
 * @param key 键名
 * @param value 值
 */
export function setStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${key}`, JSON.stringify(value))
  } catch (error) {
    console.error('写入本地存储失败:', error)
  }
}

/**
 * 移除本地存储值
 * @param key 键名
 */
export function removeStorage(key: string): void {
  localStorage.removeItem(`${STORAGE_KEY_PREFIX}${key}`)
}

/**
 * 清空所有本地存储（仅清除本项目前缀的键）
 */
export function clearStorage(): void {
  const keysToRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
      keysToRemove.push(key)
    }
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key))
}

/**
 * 获取 Token
 */
export function getToken(): string | undefined {
  return getStorage<string>('token')
}

/**
 * 设置 Token
 */
export function setToken(token: string): void {
  setStorage('token', token)
}

/**
 * 移除 Token
 */
export function removeToken(): void {
  removeStorage('token')
}

/**
 * 获取 Refresh Token
 */
export function getRefreshToken(): string | undefined {
  return getStorage<string>('refresh_token')
}

/**
 * 设置 Refresh Token
 */
export function setRefreshToken(token: string): void {
  setStorage('refresh_token', token)
}

/**
 * 移除 Refresh Token
 */
export function removeRefreshToken(): void {
  removeStorage('refresh_token')
}
