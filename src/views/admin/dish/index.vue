<script setup lang="ts">
import { reactive, ref, computed, onMounted } from 'vue'
import { Search, RefreshRight, Plus, Download, Delete, Star, Food } from '@element-plus/icons-vue'
import { api } from '@/api'
import AppCard from '@/components/AppCard.vue'
import AppHeader from '@/components/AppHeader.vue'
import AppTable, { type TableColumn } from '@/components/AppTable.vue'
import { formatDate, formatAmount, formatNumber, truncateText } from '@/utils/format'
import { CommonStatusMap } from '@/utils/constants'
import { exportToExcel, exportToCsv, type ExportColumn } from '@/utils/export'
import { downloadBlob } from '@/utils/download'
import { useSavedQueries, type SavedQuery } from '@/composables/useSavedQueries'
import type { Dish, Category, DishUpdateDTO } from '@/api/types'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'

// 搜索表单
interface SearchForm {
  keyword: string
  platformCategoryId: number | undefined
  status: number | undefined
}

const searchForm = reactive<SearchForm>({
  keyword: '',
  platformCategoryId: undefined,
  status: undefined,
})

const loading = ref(false)
const exporting = ref(false)
const tableData = ref<Dish[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)

// 排序
const sortField = ref<string>('')
const sortOrder = ref<'asc' | 'desc'>('asc')

// 批量选择
const selectedRows = ref<Dish[]>([])

// 详情弹窗
const detailVisible = ref(false)
const currentRow = ref<Dish | null>(null)

// 表单弹窗
const formVisible = ref(false)
const formLoading = ref(false)
const isEdit = ref(false)
const formRef = ref<FormInstance>()
const formData = reactive<Partial<Dish>>({
  id: undefined,
  name: '',
  categoryId: undefined,
  platformCategoryId: undefined,
  price: undefined,
  originalPrice: undefined,
  stock: undefined,
  status: 1,
  description: '',
  image: '',
})

const rules = computed<FormRules>(() => ({
  name: [{ required: true, message: '请输入菜品名称', trigger: 'blur' }],
  price: [{ required: true, message: '请输入价格', trigger: 'blur' }],
  status: [{ required: true, message: '请选择状态', trigger: 'change' }],
}))

// 分类列表
const categoryList = ref<Category[]>([])
// 平台分类列表
const platformCategoryList = ref<Category[]>([])

// 图片上传
const uploading = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

// 列定义
const columns: TableColumn[] = [
  { prop: 'id', label: 'ID', width: 80, sortable: true },
  { prop: 'image', label: '图片', width: 90 },
  { prop: 'name', label: '菜品名称', minWidth: 140, sortable: true },
  { prop: 'categoryName', label: '商家分类', minWidth: 100 },
  { prop: 'platformCategoryName', label: '平台分类', minWidth: 100 },
  { prop: 'price', label: '价格', width: 130, sortable: true },
  { prop: 'monthSales', label: '销量', width: 90, sortable: true },
  { prop: 'status', label: '状态', width: 90 },
  { prop: 'createTime', label: '创建时间', minWidth: 170, sortable: true },
]

// 查询条件保存
const { savedQueries, saveQuery, deleteQuery, applyQuery } = useSavedQueries('admin_dish')

// 保存查询弹窗
const saveQueryVisible = ref(false)
const saveQueryName = ref('')

// 构造查询参数
function buildQueryParams() {
  return {
    current: page.value,
    size: pageSize.value,
    keyword: searchForm.keyword || undefined,
    platformCategoryId: searchForm.platformCategoryId,
    status: searchForm.status,
    sortField: sortField.value || undefined,
    sortOrder: sortOrder.value,
  }
}

// 加载平台分类列表（管理员端的分类就是平台分类）
async function loadCategories() {
  try {
    const res = await api.category.getList()
    platformCategoryList.value = res.data
  } catch {
    platformCategoryList.value = []
  }
}

