import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getStorage, setStorage, removeStorage } from '@/utils/storage'
import type { UserType } from '@/utils/constants'
import { api } from '@/api'

export interface UserInfo {
  id: number
  username: string
  nickname?: string
  avatar?: string
  phone?: string
  email?: string
  type: UserType
  status?: number
  createTime?: string
}

export const useUserStore = defineStore('user', () => {
  // State
  const token = ref<string | undefined>(getStorage<string>('token'))
  const refreshToken = ref<string | undefined>(getStorage<string>('refresh_token'))
  const userInfo = ref<UserInfo | undefined>(getStorage<UserInfo>('user_info'))
  const userType = ref<UserType | undefined>(getStorage<UserType>('user_type'))

  // Getters
  const isLoggedIn = computed(() => !!token.value && !!userInfo.value)
  const currentUserType = computed(() => userType.value || userInfo.value?.type)

  // Actions
  /**
   * 设置登录信息
   */
  function setLoginInfo(loginToken: string, refToken: string, info: UserInfo, type: UserType) {
    token.value = loginToken
    refreshToken.value = refToken
    userInfo.value = info
    userType.value = type

    setStorage('token', loginToken)
    setStorage('refresh_token', refToken)
    setStorage('user_info', info)
    setStorage('user_type', type)
  }

  /**
   * 登录
   */
  async function login(username: string, password: string, type: UserType) {
    const res = await api.auth.login(username, password, type)
    if (res.code !== 200) {
      throw new Error(res.message || '登录失败')
    }
    const { token: loginToken, refreshToken: refToken, userId, nickname, avatar } = res.data
    const user: UserInfo = {
      id: userId,
      username,
      nickname,
      avatar,
      type,
      status: 1,
    }
    setLoginInfo(loginToken, refToken, user, type)
    return user
  }

  /**
   * 短信验证码登录
   */
  async function smsLogin(phone: string, code: string, type: UserType) {
    const res = await api.auth.smsLogin(phone, code, type)
    if (res.code !== 200) {
      throw new Error(res.message || '登录失败')
    }
    const { token: loginToken, refreshToken: refToken, userId, nickname, avatar } = res.data
    const user: UserInfo = {
      id: userId,
      username: phone,
      nickname,
      avatar,
      type,
      status: 1,
    }
    setLoginInfo(loginToken, refToken, user, type)
    return user
  }

  /**
   * 退出登录
   */
  async function logout() {
    try {
      await api.auth.logout()
    } catch {
      // 即使接口失败也清除本地登录态
    } finally {
      token.value = undefined
      refreshToken.value = undefined
      userInfo.value = undefined
      userType.value = undefined

      removeStorage('token')
      removeStorage('refresh_token')
      removeStorage('user_info')
      removeStorage('user_type')
    }
  }

  /**
   * 更新用户信息
   */
  function updateUserInfo(info: Partial<UserInfo>) {
    if (userInfo.value) {
      userInfo.value = { ...userInfo.value, ...info }
      setStorage('user_info', userInfo.value)
    }
  }

  return {
    token,
    refreshToken,
    userInfo,
    userType,
    isLoggedIn,
    currentUserType,
    setLoginInfo,
    login,
    smsLogin,
    logout,
    updateUserInfo,
  }
})
