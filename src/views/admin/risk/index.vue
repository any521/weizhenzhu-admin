<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { Search, RefreshRight, Download, Star } from '@element-plus/icons-vue'
import { api } from '@/api'
import AppCard from '@/components/AppCard.vue'
import AppHeader from '@/components/AppHeader.vue'
import AppTable, { type TableColumn } from '@/components/AppTable.vue'
import { formatDate, truncateText } from '@/utils/format'
import { exportToExcel, exportToCsv, type ExportColumn } from '@/utils/export'
import { downloadBlob } from '@/utils/download'
import { useSavedQueries, type SavedQuery } from '@/composables/useSavedQueries'
import type { RiskWarning } from '@/api/types'

// 风险等级映射
const levelMap: Record<string, { label: string; type: 'danger' | 'warning' | 'success' }> = {
  high: { label: '高', type: 'danger' },
  medium: { label: '中', type: 'warning' },
  low: { label: '低', type: 'success' },
}

// 风险类型选项
const typeOptions = [
  { value: 'order', label: '订单异常' },
  { value: 'payment', label: '支付异常' },
  { value: 'user', label: '用户异常' },
  { value: 'merchant', label: '商家异常' },
  { value: 'review', label: '评价异常' },
  { value: 'refund', label: '退款异常' },
]

// 搜索表单
interface SearchForm {
  type: string
  level: string
  status: number | undefined
  dateRange: string[]
}

const searchForm = reactive<SearchForm>({
  type: '',
  level: '',
  status: undefined,
  dateRange: [],
})

const loading = ref(false)
const exporting = ref(false)
const tableData = ref<RiskWarning[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)

// 排序
const sortField = ref<string>('')
const sortOrder = ref<'asc' | 'desc'>('asc')

// 批量选择
const selectedRows = ref<RiskWarning[]>([])

// 详情弹窗
const detailVisible = ref(false)
const currentRow = ref<RiskWarning | null>(null)

// 列定义
const columns: TableColumn[] = [
  { prop: 'id', label: 'ID', width: 80, sortable: true },
  { prop: 'type', label: '类型', width: 120 },
  { prop: 'target', label: '对象', minWidth: 180, showOverflowTooltip: true },
  { prop: 'level', label: '风险等级', width: 100 },
  { prop: 'description', label: '描述', minWidth: 220, showOverflowTooltip: true },
  { prop: 'createTime', label: '预警时间', minWidth: 170, sortable: true },
  { prop: 'status', label: '状态', width: 100 },
]

// 查询条件保存
const { savedQueries, saveQuery, deleteQuery, applyQuery } = useSavedQueries('admin_risk')

// 保存查询弹窗
const saveQueryVisible = ref(false)
const saveQueryName = ref('')

// 构造查询参数
function buildQueryParams() {
  return {
    page: page.value,
    pageSize: pageSize.value,
    type: searchForm.type || undefined,
    level: searchForm.level || undefined,
    status: searchForm.status,
    startDate: searchForm.dateRange?.[0],
    endDate: searchForm.dateRange?.[1],
    sortField: sortField.value || undefined,
    sortOrder: sortOrder.value,
  }
}