// 加载菜品列表
async function loadList() {
  loading.value = true
  try {
    const res = await api.dish.getList(buildQueryParams())
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
  searchForm.platformCategoryId = undefined
  searchForm.status = undefined
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
function handleSelectionChange(selection: Dish[]) {
  selectedRows.value = selection
}

// 查看详情
function handleView(row: Dish) {
  currentRow.value = row
  detailVisible.value = true
}

// 打开新增（管理员不允许新增菜品）
function handleAdd() {
  ElMessage.warning('管理员不可新增菜品，请由商家账号创建')
}

// 打开编辑
async function handleEdit(row: Dish) {
  isEdit.value = true
  Object.assign(formData, {
    id: row.id,
    name: row.name,
    categoryId: row.categoryId,
    platformCategoryId: row.platformCategoryId,
    price: row.price,
    originalPrice: row.originalPrice,
    stock: row.stock,
    status: row.status,
    description: row.description || '',
    image: row.image || '',
  })
  formVisible.value = true
}

// 触发文件选择
function triggerFileSelect() {
  fileInputRef.value?.click()
}

// 处理文件上传
async function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  // 校验图片类型
  if (!file.type.startsWith('image/')) {
    ElMessage.error('请选择图片文件')
    target.value = ''
    return
  }
  // 校验图片大小：10MB
  if (file.size > 10 * 1024 * 1024) {
    ElMessage.error('图片大小不能超过 10MB')
    target.value = ''
    return
  }

  uploading.value = true
  try {
    const res = await api.file.upload(file)
    formData.image = res.data.url
    ElMessage.success('图片上传成功')
  } catch {
    ElMessage.error('图片上传失败')
  } finally {
    uploading.value = false
    target.value = ''
  }
}

// 保存表单
async function handleSave() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  formLoading.value = true
  try {
    const payload: DishUpdateDTO = {
      name: formData.name,
      platformCategoryId: formData.platformCategoryId,
      price: formData.price,
      originalPrice: formData.originalPrice,
      stock: formData.stock,
      status: formData.status,
      description: formData.description,
      image: formData.image,
    }
    if (isEdit.value && formData.id) {
      await api.dish.update(formData.id, payload)
      ElMessage.success('更新成功')
    }
    formVisible.value = false
    loadList()
  } finally {
    formLoading.value = false
  }
}

// 切换状态
async function handleToggleStatus(row: Dish) {
  const action = row.status === 1 ? '下架' : '上架'
  try {
    await ElMessageBox.confirm(`确定要${action}菜品「${row.name}」吗？`, '提示', { type: 'warning' })
    await api.dish.updateStatus(row.id, row.status === 1 ? 0 : 1)
    row.status = row.status === 1 ? 0 : 1
    ElMessage.success(`${action}成功`)
  } catch {
    // 取消
  }
}

// 单条删除
async function handleDelete(row: Dish) {
  try {
    await ElMessageBox.confirm(`确定要删除菜品「${row.name}」吗？删除后不可恢复。`, '提示', {
      type: 'warning',
      confirmButtonText: '确认',
      cancelButtonText: '取消',
    })
    await api.dish.delete(row.id)
    ElMessage.success('删除成功')
    loadList()
  } catch {
    // 取消
  }
}

