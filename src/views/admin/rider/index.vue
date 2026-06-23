<script setup lang="ts">
import { reactive, ref, computed, onMounted } from 'vue'
import { Search, RefreshRight, Plus, Download, Delete, Star } from '@element-plus/icons-vue'
import { api } from '@/api'
import AppCard from '@/components/AppCard.vue'
import AppHeader from '@/components/AppHeader.vue'
import AppTable, { type TableColumn } from '@/components/AppTable.vue'
import { formatDate, maskPhone, mapStatus } from '@/utils/format'
import { CommonStatusMap } from '@/utils/constants'
import { exportToExcel, exportToCsv, type ExportColumn } from '@/utils/export'
import { downloadBlob } from '@/utils/download'
import { useSavedQueries, type SavedQuery } from '@/composables/useSavedQueries'
import type { Rider, RiderCreateDTO, RiderUpdateDTO } from '@/api/types'
import type { FormInstance, FormRules } from 'element-plus'

// 搜索表单
interface SearchForm {
  keyword: string
  phone: string
  status: number | undefined
  onDuty: number | undefined
}

const searchForm = reactive<SearchForm>({
  keyword: '',
  phone: '',
  status: undefined,
  onDuty: undefined,
})

const loading = ref(false)
const exporting = ref(false)
const tableData = ref<Rider[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)

// 排序
const sortField = ref<string>('')
const sortOrder = ref<'asc' | 'desc'>('asc')

// 批量选择
const selectedRows = ref<Rider[]>([])

// 详情弹窗
const detailVisible = ref(false)
const currentRow = ref<Rider | null>(null)

// 表单弹窗
const formVisible = ref(false)
const formLoading = ref(false)
const isEdit = ref(false)
const formRef = ref<FormInstance>()
const formData = reactive<RiderCreateDTO & { id?: number }>({
  id: undefined,
  name: '',
  phone: '',
  password: '',
  idCard: '',
  gender: 0,
  status: 1,
})

const rules = computed<FormRules>(() => ({
  name: [
    { required: true, message: '请输入骑手姓名', trigger: 'blur' },
    { min: 2, max: 20, message: '长度在 2 到 20 个字符', trigger: 'blur' },
  ],
  phone: isEdit.value
    ? []
    : [
        { required: true, message: '请输入手机号', trigger: 'blur' },
        { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' },
      ],
  password: isEdit.value
    ? []
    : [
        { required: true, message: '请输入密码', trigger: 'blur' },
        { min: 6, max: 20, message: '长度在 6 到 20 个字符', trigger: 'blur' },
      ],
  idCard: [
    { required: true, message: '请输入身份证号', trigger: 'blur' },
    { pattern: /(^\d{15}$)|(^\d{18}$)|(^\d{17}(\d|X|x)$)/, message: '请输入正确的身份证号', trigger: 'blur' },
  ],
}))

// 列定义
const columns: TableColumn[] = [
  { prop: 'id', label: 'ID', width: 80, sortable: true },
  { prop: 'name', label: '姓名', minWidth: 120, sortable: true },
  { prop: 'phone', label: '手机号', minWidth: 140 },
  { prop: 'gender', label: '性别', width: 80 },
  { prop: 'idCard', label: '身份证号', minWidth: 180 },
  { prop: 'level', label: '等级', width: 100 },
  { prop: 'totalOrders', label: '总订单', width: 100, sortable: true },
  { prop: 'monthOrders', label: '月订单', width: 100, sortable: true },
  { prop: 'rating', label: '评分', width: 100, sortable: true },
  { prop: 'status', label: '状态', width: 90 },
  { prop: 'createdAt', label: '注册时间', minWidth: 170, sortable: true },
]

// 查询条件保存
const { savedQueries, saveQuery, deleteQuery, applyQuery } = useSavedQueries('admin_rider')

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
    status: searchForm.status,
    onDuty: searchForm.onDuty,
    sortField: sortField.value || undefined,
    sortOrder: sortOrder.value,
  }
}

