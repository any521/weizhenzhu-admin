import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getStorage, setStorage } from '@/utils/storage'
import type { UserType } from '@/utils/constants'

export interface BreadcrumbItem {
  title: string
  path?: string
}

export const useAppStore = defineStore('app', () => {
  // State
  const sidebarCollapsed = ref<boolean>(getStorage('sidebar_collapsed', false))
  const breadcrumbs = ref<BreadcrumbItem[]>([])
  const appName = ref<string>('味真族管理后台')
  const currentApp = ref<UserType | undefined>(getStorage<UserType>('user_type'))

  // Getters
  const isSidebarCollapsed = computed(() => sidebarCollapsed.value)

  // Actions
  /**
   * 切换侧边栏折叠状态
   */
  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
    setStorage('sidebar_collapsed', sidebarCollapsed.value)
  }

  /**
   * 设置侧边栏折叠状态
   */
  function setSidebarCollapsed(collapsed: boolean) {
    sidebarCollapsed.value = collapsed
    setStorage('sidebar_collapsed', collapsed)
  }

  /**
   * 设置面包屑
   */
  function setBreadcrumbs(items: BreadcrumbItem[]) {
    breadcrumbs.value = items
  }

  /**
   * 设置当前应用名称
   */
  function setAppName(name: string) {
    appName.value = name
  }

  /**
   * 设置当前应用类型
   */
  function setCurrentApp(type: UserType) {
    currentApp.value = type
  }

  return {
    sidebarCollapsed,
    breadcrumbs,
    appName,
    currentApp,
    isSidebarCollapsed,
    toggleSidebar,
    setSidebarCollapsed,
    setBreadcrumbs,
    setAppName,
    setCurrentApp,
  }
})