// 批量删除
async function handleBatchDelete() {
  if (selectedRows.value.length === 0) {
    ElMessage.warning('请先选择要删除的菜品')
    return
  }
  try {
    await ElMessageBox.confirm(`确定要删除选中的 ${selectedRows.value.length} 个菜品吗？`, '提示', {
      type: 'warning',
      confirmButtonText: '确认',
      cancelButtonText: '取消',
    })
    await Promise.all(selectedRows.value.map((row) => api.dish.delete(row.id)))
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
  { prop: 'name', label: '菜品名称' },
  { prop: 'categoryName', label: '分类' },
  { prop: 'price', label: '价格', formatter: (_row, v) => (v != null ? `¥${Number(v).toFixed(2)}` : '¥0.00') },
  { prop: 'originalPrice', label: '原价', formatter: (_row, v) => (v != null ? `¥${Number(v).toFixed(2)}` : '-') },
  { prop: 'monthSales', label: '销量' },
  { prop: 'createTime', label: '创建时间', formatter: (_row, v) => formatDate(v) },
  { prop: 'status', label: '状态', formatter: (_row, v) => (v === 1 ? '上架' : '下架') },
  { prop: 'description', label: '描述' },
  { prop: 'createTime', label: '创建时间' },
]

async function handleExport(format: 'xlsx' | 'csv') {
  exporting.value = true
  try {
    // 优先调用后端导出接口
    try {
      const blob = await api.dish.export({ ...buildQueryParams(), format })
      downloadBlob(blob, `菜品列表.${format}`, format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv;charset=utf-8;')
      ElMessage.success('导出成功')
      return
    } catch {
      // 后端不支持时降级为前端导出
    }
    const filename = `菜品列表_${formatDate(new Date(), 'YYYYMMDD_HHmmss')}`
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
    !searchForm.keyword &&
    searchForm.platformCategoryId === undefined &&
    searchForm.status === undefined
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

onMounted(() => {
  loadCategories()
  loadList()
})
</script>

<template>
  <div class="admin-dish">
    <AppHeader title="菜品管理" subtitle="管理平台所有菜品（菜品由商家创建，管理员仅可查看编辑）">
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
        <el-form-item label="菜品名称">
          <el-input v-model="searchForm.keyword" placeholder="请输入菜品名称" clearable />
        </el-form-item>
        <el-form-item label="平台分类">
          <el-select v-model="searchForm.platformCategoryId" placeholder="全部分类" clearable style="width: 160px">
            <el-option
              v-for="item in platformCategoryList"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部状态" clearable style="width: 120px">
            <el-option label="上架" :value="1" />
            <el-option label="下架" :value="0" />
          </el-select>
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
            type="danger"
            :icon="Delete"
            :disabled="selectedRows.length === 0"
            @click="handleBatchDelete"
          >
            批量删除 ({{ selectedRows.length }})
          </el-button>
        </template>

        <template #cell-image="{ row }">
          <div class="dish-image">
            <el-image
              v-if="row.image"
              :src="row.image"
              fit="cover"
              :preview-src-list="[row.image]"
              style="width: 56px; height: 56px; border-radius: 8px"
            />
            <div v-else class="image-placeholder">
              <el-icon :size="24"><Food /></el-icon>
            </div>
          </div>
        </template>

        <template #cell-categoryName="{ row }">
          <span v-if="row.categoryName">{{ row.categoryName }}</span>
          <span v-else class="text-muted">-</span>
        </template>

        <template #cell-platformCategoryName="{ row }">
          <el-tag v-if="row.platformCategoryName" type="warning" size="small">{{ row.platformCategoryName }}</el-tag>
          <span v-else class="text-muted">-</span>
        </template>

        <template #cell-price="{ row }">
          <div class="price-info">
            <span class="current-price">{{ formatAmount(row.price) }}</span>
            <span v-if="row.originalPrice" class="original-price">{{ formatAmount(row.originalPrice) }}</span>
          </div>
        </template>

        <template #cell-monthSales="{ row }">
          {{ formatNumber(row.monthSales ?? row.sales ?? row.totalSales ?? 0) }}
        </template>

        <template #cell-status="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'info'">
            {{ CommonStatusMap[row.status] || '未知' }}
          </el-tag>
        </template>

        <template #cell-createTime="{ row }">
          {{ formatDate(row.createTime) }}
        </template>

        <template #append>
          <el-table-column label="操作" width="220" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="handleView(row)">查看</el-button>
              <el-button link type="primary" @click="handleEdit(row)">编辑</el-button>
              <el-button link :type="row.status === 1 ? 'warning' : 'success'" @click="handleToggleStatus(row)">
                {{ row.status === 1 ? '下架' : '上架' }}
              </el-button>
              <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </template>
      </AppTable>
    </AppCard>

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailVisible" title="菜品详情" width="600px">
      <el-descriptions v-if="currentRow" :column="1" border>
        <el-descriptions-item label="ID">{{ currentRow.id }}</el-descriptions-item>
        <el-descriptions-item label="菜品图片">
          <el-image
            v-if="currentRow.image"
            :src="currentRow.image"
            fit="cover"
            style="width: 100px; height: 100px; border-radius: 8px"
          />
          <span v-else class="text-muted">无</span>
        </el-descriptions-item>
        <el-descriptions-item label="菜品名称">{{ currentRow.name }}</el-descriptions-item>
        <el-descriptions-item label="商家分类">{{ currentRow.categoryName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="平台分类">{{ currentRow.platformCategoryName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="现价">{{ formatAmount(currentRow.price) }}</el-descriptions-item>
        <el-descriptions-item label="原价">{{ currentRow.originalPrice ? formatAmount(currentRow.originalPrice) : '-' }}</el-descriptions-item>
        <el-descriptions-item label="销量">{{ currentRow.sales ?? currentRow.monthSales ?? currentRow.totalSales ?? 0 }}</el-descriptions-item>
        <el-descriptions-item label="库存">{{ currentRow.stock ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="描述">{{ currentRow.description || '-' }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="currentRow.status === 1 ? 'success' : 'info'">
            {{ CommonStatusMap[currentRow.status] || '未知' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatDate(currentRow.createTime) }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>

    <!-- 编辑弹窗（管理员仅可编辑，不可新增） -->
    <el-dialog v-model="formVisible" title="编辑菜品" width="640px">
      <el-form ref="formRef" :model="formData" :rules="rules" label-width="100px">
        <el-form-item label="菜品名称" prop="name">
          <el-input v-model="formData.name" placeholder="请输入菜品名称" maxlength="50" show-word-limit />
        </el-form-item>
        <el-form-item label="商家分类">
          <el-input :value="tableData.find(r => r.id === formData.id)?.categoryName || '-'" disabled />
        </el-form-item>
        <el-form-item label="平台分类标签">
          <el-select v-model="formData.platformCategoryId" placeholder="请选择平台分类标签" clearable style="width: 100%">
            <el-option
              v-for="item in platformCategoryList"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="现价" prop="price">
              <el-input-number
                v-model="formData.price"
                :min="0"
                :precision="2"
                :step="1"
                placeholder="请输入现价"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="原价">
              <el-input-number
                v-model="formData.originalPrice"
                :min="0"
                :precision="2"
                :step="1"
                placeholder="请输入原价"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="库存">
              <el-input-number v-model="formData.stock" :min="-1" :step="1" placeholder="-1 表示无限库存" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态" prop="status">
              <el-radio-group v-model="formData.status">
                <el-radio :label="1">上架</el-radio>
                <el-radio :label="0">下架</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="菜品描述">
          <el-input
            v-model="formData.description"
            type="textarea"
            :rows="3"
            placeholder="请输入菜品描述"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="菜品图片">
          <div class="upload-area" @click="triggerFileSelect">
            <el-image
              v-if="formData.image"
              :src="formData.image"
              fit="cover"
              style="width: 120px; height: 120px; border-radius: 8px"
            />
            <div v-else class="upload-placeholder">
              <el-icon :size="28"><Plus /></el-icon>
              <span>{{ uploading ? '上传中...' : '点击上传' }}</span>
            </div>
          </div>
          <input
            ref="fileInputRef"
            type="file"
            accept="image/jpeg,image/png"
            style="display: none"
            @change="handleFileChange"
          />
          <p class="upload-tip">支持 JPG、PNG 格式，建议尺寸 400x400</p>
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
.admin-dish {
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

  .dish-image {
    .image-placeholder {
      width: 56px;
      height: 56px;
      border-radius: $radius-md;
      background-color: $border-light;
      color: $text-muted;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }

  .price-info {
    display: flex;
    flex-direction: column;

    .current-price {
      color: $primary;
      font-weight: 600;
    }

    .original-price {
      font-size: $font-size-xs;
      color: $text-muted;
      text-decoration: line-through;
    }
  }

  .text-muted {
    color: $text-muted;
  }

  .upload-area {
    width: 120px;
    height: 120px;
    border: 2px dashed $border;
    border-radius: $radius-md;
    cursor: pointer;
    overflow: hidden;
    transition: border-color $transition-fast;

    &:hover {
      border-color: $primary;
    }
  }

  .upload-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: $text-muted;
    gap: $spacing-sm;
  }

  .upload-tip {
    margin-top: $spacing-sm;
    font-size: $font-size-sm;
    color: $text-muted;
  }
}
</style>
