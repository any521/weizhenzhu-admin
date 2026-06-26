<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { Search, RefreshRight, Download, Star } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { api } from '@/api'
import AppCard from '@/components/AppCard.vue'
import AppHeader from '@/components/AppHeader.vue'
import AppTable, { type TableColumn } from '@/components/AppTable.vue'
import { formatDate, truncateText } from '@/utils/format'
import { exportToExcel, exportToCsv, type ExportColumn } from '@/utils/export'
import { downloadBlob } from '@/utils/download'
import { useSavedQueries, type SavedQuery } from '@/composables/useSavedQueries'
import type { OperationLog } from '@/api/types'

// 搜索表单
interface SearchForm {
  operator: string
  module: string
  action: string
  result: number | undefined
  dateRange: string[]
}

const searchForm = reactive<SearchForm>({
  operator: '',
  module: '',
  action: '',
  result: undefined,
  dateRange: [],
})

const loading = ref(false)
const exporting = ref(false)
const tableData = ref<OperationLog[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)

// 排序
const sortField = ref<string>('')
const sortOrder = ref<'asc' | 'desc'>('asc')

// 详情弹窗
const detailVisible = ref(false)
const currentRow = ref<OperationLog | null>(null)

// 列定义
const columns: TableColumn[] = [
  { prop: 'id', label: 'ID', width: 80, sortable: true },
  { prop: 'operator', label: '操作人', minWidth: 120 },
  { prop: 'module', label: '模块', minWidth: 120 },
  { prop: 'action', label: '操作类型', minWidth: 120 },
  { prop: 'ip', label: 'IP', minWidth: 140 },
  { prop: 'createTime', label: '操作时间', minWidth: 170, sortable: true },
  { prop: 'result', label: '结果', width: 100 },
  { prop: 'detail', label: '详情', minWidth: 180, showOverflowTooltip: true },
]

// 查询条件保存
const { savedQueries, saveQuery, deleteQuery, applyQuery } = useSavedQueries('admin_log')

// 保存查询弹窗
const saveQueryVisible = ref(false)
const saveQueryName = ref('')

// 构造查询参数
function buildQueryParams() {
  return {
    page: page.value,
    pageSize: pageSize.value,
    operator: searchForm.operator || undefined,
    module: searchForm.module || undefined,
    action: searchForm.action || undefined,
    result: searchForm.result,
    startDate: searchForm.dateRange?.[0],
    endDate: searchForm.dateRange?.[1],
    sortField: sortField.value || undefined,
    sortOrder: sortOrder.value,
  }
}