// 加载风控列表
async function loadList() {
  loading.value = true
  try {
    const res = await api.risk.getList(buildQueryParams())
    tableData.value = res.data.list
    total.value = res.data.total
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
  searchForm.type = ''
  searchForm.level = ''
  searchForm.status = undefined
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

// 批量选择变化
function handleSelectionChange(selection: RiskWarning[]) {
  selectedRows.value = selection
}

// 查看详情
function handleView(row: RiskWarning) {
  currentRow.value = row
  detailVisible.value = true
}

// 处理风控
async function handleHandle(row: RiskWarning) {
  try {
    await ElMessageBox.confirm(`确定已处理该风控预警吗？\n\n类型：${row.type}\n对象：${row.target}`, '提示', {
      type: 'warning',
      confirmButtonText: '确认处理',
      cancelButtonText: '取消',
    })
    await api.risk.handle(row.id, 1)
    ElMessage.success('处理成功')
    loadList()
  } catch {
    // 取消
  }
}

// 批量处理
async function handleBatchHandle() {
  if (selectedRows.value.length === 0) {
    ElMessage.warning('请先选择要处理的风控预警')
    return
  }
  const pendingRows = selectedRows.value.filter((r) => r.status === 0)
  if (pendingRows.length === 0) {
    ElMessage.warning('选中的预警均已处理')
    return
  }
  try {
    await ElMessageBox.confirm(`确定要批量处理选中的 ${pendingRows.length} 条风控预警吗？`, '提示', {
      type: 'warning',
      confirmButtonText: '确认处理',
      cancelButtonText: '取消',
    })
    await Promise.all(pendingRows.map((row) => api.risk.handle(row.id, 1)))
    ElMessage.success('批量处理成功')
    selectedRows.value = []
    loadList()
  } catch {
    // 取消
  }
}

// 导出
const exportColumns: ExportColumn[] = [
  { prop: 'id', label: 'ID' },
  { prop: 'type', label: '类型' },
  { prop: 'target', label: '对象' },
  { prop: 'level', label: '风险等级', formatter: (_row, v) => levelMap[v]?.label || v },
  { prop: 'description', label: '描述' },
  { prop: 'createTime', label: '预警时间' },
  { prop: 'status', label: '状态', formatter: (_row, v) => (v === 1 ? '已处理' : '待处理') },
]

async function handleExport(format: 'xlsx' | 'csv') {
  exporting.value = true
  try {
    // 优先调用后端导出接口
    try {
      const blob = await api.risk.export({ ...buildQueryParams(), format })
      downloadBlob(blob, `风控预警.${format}`, format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv;charset=utf-8;')
      ElMessage.success('导出成功')
      return
    } catch {
      // 后端不支持时降级为前端导出
    }
    const filename = `风控预警_${formatDate(new Date(), 'YYYYMMDD_HHmmss')}`
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
    !searchForm.type &&
    !searchForm.level &&
    searchForm.status === undefined &&
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
  <div class="admin-risk">
    <AppHeader title="风控管理" subtitle="平台风险预警与处理">
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
        <el-form-item label="类型">
          <el-select v-model="searchForm.type" placeholder="全部类型" clearable style="width: 140px">
            <el-option
              v-for="item in typeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="风险等级">
          <el-select v-model="searchForm.level" placeholder="全部等级" clearable style="width: 120px">
            <el-option label="高" value="high" />
            <el-option label="中" value="medium" />
            <el-option label="低" value="low" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部状态" clearable style="width: 120px">
            <el-option label="待处理" :value="0" />
            <el-option label="已处理" :value="1" />
          </el-select>
        </el-form-item>
        <el-form-item label="预警时间">
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
        selectable
        @page-change="loadList"
        @size-change="loadList"
        @sort-change="handleSortChange"
        @selection-change="handleSelectionChange"
      >
        <template #batch-actions>
          <el-button
            type="primary"
            :disabled="selectedRows.filter((r) => r.status === 0).length === 0"
            @click="handleBatchHandle"
          >
            批量处理 ({{ selectedRows.filter((r) => r.status === 0).length }})
          </el-button>
        </template>

        <template #cell-level="{ row }">
          <el-tag :type="levelMap[row.level]?.type || 'info'" effect="dark">
            {{ levelMap[row.level]?.label || row.level }}
          </el-tag>
        </template>

        <template #cell-description="{ row }">
          {{ truncateText(row.description, 30) }}
        </template>

        <template #cell-createTime="{ row }">
          {{ formatDate(row.createTime) }}
        </template>

        <template #cell-status="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'warning'">
            {{ row.status === 1 ? '已处理' : '待处理' }}
          </el-tag>
        </template>

        <template #append>
          <el-table-column label="操作" width="140" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="handleView(row)">查看</el-button>
              <el-button v-if="row.status === 0" link type="success" @click="handleHandle(row)">处理</el-button>
              <span v-else class="text-muted">已处理</span>
            </template>
          </el-table-column>
        </template>
      </AppTable>
    </AppCard>

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailVisible" title="风控预警详情" width="600px">
      <el-descriptions v-if="currentRow" :column="1" border>
        <el-descriptions-item label="ID">{{ currentRow.id }}</el-descriptions-item>
        <el-descriptions-item label="类型">{{ currentRow.type }}</el-descriptions-item>
        <el-descriptions-item label="对象">{{ currentRow.target }}</el-descriptions-item>
        <el-descriptions-item label="风险等级">
          <el-tag :type="levelMap[currentRow.level]?.type || 'info'" effect="dark">
            {{ levelMap[currentRow.level]?.label || currentRow.level }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="描述">{{ currentRow.description }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="currentRow.status === 1 ? 'success' : 'warning'">
            {{ currentRow.status === 1 ? '已处理' : '待处理' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="预警时间">{{ formatDate(currentRow.createTime) }}</el-descriptions-item>
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
.admin-risk {
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

  .text-muted {
    color: $text-muted;
    font-size: $font-size-sm;
  }
}
</style>
