<script setup lang="ts">
import { reactive, ref, computed, onMounted } from 'vue'
import { Search, RefreshRight, Plus, Download, Delete, Star } from '@element-plus/icons-vue'
import { api } from '@/api'
import AppCard from '@/components/AppCard.vue'
import AppHeader from '@/components/AppHeader.vue'
import AppTable, { type TableColumn } from '@/components/AppTable.vue'
import { formatDate, formatNumber, maskPhone, mapStatus } from '@/utils/format'
import { CommonStatusMap, AuditStatusMap } from '@/utils/constants'
import { exportToExcel, exportToCsv, type ExportColumn } from '@/utils/export'
import { downloadBlob } from '@/utils/download'
import { useSavedQueries, type SavedQuery } from '@/composables/useSavedQueries'
import type { Merchant, MerchantCreateDTO, MerchantUpdateDTO, Category } from '@/api/types'
import type { FormInstance, FormRules } from 'element-plus'

// 搜索表单
interface SearchForm {
  keyword: string
  phone: string
  categoryId: number | undefined
  status: number | undefined
  auditStatus: number | undefined
  dateRange: string[]
}

const searchForm = reactive<SearchForm>({
  keyword: '',
  phone: '',
  categoryId: undefined,
  status: undefined,
  auditStatus: undefined,
  dateRange: [],
})

const loading = ref(false)
const exporting = ref(false)
const tableData = ref<Merchant[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)

// 排序
const sortField = ref<string>('')
const sortOrder = ref<'asc' | 'desc'>('asc')

// 批量选择
const selectedRows = ref<Merchant[]>([])

// 分类列表
const categoryList = ref<Category[]>([])

// 详情弹窗
const detailVisible = ref(false)
const currentRow = ref<Merchant | null>(null)

// 表单弹窗
const formVisible = ref(false)
const formLoading = ref(false)
const isEdit = ref(false)
const formRef = ref<FormInstance>()
const formData = reactive<MerchantCreateDTO & { id?: number }>({
  id: undefined,
  name: '',
  phone: '',
  password: '',
  categoryId: undefined,
  contactPerson: '',
  contactPhone: '',
  province: '',
  city: '',
  district: '',
  address: '',
  longitude: undefined,
  latitude: undefined,
  description: '',
  announcement: '',
})

