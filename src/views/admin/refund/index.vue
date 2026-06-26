<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { Search, RefreshRight, Download, Star } from '@element-plus/icons-vue'
import { api } from '@/api'
import AppCard from '@/components/AppCard.vue'
import AppHeader from '@/components/AppHeader.vue'
import AppTable, { type TableColumn } from '@/components/AppTable.vue'
import { formatDate, formatAmount, truncateText } from '@/utils/format'
import { exportToExcel, exportToCsv, type ExportColumn } from '@/utils/export'
import { downloadBlob } from '@/utils/download'
import { useSavedQueries, type SavedQuery } from '@/composables/useSavedQueries'
import type { Refund } from '@/api/types'
import type { FormInstance } from 'element-plus'

// 退款状态
const RefundStatusMap: Record<number, string> = { 0: '待审核', 1: '已通过', 2: '已拒绝' }

// 搜索表单
interface SearchForm {
  refundNo: string
  orderNo: string
  status: number | undefined
  dateRange: string[]
}

const searchForm = reactive<SearchForm>({
  refundNo: '',
  orderNo: '',
  status: undefined,
  dateRange: [],
})

const loading = ref(false)
const exporting = ref(false)
const tableData = ref<Refund[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)

// 排序
const sortField = ref<string>('')
const sortOrder = ref<'asc' | 'desc'>('asc')

// 详情弹窗
const detailVisible = ref(false)
const currentRow = ref<Refund | null>(null)

// 拒绝弹窗
const rejectVisible = ref(false)
const rejectLoading = ref(false)
const rejectRef = ref<FormInstance>()
const rejectForm = reactive({
  id: 0,
  reason: '',
})

const rejectRules = {
  reason: [
    { required: true, message: '请输入拒绝原因', trigger: 'blur' },
    { min: 2, max: 200, message: '长度在 2 到 200 个字符', trigger: 'blur' },
  ],
}

// 列定义
const columns: TableColumn[] = [
  { prop: 'id', label: 'ID', width: 80, sortable: true },
  { prop: 'refundNo', label: '退款单号', minWidth: 180 },
  { prop: 'orderNo', label: '订单号', minWidth: 180 },
  { prop: 'userName', label: '用户', minWidth: 120 },
  { prop: 'merchantName', label: '商家', minWidth: 140 },
  { prop: 'amount', label: '退款金额', width: 120, sortable: true },
  { prop: 'reason', label: '退款原因', minWidth: 160, showOverflowTooltip: true },
  { prop: 'status', label: '状态', width: 100 },
  { prop: 'applyTime', label: '申请时间', minWidth: 170, sortable: true },
  { prop: 'auditTime', label: '审核时间', minWidth: 170 },
]

// 查询条件保存
const { savedQueries, saveQuery, deleteQuery, applyQuery } = useSavedQueries('admin_refund')

// 保存查询弹窗
const saveQueryVisible = ref(false)
const saveQueryName = ref('')

// 构造查询参数
function buildQueryParams() {
  return {
    page: page.value,
    pageSize: pageSize.value,
    refundNo: searchForm.refundNo || undefined,
    orderNo: searchForm.orderNo || undefined,
    status: searchForm.status,
    startDate: searchForm.dateRange?.[0],
    endDate: searchForm.dateRange?.[1],
    sortField: sortField.value || undefined,
    sortOrder: sortOrder.value,
  }
}

