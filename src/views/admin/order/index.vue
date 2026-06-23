<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { Search, RefreshRight, Download, Star } from '@element-plus/icons-vue'
import { api } from '@/api'
import AppCard from '@/components/AppCard.vue'
import AppHeader from '@/components/AppHeader.vue'
import AppTable, { type TableColumn } from '@/components/AppTable.vue'
import { formatAmount, formatDate, mapStatus } from '@/utils/format'
import { OrderStatusMap, OrderStatus } from '@/utils/constants'
import { exportToExcel, exportToCsv, type ExportColumn } from '@/utils/export'
import { downloadBlob } from '@/utils/download'
import { useSavedQueries, type SavedQuery } from '@/composables/useSavedQueries'
import type { Order } from '@/api/types'

// 搜索表单
interface SearchForm {
  orderNo: string
  merchantName: string
  userName: string
  status: number | undefined
  payStatus: number | undefined
  payType: number | undefined
  dateRange: string[]
}

const searchForm = reactive<SearchForm>({
  orderNo: '',
  merchantName: '',
  userName: '',
  status: undefined,
  payStatus: undefined,
  payType: undefined,
  dateRange: [],
})

const loading = ref(false)
const exporting = ref(false)
const tableData = ref<Order[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)

// 排序
const sortField = ref<string>('')
const sortOrder = ref<'asc' | 'desc'>('asc')

// 详情弹窗
const detailVisible = ref(false)
const currentRow = ref<Order | null>(null)

// 列定义
const columns: TableColumn[] = [
  { prop: 'orderNo', label: '订单号', minWidth: 180, showOverflowTooltip: true },
  { prop: 'merchantName', label: '商家', minWidth: 140, showOverflowTooltip: true },
  { prop: 'userName', label: '用户', minWidth: 120 },
  { prop: 'payAmount', label: '支付金额', width: 120, sortable: true },
  { prop: 'payType', label: '支付方式', width: 110 },
  { prop: 'status', label: '状态', width: 110 },
  { prop: 'createTime', label: '下单时间', minWidth: 170, sortable: true },
  { prop: 'completeTime', label: '完成时间', minWidth: 170, sortable: true },
]

// 查询条件保存
const { savedQueries, saveQuery, deleteQuery, applyQuery } = useSavedQueries('admin_order')

// 保存查询弹窗
const saveQueryVisible = ref(false)
const saveQueryName = ref('')

// 构造查询参数
function buildQueryParams() {
  return {
    current: page.value,
    size: pageSize.value,
    orderNo: searchForm.orderNo || undefined,
    merchantName: searchForm.merchantName || undefined,
    userName: searchForm.userName || undefined,
    status: searchForm.status,
    payStatus: searchForm.payStatus,
    payType: searchForm.payType,
    startDate: searchForm.dateRange?.[0],
    endDate: searchForm.dateRange?.[1],
    sortField: sortField.value || undefined,
    sortOrder: sortOrder.value,
  }
}

