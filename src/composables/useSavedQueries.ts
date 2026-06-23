import { ref, watch } from 'vue'
import { getStorage, setStorage, removeStorage } from '@/utils/storage'

export interface SavedQuery {
  /** 唯一 ID */
  id: string
  /** 保存名称 */
  name: string
  /** 查询条件 */
  conditions: Record<string, any>
  /** 创建时间 */
  createdAt: string
}

/**
 * 查询条件保存 composable
 * 持久化到 localStorage，key: saved_queries_${module}
 * @param module 模块标识（如 'admin_user'）
 */
export function useSavedQueries(module: string) {
  const storageKey = `saved_queries_${module}`
  const savedQueries = ref<SavedQuery[]>([])

  /** 从 localStorage 加载已保存的查询 */
  function load(): SavedQuery[] {
    return getStorage<SavedQuery[]>(storageKey) || []
  }

  /** 初始化 */
  function init() {
    savedQueries.value = load()
  }

  /** 保存查询条件 */
  function saveQuery(name: string, conditions: Record<string, any>): SavedQuery {
    const query: SavedQuery = {
      id: generateId(),
      name: name.trim(),
      conditions: JSON.parse(JSON.stringify(conditions)),
      createdAt: new Date().toISOString(),
    }
    savedQueries.value = [...savedQueries.value, query]
    persist()
    return query
  }

  /** 删除查询条件 */
  function deleteQuery(id: string): void {
    savedQueries.value = savedQueries.value.filter((q) => q.id !== id)
    persist()
  }

  /** 应用查询条件：返回查询条件的副本 */
  function applyQuery(id: string): Record<string, any> | null {
    const query = savedQueries.value.find((q) => q.id === id)
    if (!query) return null
    return JSON.parse(JSON.stringify(query.conditions))
  }

  /** 更新已存在的查询条件 */
  function updateQuery(id: string, name: string, conditions: Record<string, any>): void {
    const idx = savedQueries.value.findIndex((q) => q.id === id)
    if (idx === -1) return
    savedQueries.value[idx] = {
      ...savedQueries.value[idx],
      name: name.trim(),
      conditions: JSON.parse(JSON.stringify(conditions)),
    }
    persist()
  }

  /** 清空所有保存的查询 */
  function clearAll(): void {
    savedQueries.value = []
    removeStorage(storageKey)
  }

  /** 持久化到 localStorage */
  function persist() {
    setStorage(storageKey, savedQueries.value)
  }

  /** 生成唯一 ID */
  function generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  }

  // 初始化
  init()

  // 监听变化自动持久化（除手动 persist 外的修改也会触发）
  watch(savedQueries, () => persist(), { deep: true })

  return {
    savedQueries,
    saveQuery,
    deleteQuery,
    applyQuery,
    updateQuery,
    clearAll,
  }
}