// 加载退款列表
async function loadList() {
  loading.value = true
  try {
    const res = await api.refund.getList(buildQueryParams())
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
  searchForm.refundNo = ''
  searchForm.orderNo = ''
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

// 查看详情
function handleView(row: Refund) {
  currentRow.value = row
  detailVisible.value = true
}

// 同意退款
async function handleApprove(row: Refund) {
  try {
    await ElMessageBox.confirm(`确定同意退款单「${row.refundNo || row.orderNo}」吗？退款金额 ${formatAmount(row.amount)}。`, '提示', {
      type: 'warning',
      confirmButtonText: '确认同意',
      cancelButtonText: '取消',
    })
    await api.refund.audit(row.id, 1)
    ElMessage.success('已同意退款')
    loadList()
  } catch {
    // 取消
  }
}

// 打开拒绝弹窗
function handleReject(row: Refund) {
  rejectForm.id = row.id
  rejectForm.reason = ''
  rejectVisible.value = true
}

// 确认拒绝
async function confirmReject() {
  const valid = await rejectRef.value?.validate().catch(() => false)
  if (!valid) return

  rejectLoading.value = true
  try {
    await api.refund.audit(rejectForm.id, 2, rejectForm.reason)
    ElMessage.success('已拒绝退款')
    rejectVisible.value = false
    loadList()
  } finally {
    rejectLoading.value = false
  }
}

// 导出
const exportColumns: ExportColumn[] = [
  { prop: 'id', label: 'ID' },
  { prop: 'refundNo', label: '退款单号' },
  { prop: 'orderNo', label: '订单号' },
  { prop: 'userName', label: '用户' },
  { prop: 'merchantName', label: '商家' },
  { prop: 'amount', label: '退款金额', formatter: (_row, v) => (v != null ? `¥${Number(v).toFixed(2)}` : '¥0.00') },
  { prop: 'reason', label: '退款原因' },
  { prop: 'status', label: '状态', formatter: (_row, v) => RefundStatusMap[v] || '未知' },
  { prop: 'applyTime', label: '申请时间' },
  { prop: 'auditTime', label: '审核时间' },
  { prop: 'auditor', label: '审核人' },
]

async function handleExport(format: 'xlsx' | 'csv') {
  exporting.value = true
  try {
    // 优先调用后端导出接口
    try {
      const blob = await api.refund.export({ ...buildQueryParams(), format })
      downloadBlob(blob, `退款列表.${format}`, format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv;charset=utf-8;')
      ElMessage.success('导出成功')
      return
    } catch {
      // 后端不支持时降级为前端导出
    }
    const filename = `退款列表_${formatDate(new Date(), 'YYYYMMDD_HHmmss')}`
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
    !searchForm.refundNo &&
    !searchForm.orderNo &&
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
  <div class="admin-refund">
    <AppHeader title="退款审核" subtitle="处理用户退款申请">
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
        <el-form-item label="退款单号">
          <el-input v-model="searchForm.refundNo" placeholder="请输入退款单号" clearable />
        </el-form-item>
        <el-form-item label="订单号">
          <el-input v-model="searchForm.orderNo" placeholder="请输入订单号" clearable />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部状态" clearable style="width: 140px">
            <el-option label="待审核" :value="0" />
            <el-option label="已通过" :value="1" />
            <el-option label="已拒绝" :value="2" />
          </el-select>
        </el-form-item>
        <el-form-item label="申请时间">
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
        <template #cell-amount="{ row }">
          <span class="amount">{{ formatAmount(row.amount) }}</span>
        </template>

        <template #cell-reason="{ row }">
          {{ truncateText(row.reason, 20) }}
        </template>

        <template #cell-status="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : row.status === 2 ? 'danger' : 'warning'">
            {{ RefundStatusMap[row.status] || '未知' }}
          </el-tag>
        </template>

        <template #cell-applyTime="{ row }">
          {{ formatDate(row.applyTime) }}
        </template>

        <template #cell-auditTime="{ row }">
          {{ row.auditTime ? formatDate(row.auditTime) : '-' }}
        </template>

        <template #append>
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="handleView(row)">查看</el-button>
              <template v-if="row.status === 0">
                <el-button link type="success" @click="handleApprove(row)">同意</el-button>
                <el-button link type="danger" @click="handleReject(row)">拒绝</el-button>
              </template>
              <span v-else class="text-muted">已处理</span>
            </template>
          </el-table-column>
        </template>
      </AppTable>
    </AppCard>

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailVisible" title="退款详情" width="600px">
      <el-descriptions v-if="currentRow" :column="1" border>
        <el-descriptions-item label="ID">{{ currentRow.id }}</el-descriptions-item>
        <el-descriptions-item label="退款单号">{{ currentRow.refundNo || '-' }}</el-descriptions-item>
        <el-descriptions-item label="订单号">{{ currentRow.orderNo }}</el-descriptions-item>
        <el-descriptions-item label="用户">{{ currentRow.userName }}</el-descriptions-item>
        <el-descriptions-item label="商家">{{ currentRow.merchantName }}</el-descriptions-item>
        <el-descriptions-item label="退款金额">
          <span class="amount">{{ formatAmount(currentRow.amount) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="退款原因">{{ currentRow.reason }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="currentRow.status === 1 ? 'success' : currentRow.status === 2 ? 'danger' : 'warning'">
            {{ RefundStatusMap[currentRow.status] || '未知' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="申请时间">{{ formatDate(currentRow.applyTime) }}</el-descriptions-item>
        <el-descriptions-item label="审核时间">{{ currentRow.auditTime ? formatDate(currentRow.auditTime) : '-' }}</el-descriptions-item>
        <el-descriptions-item label="审核人">{{ currentRow.auditor || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>

    <!-- 拒绝弹窗 -->
    <el-dialog v-model="rejectVisible" title="拒绝退款" width="460px">
      <el-form ref="rejectRef" :model="rejectForm" :rules="rejectRules" label-width="80px">
        <el-form-item label="拒绝原因" prop="reason">
          <el-input
            v-model="rejectForm.reason"
            type="textarea"
            :rows="4"
            placeholder="请输入拒绝原因（2-200 字）"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectVisible = false">取消</el-button>
        <el-button type="danger" :loading="rejectLoading" @click="confirmReject">确认拒绝</el-button>
      </template>
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
.admin-refund {
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

  .amount {
    color: $danger;
    font-weight: 600;
  }

  .text-muted {
    color: $text-muted;
    font-size: $font-size-sm;
  }
}
</style>
