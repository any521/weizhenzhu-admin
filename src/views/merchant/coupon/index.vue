<script setup lang="ts">
import { ref, onMounted, reactive, computed } from 'vue'
import { Plus, Search, RefreshRight } from '@element-plus/icons-vue'
import { api } from '@/api'
import AppCard from '@/components/AppCard.vue'
import AppHeader from '@/components/AppHeader.vue'
import AppTable, { type TableColumn } from '@/components/AppTable.vue'
import { formatAmount, formatDate, mapStatus } from '@/utils/format'
import { CommonStatusMap } from '@/utils/constants'
import type { Coupon, CouponCreateDTO, CouponUpdateDTO, CouponType } from '@/api/types'
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
  2: '本店专用',
  3: '指定类目',
}

// 搜索表单
interface SearchForm {
  keyword: string
  type: number | undefined
  status: number | undefined
}

const searchForm = reactive<SearchForm>({
  keyword: '',
  type: undefined,
  status: undefined,
})

const loading = ref(false)
const tableData = ref<Coupon[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)

// 排序
const sortField = ref<string>('')
const sortOrder = ref<'asc' | 'desc'>('asc')

// 统计
const stats = reactive({
  totalCoupon: 0,
  activeCoupon: 0,
  totalReceived: 0,
  totalUsed: 0,
  totalStock: 0,
})

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
  { prop: 'type', label: '类型', width: 100 },
  { prop: 'totalCount', label: '发放/已领', width: 120 },
  { prop: 'scope', label: '适用范围', width: 110 },
  { prop: 'status', label: '状态', width: 90 },
  { prop: 'createdAt', label: '创建时间', minWidth: 170, sortable: true },
]

// 构造查询参数
function buildQueryParams() {
  return {
    page: page.value,
    pageSize: pageSize.value,
    keyword: searchForm.keyword || undefined,
    type: searchForm.type,
    status: searchForm.status,
    sortField: sortField.value || undefined,
    sortOrder: sortOrder.value,
  }
}

async function loadList() {
  loading.value = true
  try {
    const res = await api.merchantCoupon.getList(buildQueryParams())
    tableData.value = res.data.list
    total.value = res.data.total
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    const res = await api.merchantCoupon.stats()
    Object.assign(stats, res.data)
  } catch {
    // ignore
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
    const res = await api.merchantCoupon.getDetail(row.id as number)
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
    await api.merchantCoupon.updateStatus(row.id as number, 0)
    row.status = 0
    ElMessage.success('已停用')
  } catch {
    // 取消
  }
}

async function handleActivate(row: Coupon) {
  try {
    await ElMessageBox.confirm('确定启用该优惠券吗？', '提示', { type: 'warning' })
    await api.merchantCoupon.updateStatus(row.id as number, 1)
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
    await api.merchantCoupon.delete(row.id as number)
    ElMessage.success('删除成功')
    loadList()
    loadStats()
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
      await api.merchantCoupon.update(form.id, payload as CouponUpdateDTO)
      ElMessage.success('更新成功')
    } else {
      await api.merchantCoupon.add(payload)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadList()
    loadStats()
  } finally {
    formLoading.value = false
  }
}

function formatCouponValue(row: Coupon) {
  if (row.type === 2 && row.discount != null) {
    return `${(row.discount * 10).toFixed(1)}折`
  }
  if (row.amount != null) {
    return `¥${formatAmount(row.amount)}`
  }
  return '-'
}

function formatThreshold(row: Coupon) {
  if (row.threshold != null && row.threshold > 0) {
    return `满¥${formatAmount(row.threshold)}可用`
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

onMounted(() => {
  loadList()
  loadStats()
})
</script>

<template>
  <div class="merchant-coupon">
    <AppHeader title="优惠券管理" subtitle="创建并管理本店专属优惠券">
      <el-button type="primary" :icon="Plus" @click="handleAdd">新增优惠券</el-button>
    </AppHeader>

    <!-- 统计卡片 -->
    <AppCard class="stats-card">
      <el-row :gutter="16">
        <el-col :span="4">
          <div class="stat-item">
            <div class="stat-value">{{ stats.totalCoupon }}</div>
            <div class="stat-label">优惠券总数</div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="stat-item">
            <div class="stat-value">{{ stats.activeCoupon }}</div>
            <div class="stat-label">进行中</div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="stat-item">
            <div class="stat-value">{{ stats.totalReceived }}</div>
            <div class="stat-label">已领取</div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="stat-item">
            <div class="stat-value">{{ stats.totalUsed }}</div>
            <div class="stat-label">已使用</div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="stat-item">
            <div class="stat-value">{{ stats.totalStock }}</div>
            <div class="stat-label">剩余库存</div>
          </div>
        </el-col>
      </el-row>
    </AppCard>

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
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
          <el-button :icon="RefreshRight" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
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
        <template #cell-type="{ row }">
          {{ couponTypeMap[row.type] || row.type }}
        </template>

        <template #cell-totalCount="{ row }">
          {{ row.receivedCount || 0 }} / {{ row.totalCount }}
        </template>

        <template #cell-scope="{ row }">
          {{ scopeMap[row.scope || 1] || row.scope }}
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
          <el-select v-model="form.scope" disabled style="width: 100%">
            <el-option label="本店专用" :value="2" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="formLoading" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.merchant-coupon {
  .stats-card {
    margin-bottom: $spacing-md;

    .stat-item {
      text-align: center;
      padding: $spacing-sm 0;

      .stat-value {
        font-size: 24px;
        font-weight: 600;
        color: $primary;
      }

      .stat-label {
        margin-top: 4px;
        font-size: $font-size-sm;
        color: $text-muted;
      }
    }
  }

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
}
</style>
