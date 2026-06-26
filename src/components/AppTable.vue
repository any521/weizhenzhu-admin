<script setup lang="ts" generic="T extends Record<string, unknown>">
import { computed, ref, watch, onMounted, useSlots } from 'vue'
import { useRoute } from 'vue-router'
import { Setting } from '@element-plus/icons-vue'
import { getStorage, setStorage } from '@/utils/storage'

export interface TableColumn {
  /** 列字段名 */
  prop: string
  /** 列标题 */
  label: string
  /** 是否可见 */
  visible?: boolean
  /** 列宽 */
  width?: number | string
  /** 最小列宽 */
  minWidth?: number | string
  /** 是否可排序（后端排序） */
  sortable?: boolean | 'custom'
  /** 是否固定列 */
  fixed?: 'left' | 'right' | false
  /** 是否显示溢出提示 */
  showOverflowTooltip?: boolean
  /** 对齐方式 */
  align?: 'left' | 'center' | 'right'
  /** 表头对齐方式 */
  headerAlign?: 'left' | 'center' | 'right'
}

interface Props {
  data: T[]
  loading?: boolean
  total?: number
  page?: number
  pageSize?: number
  pageSizes?: number[]
  emptyText?: string
  showPagination?: boolean
  /** 列配置（启用列显示/隐藏功能） */
  columns?: TableColumn[]
  /** 是否开启批量选择 */
  selectable?: boolean
  /** 是否显示列配置按钮 */
  showColumnConfig?: boolean
  /** 列配置持久化 key 后缀（默认使用 route.path） */
  storageKey?: string
  /** 表格高度 */
  height?: number | string
  /** 是否开启列宽拖拽（默认 true，需要 border） */
  resizable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  total: 0,
  page: 1,
  pageSize: 10,
  pageSizes: () => [10, 20, 50, 100],
  emptyText: '暂无数据',
  showPagination: true,
  selectable: false,
  showColumnConfig: true,
  resizable: true,
})

const emit = defineEmits<{
  (e: 'update:page', page: number): void
  (e: 'update:pageSize', pageSize: number): void
  (e: 'pageChange', page: number): void
  (e: 'sizeChange', pageSize: number): void
  (e: 'sortChange', payload: { prop: string; order: 'ascending' | 'descending' | null }): void
  (e: 'selectionChange', selection: T[]): void
  (e: 'selectAll', selection: T[]): void
  (e: 'rowClick', row: T): void
}>()

const slots = useSlots()
const route = useRoute()

const currentPage = computed({
  get: () => props.page,
  set: (val) => emit('update:page', val),
})

const currentPageSize = computed({
  get: () => props.pageSize,
  set: (val) => emit('update:pageSize', val),
})

function handleCurrentChange(page: number) {
  emit('update:page', page)
  emit('pageChange', page)
}

function handleSizeChange(size: number) {
  emit('update:pageSize', size)
  emit('update:page', 1)
  emit('sizeChange', size)
}

// ============ 列配置 ============
const storageKey = computed(() => props.storageKey || `table_columns_${route.path}`)

// 内部维护的列可见状态
const columnVisibleMap = ref<Record<string, boolean>>({})

// 初始化列可见状态：优先从 localStorage 读取，否则用列定义中的 visible
function initColumnVisible() {
  if (!props.columns || props.columns.length === 0) return
  const saved = getStorage<Record<string, boolean>>(storageKey.value)
  const map: Record<string, boolean> = {}
  props.columns.forEach((col) => {
    if (saved && typeof saved[col.prop] === 'boolean') {
      map[col.prop] = saved[col.prop]
    } else {
      map[col.prop] = col.visible !== false
    }
  })
  columnVisibleMap.value = map
}

// 监听 columns 变化重新初始化
watch(
  () => props.columns,
  () => initColumnVisible(),
  { immediate: true, deep: false },
)

// 持久化列可见状态
function persistColumnVisible() {
  setStorage(storageKey.value, columnVisibleMap.value)
}

function handleColumnVisibleChange() {
  persistColumnVisible()
}

// 用于 el-checkbox-group 的 v-model（可见列的 prop 数组）
const checkedProps = computed<string[]>({
  get() {
    if (!props.columns) return []
    return props.columns
      .filter((col) => columnVisibleMap.value[col.prop] !== false)
      .map((col) => col.prop)
  },
  set(val: string[]) {
    if (!props.columns) return
    const set = new Set(val)
    const map: Record<string, boolean> = {}
    props.columns.forEach((col) => {
      map[col.prop] = set.has(col.prop)
    })
    columnVisibleMap.value = map
    persistColumnVisible()
  },
})

// 过滤后的可见列
const visibleColumns = computed(() => {
  if (!props.columns) return []
  return props.columns.filter((col) => columnVisibleMap.value[col.prop] !== false)
})

// 是否使用列配置模式
const useColumnsMode = computed(() => !!props.columns && props.columns.length > 0)

