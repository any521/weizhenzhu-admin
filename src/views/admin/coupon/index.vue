<script setup lang="ts">
import { ref, onMounted, reactive, computed } from 'vue'
import { Plus, Search, RefreshRight, Download, Delete, Star } from '@element-plus/icons-vue'
import { api } from '@/api'
import AppCard from '@/components/AppCard.vue'
import AppHeader from '@/components/AppHeader.vue'
import AppTable, { type TableColumn } from '@/components/AppTable.vue'
import { formatAmount, formatDate, mapStatus } from '@/utils/format'
import { CommonStatusMap } from '@/utils/constants'
import { exportToExcel, exportToCsv, type ExportColumn } from '@/utils/export'
import { downloadBlob } from '@/utils/download'
import { useSavedQueries, type SavedQuery } from '@/composables/useSavedQueries'
import type { Coupon, CouponCreateDTO, CouponType } from '@/api/types'
import type { FormInstance, FormRules } from 'element-plus'

const couponTypeMap: Record<number, string> = {
  1: '满减券',
  2: '折扣券',
  3: '代金券',
}

const validTypeMap: Record<number, string> = {
  1: '固定时间',
  2: '领取后生效',
}

const scopeMap: Record<number, string> = {
  1: '全场通用',
  2: '指定商家',
  3: '指定类目',
}

// 搜索表单
interface SearchForm {
  keyword: string
  type: number | undefined
  status: number | undefined
  ownerType: number | undefined
}

const ownerTypeMap: Record<number, string> = {
  0: '系统券',
  1: '商家券',
}

const searchForm = reactive<SearchForm>({
  keyword: '',
  type: undefined,
  status: undefined,
  ownerType: undefined,
})

const loading = ref(false)
const exporting = ref(false)
const tableData = ref<Coupon[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)

// 排序
const sortField = ref<string>('')
const sortOrder = ref<'asc' | 'desc'>('asc')

// 批量选择
const selectedRows = ref<Coupon[]>([])

// 表单弹窗
const dialogVisible = ref(false)
const formLoading = ref(false)
const isEdit = computed(() => !!form.id)
const form = reactive<Partial<Coupon>>({
  name: '',
  type: 1,
  amount: undefined,
  threshold: undefined,
  discount: undefined,
  maxDiscount: undefined,
  totalCount: undefined,
  perLimit: 1,
  validType: 1,
  validStart: '',
  validEnd: '',
  validDays: undefined,
  scope: 1,
})
const formRef = ref<FormInstance>()

const isFullReduction = computed(() => form.type === 1 || form.type === 3)
const isDiscount = computed(() => form.type === 2)

const rules = computed<FormRules>(() => ({
  name: [{ required: true, message: '请输入优惠券名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择优惠券类型', trigger: 'change' }],
  amount: isFullReduction.value
    ? [{ required: true, message: '请输入优惠金额', trigger: 'blur' }]
    : [],
  threshold: form.type === 1
    ? [{ required: true, message: '请输入使用门槛', trigger: 'blur' }]
    : [],
  discount: isDiscount.value
    ? [{ required: true, message: '请输入折扣', trigger: 'blur' }]
    : [],
  totalCount: [{ required: true, message: '请输入发放数量', trigger: 'blur' }],
  validType: [{ required: true, message: '请选择有效期类型', trigger: 'change' }],
  validStart: form.validType === 1
    ? [{ required: true, message: '请选择开始时间', trigger: 'change' }]
    : [],
  validEnd: form.validType === 1
    ? [{ required: true, message: '请选择结束时间', trigger: 'change' }]
    : [],
  validDays: form.validType === 2
    ? [{ required: true, message: '请输入有效天数', trigger: 'blur' }]
    : [],
}))

// 列定义
const columns: TableColumn[] = [
  { prop: 'name', label: '名称', minWidth: 160 },
  { prop: 'merchantName', label: '归属商家', width: 120 },
  { prop: 'type', label: '类型', width: 100 },
  { prop: 'totalCount', label: '发放/已领', width: 120 },
  { prop: 'scope', label: '适用范围', width: 110 },
  { prop: 'status', label: '状态', width: 90 },
  { prop: 'createdAt', label: '创建时间', minWidth: 170, sortable: true },
]

// 查询条件保存
const { savedQueries, saveQuery, deleteQuery, applyQuery } = useSavedQueries('admin_coupon')

// 保存查询弹窗
const saveQueryVisible = ref(false)
const saveQueryName = ref('')