const rules = computed<FormRules>(() => ({
  name: [
    { required: true, message: '请输入商家名称', trigger: 'blur' },
    { min: 2, max: 50, message: '长度在 2 到 50 个字符', trigger: 'blur' },
  ],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' },
  ],
  password: isEdit.value
    ? []
    : [
        { required: true, message: '请输入密码', trigger: 'blur' },
        { min: 6, max: 20, message: '长度在 6 到 20 个字符', trigger: 'blur' },
      ],
  contactPerson: [{ required: true, message: '请输入联系人', trigger: 'blur' }],
  contactPhone: [
    { required: true, message: '请输入联系电话', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' },
  ],
  address: [{ required: true, message: '请输入详细地址', trigger: 'blur' }],
  longitude: [
    { required: true, message: '请输入经度', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (value === undefined || value === null || value === '') {
          callback()
          return
        }
        const num = Number(value)
        if (Number.isNaN(num) || num < -180 || num > 180) {
          callback(new Error('经度范围 -180~180'))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
  latitude: [
    { required: true, message: '请输入纬度', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (value === undefined || value === null || value === '') {
          callback()
          return
        }
        const num = Number(value)
        if (Number.isNaN(num) || num < -90 || num > 90) {
          callback(new Error('纬度范围 -90~90'))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
}))

// 列定义
const columns: TableColumn[] = [
  { prop: 'id', label: 'ID', width: 80, sortable: true },
  { prop: 'name', label: '商家名称', minWidth: 150, sortable: true },
  { prop: 'contactPerson', label: '联系人', minWidth: 100 },
  { prop: 'phone', label: '手机号', minWidth: 130 },
  { prop: 'address', label: '地址', minWidth: 200, showOverflowTooltip: true },
  { prop: 'auditStatus', label: '审核状态', width: 110 },
  { prop: 'rating', label: '评分', width: 90, sortable: true },
  { prop: 'monthSales', label: '月销', width: 90, sortable: true },
  { prop: 'operateStatus', label: '状态', width: 100 },
  { prop: 'createTime', label: '创建时间', minWidth: 170, sortable: true },
]

// 查询条件保存
const { savedQueries, saveQuery, deleteQuery, applyQuery } = useSavedQueries('admin_merchant')

// 保存查询弹窗
const saveQueryVisible = ref(false)
const saveQueryName = ref('')

// 构造查询参数
function buildQueryParams() {
  return {
    page: page.value,
    pageSize: pageSize.value,
    keyword: searchForm.keyword || undefined,
    phone: searchForm.phone || undefined,
    categoryId: searchForm.categoryId,
    status: searchForm.status,
    auditStatus: searchForm.auditStatus,
    startDate: searchForm.dateRange?.[0],
    endDate: searchForm.dateRange?.[1],
    sortField: sortField.value || undefined,
    sortOrder: sortOrder.value,
  }
}

// 加载分类列表
async function loadCategories() {
  try {
    const res = await api.category.getList()
    categoryList.value = res.data
  } catch {
    categoryList.value = []
  }
}

// 加载商家列表
async function loadList() {
  loading.value = true
  try {
    const res = await api.merchant.getList(buildQueryParams())
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
  searchForm.keyword = ''
  searchForm.phone = ''
  searchForm.categoryId = undefined
  searchForm.status = undefined
  searchForm.auditStatus = undefined
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
function handleSelectionChange(selection: Merchant[]) {
  selectedRows.value = selection
}

// 查看详情
function handleView(row: Merchant) {
  currentRow.value = row
  detailVisible.value = true
}

// 切换状态
async function handleToggleStatus(row: Merchant) {
  const action = row.operateStatus === 1 ? '禁用' : '启用'
  try {
    await ElMessageBox.confirm(`确定要${action}商家「${row.name}」吗？`, '提示', { type: 'warning' })
    await api.merchant.updateStatus(row.id, row.operateStatus === 1 ? 0 : 1)
    row.operateStatus = row.operateStatus === 1 ? 0 : 1
    ElMessage.success(`${action}成功`)
  } catch {
    // 取消
  }
}

// 打开新增
function handleAdd() {
  isEdit.value = false
  Object.assign(formData, {
    id: undefined,
    name: '',
    phone: '',
    password: '',
    categoryId: undefined,
    contactPerson: '',
    contactPhone: '',
    province: '',
    city: '',
    district: '',
    address: '',
    longitude: undefined,
    latitude: undefined,
    description: '',
    announcement: '',
  })
  formVisible.value = true
}

// 打开编辑
async function handleEdit(row: Merchant) {
  isEdit.value = true
  const detail = await api.merchant.getDetail(row.id)
  const d = detail.data as any
  Object.assign(formData, {
    id: d.id,
    name: d.name,
    phone: d.phone,
    password: '',
    categoryId: d.categoryId,
    contactPerson: d.contactPerson,
    contactPhone: d.contactPhone || d.phone,
    province: d.province || '',
    city: d.city || '',
    district: d.district || '',
    address: d.address || '',
    longitude: d.longitude,
    latitude: d.latitude,
    description: d.description || '',
    announcement: d.announcement || '',
  })
  formVisible.value = true
}

// 保存表单
async function handleSave() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  formLoading.value = true
  try {
    if (isEdit.value && formData.id) {
      const payload: MerchantUpdateDTO = {
        name: formData.name,
        phone: formData.phone,
        categoryId: formData.categoryId,
        contactPerson: formData.contactPerson,
        contactPhone: formData.contactPhone,
        province: formData.province,
        city: formData.city,
        district: formData.district,
        address: formData.address,
        longitude: formData.longitude,
        latitude: formData.latitude,
        description: formData.description,
        announcement: formData.announcement,
      }
      if (formData.password) {
        payload.password = formData.password
      }
      await api.merchant.update(formData.id, payload)
      ElMessage.success('更新成功')
    } else {
      const payload: MerchantCreateDTO = {
        name: formData.name,
        phone: formData.phone,
        password: formData.password,
        categoryId: formData.categoryId,
        contactPerson: formData.contactPerson,
        contactPhone: formData.contactPhone,
        province: formData.province,
        city: formData.city,
        district: formData.district,
        address: formData.address,
        longitude: formData.longitude,
        latitude: formData.latitude,
        description: formData.description,
        announcement: formData.announcement,
      }
      await api.merchant.add(payload)
      ElMessage.success('创建成功')
    }
    formVisible.value = false
    loadList()
  } finally {
    formLoading.value = false
  }
}

// 单条删除
async function handleDelete(row: Merchant) {
  try {
    await ElMessageBox.confirm(`确定要删除商家「${row.name}」吗？`, '提示', {
      type: 'warning',
      confirmButtonText: '确认',
      cancelButtonText: '取消',
    })
    await api.merchant.delete(row.id)
    ElMessage.success('删除成功')
    loadList()
  } catch {
    // 取消
  }
}

// 批量删除
async function handleBatchDelete() {
  if (selectedRows.value.length === 0) {
    ElMessage.warning('请先选择要删除的商家')
    return
  }
  try {
    await ElMessageBox.confirm(`确定要删除选中的 ${selectedRows.value.length} 个商家吗？`, '提示', {
      type: 'warning',
      confirmButtonText: '确认',
      cancelButtonText: '取消',
    })
    await Promise.all(selectedRows.value.map((row) => api.merchant.delete(row.id)))
    ElMessage.success('批量删除成功')
    selectedRows.value = []
    loadList()
  } catch {
    // 取消
  }
}

// 导出
const exportColumns: ExportColumn[] = [
  { prop: 'id', label: 'ID' },
  { prop: 'name', label: '商家名称' },
  { prop: 'contactPerson', label: '联系人' },
  { prop: 'phone', label: '手机号' },
  { prop: 'address', label: '地址' },
  { prop: 'auditStatus', label: '审核状态', formatter: (_row, v) => mapStatus(v, AuditStatusMap) },
  { prop: 'operateStatus', label: '状态', formatter: (_row, v) => (v === 1 ? '启用' : '禁用') },
  { prop: 'rating', label: '评分' },
  { prop: 'monthSales', label: '月销' },
  { prop: 'createTime', label: '创建时间', formatter: (_row, v) => formatDate(v) },
]

async function handleExport(format: 'xlsx' | 'csv') {
  exporting.value = true
  try {
    try {
      const blob = await api.merchant.export({ ...buildQueryParams(), format })
      downloadBlob(blob, `商家列表.${format}`, format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv;charset=utf-8;')
      ElMessage.success('导出成功')
      return
    } catch {
      // 后端不支持时降级为前端导出
    }
    const filename = `商家列表_${formatDate(new Date(), 'YYYYMMDD_HHmmss')}`
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
  if (!searchForm.keyword && !searchForm.phone && searchForm.categoryId === undefined && searchForm.status === undefined && searchForm.auditStatus === undefined && (!searchForm.dateRange || searchForm.dateRange.length === 0)) {
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

// 商家综合状态文字（待审核/营业中/已禁用/已驳回）
function getMerchantStatusText(row: Merchant): string {
  if (row.auditStatus === 0) return '待审核'
  if (row.auditStatus === 2) return '已驳回'
  if (row.auditStatus === 1) {
    return row.operateStatus === 1 ? '营业中' : '已禁用'
  }
  return '未知'
}

// 商家综合状态标签类型
function getMerchantStatusType(row: Merchant): 'success' | 'warning' | 'danger' | 'info' {
  if (row.auditStatus === 0) return 'warning'
  if (row.auditStatus === 2) return 'danger'
  if (row.auditStatus === 1) {
    return row.operateStatus === 1 ? 'success' : 'info'
  }
  return 'info'
}

onMounted(() => {
  loadCategories()
  loadList()
})
</script>

<template>
  <div class="admin-merchant">
    <AppHeader title="商家管理" subtitle="管理平台入驻商家">
      <el-button type="primary" :icon="Plus" @click="handleAdd">新增商家</el-button>
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
        <el-form-item label="商家名称">
          <el-input v-model="searchForm.keyword" placeholder="商家名称/联系人" clearable />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="searchForm.phone" placeholder="请输入手机号" clearable />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="searchForm.categoryId" placeholder="全部分类" clearable style="width: 140px">
            <el-option v-for="item in categoryList" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部状态" clearable style="width: 120px">
            <el-option label="启用" :value="1" />
            <el-option label="禁用" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item label="审核状态">
          <el-select v-model="searchForm.auditStatus" placeholder="全部" clearable style="width: 120px">
            <el-option label="待审核" :value="0" />
            <el-option label="已通过" :value="1" />
            <el-option label="已拒绝" :value="2" />
          </el-select>
        </el-form-item>
        <el-form-item label="入驻时间">
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

        <template #cell-name="{ row }">
          <span>{{ row.name || '未命名' }}</span>
        </template>

        <template #cell-phone="{ row }">
          {{ maskPhone(row.phone) }}
        </template>

        <template #cell-auditStatus="{ row }">
          <el-tag :type="row.auditStatus === 1 ? 'success' : row.auditStatus === 2 ? 'danger' : 'warning'">
            {{ mapStatus(row.auditStatus, AuditStatusMap) }}
          </el-tag>
        </template>

        <template #cell-operateStatus="{ row }">
          <el-tag :type="getMerchantStatusType(row)">
            {{ getMerchantStatusText(row) }}
          </el-tag>
        </template>

        <template #cell-rating="{ row }">
          {{ row.rating ? row.rating.toFixed(1) : '-' }}
        </template>

        <template #cell-monthSales="{ row }">
          {{ formatNumber(row.monthSales ?? row.monthlySales ?? 0) }}
        </template>

        <template #cell-createTime="{ row }">
          {{ formatDate(row.createTime) }}
        </template>

        <template #append>
          <el-table-column label="操作" width="240" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="handleView(row)">查看</el-button>
              <el-button link type="primary" @click="handleEdit(row)">编辑</el-button>
              <el-button link :type="row.operateStatus === 1 ? 'warning' : 'success'" @click="handleToggleStatus(row)">
                {{ row.operateStatus === 1 ? '禁用' : '启用' }}
              </el-button>
              <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </template>
      </AppTable>
    </AppCard>

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailVisible" title="商家详情" width="600px">
      <el-descriptions v-if="currentRow" :column="2" border>
        <el-descriptions-item label="商家ID">{{ currentRow.id }}</el-descriptions-item>
        <el-descriptions-item label="商家名称">{{ currentRow.name }}</el-descriptions-item>
        <el-descriptions-item label="联系人">{{ currentRow.contactPerson }}</el-descriptions-item>
        <el-descriptions-item label="联系电话">{{ currentRow.phone }}</el-descriptions-item>
        <el-descriptions-item label="地址" :span="2">{{ currentRow.address }}</el-descriptions-item>
        <el-descriptions-item label="审核状态">
          <el-tag :type="currentRow.auditStatus === 1 ? 'success' : currentRow.auditStatus === 2 ? 'danger' : 'warning'">
            {{ mapStatus(currentRow.auditStatus, AuditStatusMap) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getMerchantStatusType(currentRow)">
            {{ getMerchantStatusText(currentRow) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="评分">{{ currentRow.rating ? currentRow.rating.toFixed(1) : '-' }}</el-descriptions-item>
        <el-descriptions-item label="月售">{{ formatNumber(currentRow.monthSales ?? currentRow.monthlySales ?? 0) }}</el-descriptions-item>
        <el-descriptions-item label="入驻时间" :span="2">{{ formatDate(currentRow.createTime) }}</el-descriptions-item>
        <el-descriptions-item label="资质信息" :span="2">{{ currentRow.qualification || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="formVisible" :title="isEdit ? '编辑商家' : '新增商家'" width="680px">
      <el-form ref="formRef" :model="formData" :rules="rules" label-width="100px">
        <el-form-item label="商家名称" prop="name">
          <el-input v-model="formData.name" placeholder="请输入商家名称" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="formData.phone" placeholder="请输入登录手机号" maxlength="11" :disabled="isEdit" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="formData.password" type="password" show-password :placeholder="isEdit ? '不修改请留空' : '请输入密码'" />
        </el-form-item>
        <el-form-item label="经营分类" prop="categoryId">
          <el-select v-model="formData.categoryId" placeholder="请选择分类" clearable style="width: 100%">
            <el-option v-for="item in categoryList" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="联系人" prop="contactPerson">
          <el-input v-model="formData.contactPerson" placeholder="请输入联系人姓名" />
        </el-form-item>
        <el-form-item label="联系电话" prop="contactPhone">
          <el-input v-model="formData.contactPhone" placeholder="请输入联系电话" maxlength="11" />
        </el-form-item>
        <el-form-item label="省/市/区">
          <el-col :span="8">
            <el-input v-model="formData.province" placeholder="省" />
          </el-col>
          <el-col :span="8">
            <el-input v-model="formData.city" placeholder="市" />
          </el-col>
          <el-col :span="8">
            <el-input v-model="formData.district" placeholder="区" />
          </el-col>
        </el-form-item>
        <el-form-item label="详细地址" prop="address">
          <el-input v-model="formData.address" placeholder="请输入详细地址" />
        </el-form-item>
        <el-row :gutter="8">
          <el-col :span="12">
            <el-form-item label="经度" prop="longitude" label-width="100px">
              <el-input-number v-model="formData.longitude" :precision="6" :step="0.000001" :controls="false" placeholder="经度" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="纬度" prop="latitude" label-width="80px">
              <el-input-number v-model="formData.latitude" :precision="6" :step="0.000001" :controls="false" placeholder="纬度" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="商家描述">
          <el-input v-model="formData.description" type="textarea" :rows="3" placeholder="请输入商家描述" maxlength="200" show-word-limit />
        </el-form-item>
        <el-form-item label="店铺公告">
          <el-input v-model="formData.announcement" type="textarea" :rows="3" placeholder="请输入店铺公告" maxlength="200" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
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
.admin-merchant {
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