// 检查某列是否有自定义插槽
function hasSlot(prop: string) {
  return !!(slots as Record<string, unknown>)[`cell-${prop}`]
}

// 列配置弹窗
const columnConfigVisible = ref(false)

function handleResetColumns() {
  if (!props.columns) return
  const map: Record<string, boolean> = {}
  props.columns.forEach((col) => {
    map[col.prop] = col.visible !== false
  })
  columnVisibleMap.value = map
  persistColumnVisible()
}

// ============ 排序 ============
function handleSortChange({ prop, order }: { prop: string; order: 'ascending' | 'descending' | null }) {
  emit('sortChange', { prop, order })
}

// ============ 批量选择 ============
function handleSelectionChange(selection: T[]) {
  emit('selectionChange', selection)
}

function handleSelectAll(selection: T[]) {
  emit('selectAll', selection)
}

function handleRowClick(row: T) {
  emit('rowClick', row)
}

// 暴露清空选择方法
const tableRef = ref()
function clearSelection() {
  tableRef.value?.clearSelection()
}
function toggleRowSelection(row: T, selected?: boolean) {
  tableRef.value?.toggleRowSelection(row, selected)
}
defineExpose({ clearSelection, toggleRowSelection, tableRef })

onMounted(() => {
  initColumnVisible()
})
</script>

<template>
  <div class="app-table">
    <!-- 批量操作插槽 + 列配置 -->
    <div v-if="$slots['batch-actions'] || (useColumnsMode && showColumnConfig)" class="app-table__toolbar">
      <div class="app-table__batch">
        <slot name="batch-actions" />
      </div>
      <div class="app-table__tools">
        <el-popover
          v-if="useColumnsMode && showColumnConfig"
          v-model:visible="columnConfigVisible"
          placement="bottom-end"
          :width="220"
          trigger="click"
        >
          <template #reference>
            <el-button :icon="Setting" circle size="small" title="列配置" />
          </template>
          <div class="column-config">
            <div class="column-config__header">
              <span>列显示配置</span>
              <el-button link type="primary" size="small" @click="handleResetColumns">重置</el-button>
            </div>
            <el-checkbox-group v-model="checkedProps" @change="handleColumnVisibleChange">
              <div v-for="col in columns" :key="col.prop" class="column-config__item">
                <el-checkbox :value="col.prop" :label="col.label" />
              </div>
            </el-checkbox-group>
          </div>
        </el-popover>
      </div>
    </div>

    <el-table
      ref="tableRef"
      v-loading="loading"
      :data="data"
      stripe
      border
      highlight-current-row
      :height="height"
      class="app-table__table"
      @sort-change="handleSortChange"
      @selection-change="handleSelectionChange"
      @select-all="handleSelectAll"
      @row-click="handleRowClick"
    >
      <!-- 批量选择列 -->
      <el-table-column v-if="selectable" type="selection" width="50" fixed="left" />

      <!-- 列配置模式：使用动态组件渲染，避免 v-if 包裹 el-table-column 导致的 DOM 问题 -->
      <el-table-column
        v-for="col in visibleColumns"
        :key="col.prop"
        :prop="col.prop"
        :label="col.label"
        :width="col.width"
        :min-width="col.minWidth"
        :sortable="col.sortable ? 'custom' : false"
        :fixed="col.fixed"
        :show-overflow-tooltip="col.showOverflowTooltip"
        :align="col.align"
        :header-align="col.headerAlign"
      >
        <template #default="scope">
          <slot :name="`cell-${col.prop}`" :row="scope.row" :index="scope.$index">
            {{ scope.row[col.prop] }}
          </slot>
        </template>
      </el-table-column>

      <!-- 默认插槽（向后兼容，非列配置模式时使用） -->
      <template v-if="!useColumnsMode">
        <slot />
      </template>

      <!-- 操作列插槽（用于列配置模式下放操作列） -->
      <slot name="append" />

      <template #empty>
        <app-empty :description="emptyText" />
      </template>
    </el-table>

    <div v-if="showPagination && total > 0" class="app-table__pagination">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="currentPageSize"
        :page-sizes="pageSizes"
        :total="total"
        layout="total, sizes, prev, pager, next, jumper"
        background
        @current-change="handleCurrentChange"
        @size-change="handleSizeChange"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.app-table {
  &__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: $spacing-sm;
    min-height: 32px;
  }

  &__batch {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
  }

  &__tools {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
  }

  &__table {
    border-radius: $radius-md;
  }

  &__pagination {
    display: flex;
    justify-content: flex-end;
    padding-top: $spacing-md;
  }
}

.column-config {
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: $spacing-sm;
    margin-bottom: $spacing-sm;
    border-bottom: 1px solid $border-light;
    font-size: $font-size-md;
    font-weight: 600;
    color: $text;
  }

  &__item {
    padding: $spacing-xs 0;
  }
}
</style>