// 构造查询参数
function buildQueryParams() {
  // ownerType: 0=系统券(merchantId=0), 1=商家券(merchantId>0), undefined=全部
  let merchantId: number | undefined
  if (searchForm.ownerType === 0) {
    merchantId = 0
  } else if (searchForm.ownerType === 1) {
    merchantId = -1 // 后端用 -1 表示查询商家券（merchantId > 0）
  }
  return {
    page: page.value,
    pageSize: pageSize.value,
    keyword: searchForm.keyword || undefined,
    type: searchForm.type,
    status: searchForm.status,
    merchantId,
    sortField: sortField.value || undefined,
    sortOrder: sortOrder.value,
  }
}

async function loadList() {
  loading.value = true
  try {
    const res = await api.coupon.getList(buildQueryParams())
    tableData.value = res.data.list
    total.value = res.data.total
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  page.value = 1
  loadList()
}

function handleReset() {
  searchForm.keyword = ''
  searchForm.type = undefined
  searchForm.status = undefined
  searchForm.ownerType = undefined
  sortField.value = ''
  handleSearch()
}

function handleSortChange({ prop, order }: { prop: string; order: 'ascending' | 'descending' | null }) {
  if (order) {
    sortField.value = prop
    sortOrder.value = order === 'ascending' ? 'asc' : 'desc'
  } else {
    sortField.value = ''
  }
  loadList()
}

function handleSelectionChange(selection: Coupon[]) {
  selectedRows.value = selection
}

function resetForm() {
  Object.assign(form, {
    id: undefined,
    name: '',
    type: 1,
    amount: undefined,
    threshold: undefined,
    discount: undefined,
    maxDiscount: undefined,
    totalCount: undefined,
    perLimit: 1,
    validType: 1,
    validStart: '',
    validEnd: '',
    validDays: undefined,
    scope: 1,
  })
}

function handleAdd() {
  resetForm()
  dialogVisible.value = true
}

async function handleEdit(row: Coupon) {
  resetForm()
  try {
    const res = await api.coupon.getDetail(row.id as number)
    Object.assign(form, {
      ...res.data,
      validStart: res.data.validStart ? formatDate(res.data.validStart, 'YYYY-MM-DD HH:mm:ss') : '',
      validEnd: res.data.validEnd ? formatDate(res.data.validEnd, 'YYYY-MM-DD HH:mm:ss') : '',
    })
  } catch {
    Object.assign(form, {
      ...row,
      validStart: row.validStart ? formatDate(row.validStart, 'YYYY-MM-DD HH:mm:ss') : '',
      validEnd: row.validEnd ? formatDate(row.validEnd, 'YYYY-MM-DD HH:mm:ss') : '',
    })
  }
  dialogVisible.value = true
}

async function handleStop(row: Coupon) {
  try {
    await ElMessageBox.confirm('确定停用该优惠券吗？', '提示', { type: 'warning' })
    await api.coupon.updateStatus(row.id as number, 0)
    row.status = 0
    ElMessage.success('已停用')
  } catch {
    // 取消
  }
}

async function handleActivate(row: Coupon) {
  try {
    await ElMessageBox.confirm('确定启用该优惠券吗？', '提示', { type: 'warning' })
    await api.coupon.updateStatus(row.id as number, 1)
    row.status = 1
    ElMessage.success('已启用')
  } catch {
    // 取消
  }
}

async function handleDelete(row: Coupon) {
  try {
    await ElMessageBox.confirm(`确定删除优惠券「${row.name}」吗？`, '提示', {
      type: 'warning',
      confirmButtonText: '确认',
      cancelButtonText: '取消',
    })
    await api.coupon.delete(row.id as number)
    ElMessage.success('删除成功')
    loadList()
  } catch {
    // 取消
  }
}

async function handleBatchDelete() {
  if (selectedRows.value.length === 0) {
    ElMessage.warning('请先选择要删除的优惠券')
    return
  }
  try {
    await ElMessageBox.confirm(`确定要删除选中的 ${selectedRows.value.length} 个优惠券吗？`, '提示', {
      type: 'warning',
      confirmButtonText: '确认',
      cancelButtonText: '取消',
    })
    await Promise.all(selectedRows.value.map((row) => api.coupon.delete(row.id as number)))
    ElMessage.success('批量删除成功')
    selectedRows.value = []
    loadList()
  } catch {
    // 取消
  }
}

async function handleSave() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  formLoading.value = true
  try {
    const payload: CouponCreateDTO = {
      merchantId: 0,
      name: form.name as string,
      type: form.type as CouponType,
      totalCount: form.totalCount as number,
      perLimit: form.perLimit ?? 1,
      validType: form.validType as 1 | 2,
      scope: form.scope ?? 1,
    }

    if (isFullReduction.value) {
      payload.amount = form.amount
    }
    if (form.type === 1) {
      payload.threshold = form.threshold
    }
    if (isDiscount.value) {
      payload.discount = form.discount
      payload.maxDiscount = form.maxDiscount
    }
    if (form.validType === 1) {
      payload.validStart = form.validStart
      payload.validEnd = form.validEnd
    } else {
      payload.validDays = form.validDays
    }

    if (form.id) {
      await api.coupon.update(form.id, payload)
      ElMessage.success('更新成功')
    } else {
      await api.coupon.add(payload)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadList()
  } finally {
    formLoading.value = false
  }
}

function formatCouponValue(row: Coupon) {
  if (row.type === 2 && row.discount != null) {
    return `${(row.discount * 10).toFixed(1)}折`
  }
  if (row.amount != null) {
    return formatAmount(row.amount)
  }
  return '-'
}

function formatThreshold(row: Coupon) {
  if (row.threshold != null && row.threshold > 0) {
    return `满${formatAmount(row.threshold)}可用`
  }
  return '无门槛'
}

function formatValidTime(row: Coupon) {
  if (row.validType === 2 && row.validDays != null) {
    return `领取后${row.validDays}天有效`
  }
  const start = row.validStart ? formatDate(row.validStart, 'YYYY-MM-DD HH:mm') : '-'
  const end = row.validEnd ? formatDate(row.validEnd, 'YYYY-MM-DD HH:mm') : '-'
  return `${start} 至 ${end}`
}

// 导出
const exportColumns: ExportColumn[] = [
  { prop: 'name', label: '名称' },
  { prop: 'merchantName', label: '归属商家' },
  { prop: 'type', label: '类型', formatter: (_row, v) => couponTypeMap[v] || v },
  { prop: 'amount', label: '优惠金额', formatter: (row, v) => formatCouponValue(row as Coupon) || (v != null ? formatAmount(v) : '-') },
  { prop: 'threshold', label: '门槛', formatter: (row) => formatThreshold(row as Coupon) },
  { prop: 'totalCount', label: '发放数量' },
  { prop: 'receivedCount', label: '已领取' },
  { prop: 'usedCount', label: '已使用' },
  { prop: 'validType', label: '有效期类型', formatter: (_row, v) => validTypeMap[v] || v },
  { prop: 'scope', label: '适用范围', formatter: (_row, v) => scopeMap[v || 1] || v },
  { prop: 'status', label: '状态', formatter: (_row, v) => mapStatus(v, CommonStatusMap) },
  { prop: 'createdAt', label: '创建时间', formatter: (_row, v) => formatDate(v) },
]

async function handleExport(format: 'xlsx' | 'csv') {
  exporting.value = true
  try {
    try {
      const blob = await api.coupon.export({ ...buildQueryParams(), format })
      downloadBlob(blob, `优惠券列表.${format}`, format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv;charset=utf-8;')
      ElMessage.success('导出成功')
      return
    } catch {
      // 后端不支持时降级为前端导出
    }
    const filename = `优惠券列表_${formatDate(new Date(), 'YYYYMMDD_HHmmss')}`
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

function openSaveQuery() {
  if (!searchForm.keyword && searchForm.type === undefined && searchForm.status === undefined && searchForm.ownerType === undefined) {
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
  <div class="admin-coupon">
    <AppHeader title="优惠券管理" subtitle="管理平台优惠券活动">
      <el-button type="primary" :icon="Plus" @click="handleAdd">新增优惠券</el-button>
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
        <el-form-item label="名称">
          <el-input v-model="searchForm.keyword" placeholder="优惠券名称" clearable />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="searchForm.type" placeholder="全部类型" clearable style="width: 120px">
            <el-option label="满减券" :value="1" />
            <el-option label="折扣券" :value="2" />
            <el-option label="代金券" :value="3" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部状态" clearable style="width: 120px">
            <el-option label="启用" :value="1" />
            <el-option label="停用" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item label="归属">
          <el-select v-model="searchForm.ownerType" placeholder="全部" clearable style="width: 120px">
            <el-option label="系统券" :value="0" />
            <el-option label="商家券" :value="1" />
          </el-select>
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
        selectable
        @page-change="loadList"
        @size-change="loadList"
        @sort-change="handleSortChange"
        @selection-change="handleSelectionChange"
      >
        <template #batch-actions>
          <el-button
            type="danger"
            :icon="Delete"
            :disabled="selectedRows.length === 0"
            @click="handleBatchDelete"
          >
            批量删除 ({{ selectedRows.length }})
          </el-button>
        </template>

        <template #cell-type="{ row }">
          {{ couponTypeMap[row.type] || row.type }}
        </template>

        <template #cell-totalCount="{ row }">
          {{ row.receivedCount || 0 }} / {{ row.totalCount }}
        </template>

        <template #cell-scope="{ row }">
          {{ scopeMap[row.scope || 1] || row.scope }}
        </template>

        <template #cell-merchantName="{ row }">
          {{ row.merchantName || (row.merchantId === 0 ? '系统券' : '-') }}
        </template>

        <template #cell-status="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'info'">
            {{ mapStatus(row.status, CommonStatusMap) }}
          </el-tag>
        </template>

        <template #cell-createdAt="{ row }">
          {{ formatDate(row.createdAt) }}
        </template>

        <template #append>
          <el-table-column label="优惠/门槛" min-width="160">
            <template #default="{ row }">
              <div>{{ formatCouponValue(row) }}</div>
              <div class="text-muted">{{ formatThreshold(row) }}</div>
            </template>
          </el-table-column>
          <el-table-column label="有效期" min-width="220">
            <template #default="{ row }">
              {{ formatValidTime(row) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="180" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="handleEdit(row)">编辑</el-button>
              <el-button v-if="row.status === 1" link type="danger" @click="handleStop(row)">停用</el-button>
              <el-button v-else link type="success" @click="handleActivate(row)">启用</el-button>
              <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </template>
      </AppTable>
    </AppCard>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑优惠券' : '新增优惠券'" width="560px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="优惠券名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入优惠券名称" />
        </el-form-item>
        <el-form-item label="类型" prop="type">
          <el-select v-model="form.type" placeholder="请选择类型" style="width: 100%">
            <el-option label="满减券" :value="1" />
            <el-option label="折扣券" :value="2" />
            <el-option label="代金券" :value="3" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="isFullReduction" label="优惠金额" prop="amount">
          <el-input-number v-model="form.amount" :min="0.01" :step="1" :precision="2" style="width: 100%" placeholder="单位：元" />
        </el-form-item>
        <el-form-item v-if="form.type === 1" label="使用门槛" prop="threshold">
          <el-input-number v-model="form.threshold" :min="0.01" :step="1" :precision="2" style="width: 100%" placeholder="满多少元可用" />
        </el-form-item>
        <el-form-item v-if="isDiscount" label="折扣" prop="discount">
          <el-input-number v-model="form.discount" :min="0.01" :max="0.99" :step="0.05" :precision="2" style="width: 100%" placeholder="0.8 表示 8 折" />
        </el-form-item>
        <el-form-item v-if="isDiscount" label="最大优惠">
          <el-input-number v-model="form.maxDiscount" :min="0" :step="1" :precision="2" style="width: 100%" placeholder="单位：元，不填则无上限" />
        </el-form-item>
        <el-form-item label="发放数量" prop="totalCount">
          <el-input-number v-model="form.totalCount" :min="1" :step="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="每人限领">
          <el-input-number v-model="form.perLimit" :min="1" :step="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="有效期类型" prop="validType">
          <el-radio-group v-model="form.validType">
            <el-radio :label="1">固定时间</el-radio>
            <el-radio :label="2">领取后生效</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="form.validType === 1" label="有效时间" prop="validStart">
          <el-col :span="11">
            <el-date-picker v-model="form.validStart" type="datetime" placeholder="开始时间" style="width: 100%" value-format="YYYY-MM-DD HH:mm:ss" />
          </el-col>
          <el-col :span="2" class="text-center">-</el-col>
          <el-col :span="11">
            <el-date-picker v-model="form.validEnd" type="datetime" placeholder="结束时间" style="width: 100%" value-format="YYYY-MM-DD HH:mm:ss" />
          </el-col>
        </el-form-item>
        <el-form-item v-if="form.validType === 2" label="有效天数" prop="validDays">
          <el-input-number v-model="form.validDays" :min="1" :step="1" style="width: 100%" placeholder="领取后 N 天内有效" />
        </el-form-item>
        <el-form-item label="适用范围">
          <el-select v-model="form.scope" placeholder="请选择适用范围" style="width: 100%">
            <el-option label="全场通用" :value="1" />
            <el-option label="指定商家" :value="2" />
            <el-option label="指定类目" :value="3" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="formLoading" @click="handleSave">保存</el-button>
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
.admin-coupon {
  .search-card {
    margin-bottom: $spacing-md;
  }

  .text-center {
    text-align: center;
    color: $text-muted;
  }

  .text-muted {
    color: $text-muted;
    font-size: 12px;
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