// 加载日志列表
async function loadList() {
  loading.value = true
  try {
    const res = await api.log.getList(buildQueryParams())
    tableData.value = res.data.list || []
    total.value = res.data.total || 0
  } catch (e: any) {
    console.error('加载日志失败', e)
    ElMessage.error(e?.message || '加载日志失败')
    tableData.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

// 搜索
function handleSearch() {
  page.value = 1
  loadList()
}

// 重置
function handleReset() {
  searchForm.operator = ''
  searchForm.module = ''
  searchForm.action = ''
  searchForm.result = undefined
  searchForm.dateRange = []
  sortField.value = ''
  handleSearch()
}

// 排序变化
function handleSortChange({ prop, order }: { prop: string; order: 'ascending' | 'descending' | null }) {
  if (order) {
    sortField.value = prop
    sortOrder.value = order === 'ascending' ? 'asc' : 'desc'
  } else {
    sortField.value = ''
  }
  loadList()
}

// 查看详情
function handleView(row: OperationLog) {
  currentRow.value = row
  detailVisible.value = true
}

// 导出
const exportColumns: ExportColumn[] = [
  { prop: 'id', label: 'ID' },
  { prop: 'operator', label: '操作人' },
  { prop: 'module', label: '模块' },
  { prop: 'action', label: '操作类型' },
  { prop: 'ip', label: 'IP' },
  { prop: 'createTime', label: '操作时间', formatter: (_row, v) => formatDate(v) },
  { prop: 'result', label: '结果', formatter: (_row, v) => (v === 1 ? '成功' : '失败') },
  { prop: 'detail', label: '详情' },
]

async function handleExport(format: 'xlsx' | 'csv') {
  exporting.value = true
  try {
    // 优先调用后端导出接口
    try {
      const blob = await api.log.export({ ...buildQueryParams(), format })
      downloadBlob(blob, `操作日志.${format}`, format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv;charset=utf-8;')
      ElMessage.success('导出成功')
      return
    } catch {
      // 后端不支持时降级为前端导出
    }
    const filename = `操作日志_${formatDate(new Date(), 'YYYYMMDD_HHmmss')}`
    if (format === 'xlsx') {
      exportToExcel(exportColumns, tableData.value, filename)
    } else {
      exportToCsv(exportColumns, tableData.value, filename)
    }
    ElMessage.success('导出成功')
  } finally {
    exporting.value = false
  }
}

// 查询条件保存
function openSaveQuery() {
  if (
    !searchForm.operator &&
    !searchForm.module &&
    !searchForm.action &&
    searchForm.result === undefined &&
    (!searchForm.dateRange || searchForm.dateRange.length === 0)
  ) {
    ElMessage.warning('请先设置查询条件')
    return
  }
  saveQueryName.value = ''
  saveQueryVisible.value = true
}

function handleSaveQuery() {
  if (!saveQueryName.value.trim()) {
    ElMessage.warning('请输入查询条件名称')
    return
  }
  saveQuery(saveQueryName.value, { ...searchForm })
  saveQueryVisible.value = false
  ElMessage.success('保存成功')
}

function handleApplyQuery(item: SavedQuery) {
  const conditions = applyQuery(item.id)
  if (conditions) {
    Object.assign(searchForm, conditions)
    handleSearch()
    ElMessage.success(`已应用查询：${item.name}`)
  }
}

function handleDeleteQuery(item: SavedQuery) {
  deleteQuery(item.id)
  ElMessage.success('已删除')
}

onMounted(loadList)
</script>

<template>
  <div class="admin-log">
    <AppHeader title="操作日志" subtitle="记录后台管理操作">
      <el-dropdown @command="handleExport">
        <el-button :icon="Download" :loading="exporting">导出</el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="xlsx">导出 Excel</el-dropdown-item>
            <el-dropdown-item command="csv">导出 CSV</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </AppHeader>

    <!-- 搜索区域 -->
    <AppCard class="search-card">
      <el-form :model="searchForm" inline>
        <el-form-item label="操作人">
          <el-input v-model="searchForm.operator" placeholder="请输入操作人" clearable />
        </el-form-item>
        <el-form-item label="模块">
          <el-input v-model="searchForm.module" placeholder="请输入模块名称" clearable />
        </el-form-item>
        <el-form-item label="操作类型">
          <el-input v-model="searchForm.action" placeholder="请输入操作类型" clearable />
        </el-form-item>
        <el-form-item label="结果">
          <el-select v-model="searchForm.result" placeholder="全部结果" clearable style="width: 120px">
            <el-option label="成功" :value="1" />
            <el-option label="失败" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item label="操作时间">
          <el-date-picker
            v-model="searchForm.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
          <el-button :icon="RefreshRight" @click="handleReset">重置</el-button>
          <el-button :icon="Star" @click="openSaveQuery">保存查询</el-button>
        </el-form-item>
      </el-form>

      <!-- 已保存的查询条件 -->
      <div v-if="savedQueries.length > 0" class="saved-queries">
        <span class="saved-queries__label">已保存查询：</span>
        <el-tag
          v-for="item in savedQueries"
          :key="item.id"
          class="saved-queries__tag"
          closable
          @click="handleApplyQuery(item)"
          @close="handleDeleteQuery(item)"
        >
          <el-icon><Star /></el-icon>
          {{ item.name }}
        </el-tag>
      </div>
    </AppCard>

    <!-- 表格 -->
    <AppCard>
      <AppTable
        v-model:page="page"
        v-model:page-size="pageSize"
        :data="tableData"
        :loading="loading"
        :total="total"
        :columns="columns"
        @page-change="loadList"
        @size-change="loadList"
        @sort-change="handleSortChange"
      >
        <template #cell-operator="{ row }">
          {{ row.operator || '-' }}
        </template>

        <template #cell-ip="{ row }">
          {{ row.ip || '-' }}
        </template>

        <template #cell-createTime="{ row }">
          {{ formatDate(row.createTime) }}
        </template>

        <template #cell-result="{ row }">
          <el-tag :type="row.result === 1 ? 'success' : 'danger'">
            {{ row.result === 1 ? '成功' : '失败' }}
          </el-tag>
        </template>

        <template #cell-detail="{ row }">
          {{ row.detail || row.params || '-' }}
        </template>

        <template #append>
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="handleView(row)">查看</el-button>
            </template>
          </el-table-column>
        </template>
      </AppTable>
    </AppCard>

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailVisible" title="日志详情" width="600px">
      <el-descriptions v-if="currentRow" :column="1" border>
        <el-descriptions-item label="ID">{{ currentRow.id }}</el-descriptions-item>
        <el-descriptions-item label="操作人">{{ currentRow.operator }}</el-descriptions-item>
        <el-descriptions-item label="模块">{{ currentRow.module }}</el-descriptions-item>
        <el-descriptions-item label="操作类型">{{ currentRow.action }}</el-descriptions-item>
        <el-descriptions-item label="IP">{{ currentRow.ip }}</el-descriptions-item>
        <el-descriptions-item label="操作时间">{{ formatDate(currentRow.createTime) }}</el-descriptions-item>
        <el-descriptions-item label="结果">
          <el-tag :type="currentRow.result === 1 ? 'success' : 'danger'">
            {{ currentRow.result === 1 ? '成功' : '失败' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="详情">{{ currentRow.detail || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>

    <!-- 保存查询弹窗 -->
    <el-dialog v-model="saveQueryVisible" title="保存查询条件" width="420px">
      <el-form label-width="100px">
        <el-form-item label="查询名称">
          <el-input v-model="saveQueryName" placeholder="请输入查询条件名称" maxlength="20" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="saveQueryVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveQuery">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.admin-log {
  .search-card {
    margin-bottom: $spacing-md;
  }

  .saved-queries {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: $spacing-sm;
    padding-top: $spacing-sm;
    border-top: 1px dashed $border-light;

    &__label {
      font-size: $font-size-sm;
      color: $text-muted;
    }

    &__tag {
      cursor: pointer;

      .el-icon {
        margin-right: 2px;
      }
    }
  }
}
</style>