// 加载骑手列表
async function loadList() {
  loading.value = true
  try {
    const res = await api.rider.getList(buildQueryParams())
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
  searchForm.status = undefined
  searchForm.onDuty = undefined
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
function handleSelectionChange(selection: Rider[]) {
  selectedRows.value = selection
}

// 查看详情
function handleView(row: Rider) {
  currentRow.value = row
  detailVisible.value = true
}

// 切换状态
async function handleToggleStatus(row: Rider) {
  const action = row.status === 1 ? '禁用' : '启用'
  try {
    await ElMessageBox.confirm(`确定要${action}骑手「${row.name}」吗？`, '提示', { type: 'warning' })
    await api.rider.updateStatus(row.id, row.status === 1 ? 0 : 1)
    row.status = row.status === 1 ? 0 : 1
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
    idCard: '',
    gender: 0,
    status: 1,
  })
  formVisible.value = true
}

// 打开编辑
async function handleEdit(row: Rider) {
  isEdit.value = true
  const detail = await api.rider.getDetail(row.id)
  const d = detail.data as any
  Object.assign(formData, {
    id: d.id,
    name: d.name,
    phone: d.phoneRaw || d.phone,
    password: '',
    idCard: d.idCard || '',
    gender: d.gender ?? 0,
    status: d.status,
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
      const payload: RiderUpdateDTO = {
        name: formData.name,
        idCard: formData.idCard,
        gender: formData.gender,
        status: formData.status,
      }
      if (formData.password) {
        payload.password = formData.password
      }
      await api.rider.update(formData.id, payload)
      ElMessage.success('更新成功')
    } else {
      const payload: RiderCreateDTO = {
        name: formData.name,
        phone: formData.phone,
        password: formData.password,
        idCard: formData.idCard,
        gender: formData.gender,
        status: formData.status,
      }
      await api.rider.add(payload)
      ElMessage.success('创建成功')
    }
    formVisible.value = false
    loadList()
  } finally {
    formLoading.value = false
  }
}

// 单条删除
async function handleDelete(row: Rider) {
  try {
    await ElMessageBox.confirm(`确定要删除骑手「${row.name}」吗？`, '提示', {
      type: 'warning',
      confirmButtonText: '确认',
      cancelButtonText: '取消',
    })
    await api.rider.delete(row.id)
    ElMessage.success('删除成功')
    loadList()
  } catch {
    // 取消
  }
}

// 批量删除
async function handleBatchDelete() {
  if (selectedRows.value.length === 0) {
    ElMessage.warning('请先选择要删除的骑手')
    return
  }
  try {
    await ElMessageBox.confirm(`确定要删除选中的 ${selectedRows.value.length} 个骑手吗？`, '提示', {
      type: 'warning',
      confirmButtonText: '确认',
      cancelButtonText: '取消',
    })
    await Promise.all(selectedRows.value.map((row) => api.rider.delete(row.id)))
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
  { prop: 'name', label: '姓名' },
  { prop: 'phone', label: '手机号' },
  { prop: 'gender', label: '性别', formatter: (_row, v) => (v === 1 ? '男' : v === 2 ? '女' : '未知') },
  { prop: 'idCard', label: '身份证号' },
  { prop: 'level', label: '等级' },
  { prop: 'orderCount', label: '总订单' },
  { prop: 'monthOrderCount', label: '月订单' },
  { prop: 'rating', label: '评分' },
  { prop: 'status', label: '状态', formatter: (_row, v) => (v === 1 ? '启用' : '禁用') },
  { prop: 'createTime', label: '注册时间', formatter: (_row, v) => formatDate(v) },
]

async function handleExport(format: 'xlsx' | 'csv') {
  exporting.value = true
  try {
    try {
      const blob = await api.rider.export({ ...buildQueryParams(), format })
      downloadBlob(blob, `骑手列表.${format}`, format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv;charset=utf-8;')
      ElMessage.success('导出成功')
      return
    } catch {
      // 后端不支持时降级为前端导出
    }
    const filename = `骑手列表_${formatDate(new Date(), 'YYYYMMDD_HHmmss')}`
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
  if (!searchForm.keyword && !searchForm.phone && searchForm.status === undefined && searchForm.onDuty === undefined) {
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

// 性别显示
function formatGender(gender?: number) {
  if (gender === 1) return '男'
  if (gender === 2) return '女'
  return '未知'
}

// 身份证号脱敏
function maskIdCard(idCard?: string) {
  if (!idCard) return '-'
  if (idCard.length <= 8) return idCard
  return `${idCard.slice(0, 4)}**********${idCard.slice(-4)}`
}

onMounted(loadList)
</script>

<template>
  <div class="admin-rider">
    <AppHeader title="骑手管理" subtitle="管理平台配送骑手">
      <el-button type="primary" :icon="Plus" @click="handleAdd">新增骑手</el-button>
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
        <el-form-item label="姓名">
          <el-input v-model="searchForm.keyword" placeholder="骑手姓名" clearable />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="searchForm.phone" placeholder="请输入手机号" clearable />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部状态" clearable style="width: 120px">
            <el-option label="启用" :value="1" />
            <el-option label="禁用" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item label="在岗状态">
          <el-select v-model="searchForm.onDuty" placeholder="全部" clearable style="width: 120px">
            <el-option label="在岗" :value="1" />
            <el-option label="离岗" :value="0" />
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

        <template #cell-phone="{ row }">
          {{ maskPhone(row.phone) }}
        </template>

        <template #cell-gender="{ row }">
          {{ formatGender(row.gender) }}
        </template>

        <template #cell-idCard="{ row }">
          {{ maskIdCard(row.idCard) }}
        </template>

        <template #cell-level="{ row }">
          <el-tag type="warning" effect="plain">{{ row.level }}</el-tag>
        </template>

        <template #cell-totalOrders="{ row }">
          {{ row.totalOrders ?? 0 }}
        </template>

        <template #cell-monthOrders="{ row }">
          {{ row.monthOrders ?? 0 }}
        </template>

        <template #cell-rating="{ row }">
          {{ row.rating ? row.rating.toFixed(1) : '-' }}
        </template>

        <template #cell-status="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'danger'">
            {{ mapStatus(row.status, CommonStatusMap) }}
          </el-tag>
        </template>

        <template #cell-createdAt="{ row }">
          {{ formatDate(row.createdAt) }}
        </template>

        <template #append>
          <el-table-column label="操作" width="220" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="handleView(row)">查看</el-button>
              <el-button link type="primary" @click="handleEdit(row)">编辑</el-button>
              <el-button link :type="row.status === 1 ? 'warning' : 'success'" @click="handleToggleStatus(row)">
                {{ row.status === 1 ? '禁用' : '启用' }}
              </el-button>
              <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </template>
      </AppTable>
    </AppCard>

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailVisible" title="骑手详情" width="560px">
      <el-descriptions v-if="currentRow" :column="1" border>
        <el-descriptions-item label="ID">{{ currentRow.id }}</el-descriptions-item>
        <el-descriptions-item label="姓名">{{ currentRow.name }}</el-descriptions-item>
        <el-descriptions-item label="手机号">{{ currentRow.phone }}</el-descriptions-item>
        <el-descriptions-item label="性别">{{ formatGender(currentRow.gender) }}</el-descriptions-item>
        <el-descriptions-item label="身份证号">{{ currentRow.idCard || '-' }}</el-descriptions-item>
        <el-descriptions-item label="等级">{{ currentRow.level ?? 1 }}</el-descriptions-item>
        <el-descriptions-item label="总订单数">{{ currentRow.totalOrders ?? 0 }}</el-descriptions-item>
        <el-descriptions-item label="月订单数">{{ currentRow.monthOrders ?? 0 }}</el-descriptions-item>
        <el-descriptions-item label="评分">{{ currentRow.rating ? currentRow.rating.toFixed(1) : '-' }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="currentRow.status === 1 ? 'success' : 'danger'">
            {{ mapStatus(currentRow.status, CommonStatusMap) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="注册时间">{{ formatDate(currentRow.createdAt) }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="formVisible" :title="isEdit ? '编辑骑手' : '新增骑手'" width="560px">
      <el-form ref="formRef" :model="formData" :rules="rules" label-width="100px">
        <el-form-item label="姓名" prop="name">
          <el-input v-model="formData.name" placeholder="请输入骑手姓名" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="formData.phone" placeholder="请输入登录手机号" maxlength="11" :disabled="isEdit" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="formData.password" type="password" show-password :placeholder="isEdit ? '不修改请留空' : '请输入密码'" />
        </el-form-item>
        <el-form-item label="身份证号" prop="idCard">
          <el-input v-model="formData.idCard" placeholder="请输入身份证号" maxlength="18" />
        </el-form-item>
        <el-form-item label="性别" prop="gender">
          <el-radio-group v-model="formData.gender">
            <el-radio :label="0">未知</el-radio>
            <el-radio :label="1">男</el-radio>
            <el-radio :label="2">女</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="formData.status">
            <el-radio :label="1">启用</el-radio>
            <el-radio :label="0">禁用</el-radio>
          </el-radio-group>
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
.admin-rider {
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