// 加载订单列表
async function loadList() {
  loading.value = true
  try {
    const res = await api.order.getList(buildQueryParams())
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
  searchForm.orderNo = ''
  searchForm.merchantName = ''
  searchForm.userName = ''
  searchForm.status = undefined
  searchForm.payStatus = undefined
  searchForm.payType = undefined
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
async function handleView(row: Order) {
  try {
    const res = await api.order.getDetail(row.id)
    currentRow.value = res.data
  } catch {
    currentRow.value = row
  }
  detailVisible.value = true
}

// 取消订单
async function handleCancel(row: Order) {
  try {
    await ElMessageBox.confirm(`确定取消订单「${row.orderNo}」吗？`, '提示', { type: 'warning' })
    await api.order.updateStatus(row.id, OrderStatus.CANCELLED)
    ElMessage.success('订单已取消')
    loadList()
  } catch {
    // 取消
  }
}

// 导出
const exportColumns: ExportColumn[] = [
  { prop: 'orderNo', label: '订单号' },
  { prop: 'merchantName', label: '商家' },
  { prop: 'userName', label: '用户' },
  { prop: 'payAmount', label: '实付金额', formatter: (_row, v) => formatAmount(v) },
  { prop: 'totalAmount', label: '订单金额', formatter: (_row, v) => formatAmount(v) },
  { prop: 'deliveryFee', label: '配送费', formatter: (_row, v) => formatAmount(v) },
  { prop: 'discountAmount', label: '优惠金额', formatter: (_row, v) => formatAmount(v) },
  { prop: 'payType', label: '支付方式', formatter: (_row, v) => getPayTypeText(v) },
  { prop: 'status', label: '订单状态', formatter: (_row, v) => mapStatus(v, OrderStatusMap) },
  { prop: 'createTime', label: '下单时间', formatter: (_row, v) => formatDate(v) },
  { prop: 'completeTime', label: '完成时间', formatter: (_row, v) => formatDate(v) },
]

async function handleExport(format: 'xlsx' | 'csv') {
  exporting.value = true
  try {
    try {
      const blob = await api.order.export({ ...buildQueryParams(), format })
      downloadBlob(blob, `订单列表.${format}`, format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv;charset=utf-8;')
      ElMessage.success('导出成功')
      return
    } catch {
      // 后端不支持时降级为前端导出
    }
    const filename = `订单列表_${formatDate(new Date(), 'YYYYMMDD_HHmmss')}`
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
  if (!searchForm.orderNo && !searchForm.merchantName && !searchForm.userName && searchForm.status === undefined && searchForm.payStatus === undefined && searchForm.payType === undefined && (!searchForm.dateRange || searchForm.dateRange.length === 0)) {
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

// 状态标签类型
function getStatusType(status: number) {
  if (status === OrderStatus.COMPLETED) return 'success'
  if (status === OrderStatus.CANCELLED || status === OrderStatus.REFUNDED) return 'info'
  if (status === OrderStatus.PENDING_PAY || status === OrderStatus.PENDING_ACCEPT) return 'warning'
  if (status === OrderStatus.REFUNDING) return 'danger'
  return 'primary'
}

// 支付方式映射：1微信 2支付宝 3余额 4货到付款
const PayTypeMap: Record<number, string> = {
  1: '微信支付',
  2: '支付宝',
  3: '余额支付',
  4: '货到付款',
}

function getPayTypeText(payType?: number) {
  if (payType === undefined || payType === null) return '-'
  return PayTypeMap[payType] || '其他'
}

function getPayTypeTagType(payType?: number) {
  if (payType === 1) return 'success'
  if (payType === 2) return 'primary'
  if (payType === 3) return 'warning'
  if (payType === 4) return 'info'
  return ''
}

onMounted(loadList)
</script>

<template>
  <div class="admin-order">
    <AppHeader title="订单管理" subtitle="管理平台全部订单">
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
        <el-form-item label="订单号">
          <el-input v-model="searchForm.orderNo" placeholder="请输入订单号" clearable />
        </el-form-item>
        <el-form-item label="商家">
          <el-input v-model="searchForm.merchantName" placeholder="请输入商家名称" clearable />
        </el-form-item>
        <el-form-item label="用户">
          <el-input v-model="searchForm.userName" placeholder="请输入用户名称" clearable />
        </el-form-item>
        <el-form-item label="订单状态">
          <el-select v-model="searchForm.status" placeholder="全部状态" clearable style="width: 140px">
            <el-option v-for="(label, key) in OrderStatusMap" :key="key" :label="label" :value="Number(key)" />
          </el-select>
        </el-form-item>
        <el-form-item label="支付方式">
          <el-select v-model="searchForm.payType" placeholder="全部支付方式" clearable style="width: 140px">
            <el-option label="微信支付" :value="1" />
            <el-option label="支付宝" :value="2" />
            <el-option label="余额支付" :value="3" />
            <el-option label="货到付款" :value="4" />
          </el-select>
        </el-form-item>
        <el-form-item label="支付状态">
          <el-select v-model="searchForm.payStatus" placeholder="全部" clearable style="width: 120px">
            <el-option label="未支付" :value="0" />
            <el-option label="已支付" :value="1" />
            <el-option label="已退款" :value="2" />
          </el-select>
        </el-form-item>
        <el-form-item label="下单时间">
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
        <template #cell-payAmount="{ row }">
          <span class="amount">{{ formatAmount(row.payAmount) }}</span>
        </template>

        <template #cell-payType="{ row }">
          <el-tag v-if="row.payType" :type="getPayTypeTagType(row.payType)" effect="plain" size="small">
            {{ getPayTypeText(row.payType) }}
          </el-tag>
          <span v-else class="text-muted">-</span>
        </template>

        <template #cell-status="{ row }">
          <el-tag :type="getStatusType(row.status)">
            {{ row.statusDesc || mapStatus(row.status, OrderStatusMap) }}
          </el-tag>
        </template>

        <template #cell-createTime="{ row }">
          {{ formatDate(row.createTime) }}
        </template>

        <template #cell-completeTime="{ row }">
          {{ formatDate(row.completeTime) }}
        </template>

        <template #append>
          <el-table-column label="操作" width="150" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="handleView(row)">查看</el-button>
              <el-button
                v-if="row.status !== OrderStatus.CANCELLED && row.status !== OrderStatus.COMPLETED && row.status !== OrderStatus.REFUNDED"
                link
                type="danger"
                @click="handleCancel(row)"
              >
                取消
              </el-button>
            </template>
          </el-table-column>
        </template>
      </AppTable>
    </AppCard>

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailVisible" title="订单详情" width="640px">
      <el-descriptions v-if="currentRow" :column="2" border>
        <el-descriptions-item label="订单号" :span="2">{{ currentRow.orderNo }}</el-descriptions-item>
        <el-descriptions-item label="商家">{{ currentRow.merchantName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="用户">{{ currentRow.userNickname || currentRow.userName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="骑手">{{ currentRow.riderName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="支付方式">
          <el-tag v-if="currentRow.payType" :type="getPayTypeTagType(currentRow.payType)" effect="plain" size="small">
            {{ getPayTypeText(currentRow.payType) }}
          </el-tag>
          <span v-else>-</span>
        </el-descriptions-item>
        <el-descriptions-item label="订单金额">{{ formatAmount(currentRow.totalAmount) }}</el-descriptions-item>
        <el-descriptions-item label="实付金额">{{ formatAmount(currentRow.payAmount) }}</el-descriptions-item>
        <el-descriptions-item label="配送费">{{ formatAmount(currentRow.deliveryFee) }}</el-descriptions-item>
        <el-descriptions-item label="优惠金额">{{ formatAmount(currentRow.discountAmount) }}</el-descriptions-item>
        <el-descriptions-item label="状态" :span="2">
          <el-tag :type="getStatusType(currentRow.status)">
            {{ currentRow.statusDesc || mapStatus(currentRow.status, OrderStatusMap) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ currentRow.remark || '-' }}</el-descriptions-item>
        <el-descriptions-item label="下单时间">{{ formatDate(currentRow.createTime) }}</el-descriptions-item>
        <el-descriptions-item label="支付时间">{{ formatDate(currentRow.payTime) }}</el-descriptions-item>
        <el-descriptions-item label="完成时间">{{ formatDate(currentRow.completeTime) }}</el-descriptions-item>
        <el-descriptions-item label="取消时间">{{ formatDate(currentRow.cancelTime) }}</el-descriptions-item>
      </el-descriptions>

      <div v-if="currentRow?.items && currentRow.items.length > 0" class="order-items">
        <h4 class="order-items__title">订单商品</h4>
        <el-table :data="currentRow.items" border size="small">
          <el-table-column prop="dishName" label="菜品" min-width="160" />
          <el-table-column prop="specName" label="规格" min-width="120" />
          <el-table-column label="单价" width="100">
            <template #default="{ row }">{{ formatAmount(row.unitPrice) }}</template>
          </el-table-column>
          <el-table-column prop="quantity" label="数量" width="80" />
          <el-table-column label="小计" width="100">
            <template #default="{ row }">{{ formatAmount(row.subtotal) }}</template>
          </el-table-column>
        </el-table>
      </div>
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
.admin-order {
  .search-card {
    margin-bottom: $spacing-md;
  }

  .amount {
    color: $primary;
    font-weight: 600;
  }

  .text-muted {
    color: $text-muted;
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

  .order-items {
    margin-top: $spacing-md;

    &__title {
      font-size: $font-size-md;
      font-weight: 600;
      margin-bottom: $spacing-sm;
      color: $text;
    }
  }
}
</style>
