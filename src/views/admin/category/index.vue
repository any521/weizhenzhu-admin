<script setup lang="ts">
import { ref, onMounted, reactive, computed } from 'vue'
import { Plus, Search, RefreshRight, Download, Delete, Star } from '@element-plus/icons-vue'
import {
  Food,
  IceCream,
  Coffee,
  Apple,
  Burger,
  Sugar,
  ForkSpoon,
  KnifeFork,
  Dessert,
  IceDrink,
  HotWater,
  Shop,
  FirstAidKit,
  Basketball,
  Van,
  Service,
  Present,
  Star as StarIcon,
  More,
} from '@element-plus/icons-vue'
import { api } from '@/api'
import AppCard from '@/components/AppCard.vue'
import AppHeader from '@/components/AppHeader.vue'
import AppTable, { type TableColumn } from '@/components/AppTable.vue'
import { formatDate, mapStatus } from '@/utils/format'
import { CommonStatusMap } from '@/utils/constants'
import { exportToExcel, exportToCsv, type ExportColumn } from '@/utils/export'
import { useSavedQueries, type SavedQuery } from '@/composables/useSavedQueries'
import type { Category, CategoryCreateDTO } from '@/api/types'
import type { FormInstance, FormRules } from 'element-plus'

// 预设图标列表（Element Plus 图标组件）
const iconList = [
  { name: 'Food', component: Food },
  { name: 'IceCream', component: IceCream },
  { name: 'Coffee', component: Coffee },
  { name: 'Apple', component: Apple },
  { name: 'Burger', component: Burger },
  { name: 'Sugar', component: Sugar },
  { name: 'ForkSpoon', component: ForkSpoon },
  { name: 'KnifeFork', component: KnifeFork },
  { name: 'Dessert', component: Dessert },
  { name: 'IceDrink', component: IceDrink },
  { name: 'HotWater', component: HotWater },
  { name: 'Shop', component: Shop },
  { name: 'FirstAidKit', component: FirstAidKit },
  { name: 'Basketball', component: Basketball },
  { name: 'Van', component: Van },
  { name: 'Service', component: Service },
  { name: 'Present', component: Present },
  { name: 'Star', component: StarIcon },
  { name: 'More', component: More },
]

// 预设颜色列表
const colorList = [
  '#FF6B35',
  '#FFC107',
  '#4CAF50',
  '#2196F3',
  '#9C27B0',
  '#E91E63',
  '#00BCD4',
  '#FF5722',
  '#795548',
  '#F44336',
  '#AB47BC',
  '#26C6DA',
  '#FF8C42',
  '#FFD54F',
  '#8BC34A',
  '#03A9F4',
  '#BA68C8',
  '#F06292',
]

// 搜索表单
interface SearchForm {
  keyword: string
  status: number | undefined
}

const searchForm = reactive<SearchForm>({
  keyword: '',
  status: undefined,
})

const loading = ref(false)
const exporting = ref(false)
const tableData = ref<Category[]>([])

// 批量选择
const selectedRows = ref<Category[]>([])

// 表单弹窗
const dialogVisible = ref(false)
const formLoading = ref(false)
const isEdit = computed(() => !!form.id)
const form = reactive<CategoryCreateDTO>({
  id: undefined,
  name: '',
  icon: 'Food',
  color: '#FF6B35',
  sort: 1,
  status: 1,
})
const formRef = ref<FormInstance>()

const rules: FormRules = {
  name: [{ required: true, message: '请输入分类名称', trigger: 'blur' }],
  icon: [{ required: true, message: '请选择图标', trigger: 'change' }],
  color: [{ required: true, message: '请选择颜色', trigger: 'change' }],
  sort: [{ required: true, message: '请输入排序', trigger: 'blur' }],
}

// 列定义
const columns: TableColumn[] = [
  { prop: 'id', label: 'ID', width: 80 },
  { prop: 'name', label: '名称', minWidth: 150 },
  { prop: 'icon', label: '图标', width: 100, align: 'center' },
  { prop: 'color', label: '颜色', width: 120, align: 'center' },
  { prop: 'sort', label: '排序', width: 100, sortable: true },
  { prop: 'status', label: '状态', width: 100 },
  { prop: 'createTime', label: '创建时间', minWidth: 170, sortable: true },
]

// 查询条件保存
const { savedQueries, saveQuery, deleteQuery, applyQuery } = useSavedQueries('admin_category')

// 保存查询弹窗
const saveQueryVisible = ref(false)
const saveQueryName = ref('')

// 获取图标组件
function getIconComponent(name: string) {
  return iconList.find((item) => item.name === name)?.component || More
}

// 加载分类列表
async function loadList() {
  loading.value = true
  try {
    const res = await api.category.getList()
    let list = res.data
    // 前端筛选
    if (searchForm.keyword) {
      list = list.filter((c) => c.name.includes(searchForm.keyword))
    }
    if (searchForm.status !== undefined) {
      list = list.filter((c) => c.status === searchForm.status)
    }
    tableData.value = list
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  loadList()
}

function handleReset() {
  searchForm.keyword = ''
  searchForm.status = undefined
  handleSearch()
}

function handleSortChange({ prop, order }: { prop: string; order: 'ascending' | 'descending' | null }) {
  if (!order) {
    loadList()
    return
  }
  const sorted = [...tableData.value]
  sorted.sort((a: any, b: any) => {
    const va = a[prop]
    const vb = b[prop]
    if (typeof va === 'number' && typeof vb === 'number') {
      return order === 'ascending' ? va - vb : vb - va
    }
    return order === 'ascending'
      ? String(va).localeCompare(String(vb))
      : String(vb).localeCompare(String(va))
  })
  tableData.value = sorted
}

function handleSelectionChange(selection: Category[]) {
  selectedRows.value = selection
}

function handleAdd() {
  Object.assign(form, {
    id: undefined,
    name: '',
    icon: 'Food',
    color: '#FF6B35',
    sort: tableData.value.length + 1,
    status: 1,
  })
  dialogVisible.value = true
}

function handleEdit(row: Category & { color?: string }) {
  Object.assign(form, {
    id: row.id,
    name: row.name,
    icon: row.icon || 'Food',
    color: row.color || '#FF6B35',
    sort: row.sort,
    status: row.status,
  })
  dialogVisible.value = true
}

async function handleToggleStatus(row: Category) {
  const action = row.status === 1 ? '禁用' : '启用'
  try {
    await ElMessageBox.confirm(`确定要${action}分类「${row.name}」吗？`, '提示', { type: 'warning' })
    await api.category.updateStatus(row.id, row.status === 1 ? 0 : 1)
    row.status = row.status === 1 ? 0 : 1
    ElMessage.success(`${action}成功`)
  } catch {
    // 取消
  }
}

async function handleDelete(row: Category) {
  try {
    await ElMessageBox.confirm(`确定删除分类「${row.name}」吗？`, '提示', {
      type: 'warning',
      confirmButtonText: '确认',
      cancelButtonText: '取消',
    })
    await api.category.delete(row.id)
    ElMessage.success('删除成功')
    loadList()
  } catch {
    // 取消
  }
}

async function handleBatchDelete() {
  if (selectedRows.value.length === 0) {
    ElMessage.warning('请先选择要删除的分类')
    return
  }
  try {
    await ElMessageBox.confirm(`确定要删除选中的 ${selectedRows.value.length} 个分类吗？`, '提示', {
      type: 'warning',
      confirmButtonText: '确认',
      cancelButtonText: '取消',
    })
    await Promise.all(selectedRows.value.map((row) => api.category.delete(row.id)))
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
    await api.category.save(form)
    ElMessage.success(isEdit.value ? '更新成功' : '创建成功')
    dialogVisible.value = false
    loadList()
  } finally {
    formLoading.value = false
  }
}

// 导出
const exportColumns: ExportColumn[] = [
  { prop: 'id', label: 'ID' },
  { prop: 'name', label: '名称' },
  { prop: 'icon', label: '图标' },
  { prop: 'color', label: '颜色' },
  { prop: 'sort', label: '排序' },
  { prop: 'status', label: '状态', formatter: (_row, v) => mapStatus(v, CommonStatusMap) },
  { prop: 'createTime', label: '创建时间', formatter: (_row, v) => formatDate(v) },
]

async function handleExport(format: 'xlsx' | 'csv') {
  exporting.value = true
  try {
    const filename = `分类列表_${formatDate(new Date(), 'YYYYMMDD_HHmmss')}`
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
  if (!searchForm.keyword && searchForm.status === undefined) {
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
  <div class="admin-category">
    <AppHeader title="分类管理" subtitle="管理平台商家经营分类">
      <el-button type="primary" :icon="Plus" @click="handleAdd">新增分类</el-button>
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
          <el-input v-model="searchForm.keyword" placeholder="分类名称" clearable />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部状态" clearable style="width: 120px">
            <el-option label="启用" :value="1" />
            <el-option label="禁用" :value="0" />
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
        :data="tableData"
        :loading="loading"
        :total="tableData.length"
        :columns="columns"
        :show-pagination="false"
        selectable
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

        <template #cell-icon="{ row }">
          <div class="icon-preview" :style="{ backgroundColor: (row as any).color || '#FF6B35' }">
            <el-icon :size="20" color="#fff">
              <component :is="getIconComponent(row.icon)" />
            </el-icon>
          </div>
        </template>

        <template #cell-color="{ row }">
          <div class="color-preview">
            <span class="color-block" :style="{ backgroundColor: (row as any).color || '#FF6B35' }" />
            <span class="color-text">{{ (row as any).color || '-' }}</span>
          </div>
        </template>

        <template #cell-status="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'info'">
            {{ mapStatus(row.status, CommonStatusMap) }}
          </el-tag>
        </template>

        <template #cell-createTime="{ row }">
          {{ formatDate(row.createTime) }}
        </template>

        <template #append>
          <el-table-column label="操作" width="180" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="handleEdit(row as any)">编辑</el-button>
              <el-button link :type="row.status === 1 ? 'danger' : 'success'" @click="handleToggleStatus(row)">
                {{ row.status === 1 ? '禁用' : '启用' }}
              </el-button>
              <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </template>
      </AppTable>
    </AppCard>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑分类' : '新增分类'" width="520px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="分类名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入分类名称" maxlength="20" show-word-limit />
        </el-form-item>
        <el-form-item label="图标" prop="icon">
          <div class="icon-picker">
            <div
              v-for="item in iconList"
              :key="item.name"
              class="icon-picker__item"
              :class="{ 'is-active': form.icon === item.name }"
              :style="{ backgroundColor: form.icon === item.name ? form.color : '' }"
              @click="form.icon = item.name"
            >
              <el-icon :size="20" :color="form.icon === item.name ? '#fff' : '#666'">
                <component :is="item.component" />
              </el-icon>
            </div>
          </div>
        </el-form-item>
        <el-form-item label="颜色" prop="color">
          <div class="color-picker">
            <div
              v-for="color in colorList"
              :key="color"
              class="color-picker__item"
              :class="{ 'is-active': form.color === color }"
              :style="{ backgroundColor: color }"
              @click="form.color = color"
            >
              <el-icon v-if="form.color === color" :size="14" color="#fff"><StarIcon /></el-icon>
            </div>
            <el-color-picker v-model="form.color" class="color-picker__custom" />
          </div>
        </el-form-item>
        <el-form-item label="预览">
          <div class="preview-box">
            <div class="preview-box__icon" :style="{ backgroundColor: form.color }">
              <el-icon :size="28" color="#fff">
                <component :is="getIconComponent(form.icon)" />
              </el-icon>
            </div>
            <span class="preview-box__name">{{ form.name || '分类名称' }}</span>
          </div>
        </el-form-item>
        <el-form-item label="排序" prop="sort">
          <el-input-number v-model="form.sort" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio :label="1">启用</el-radio>
            <el-radio :label="0">禁用</el-radio>
          </el-radio-group>
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
.admin-category {
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

  .icon-preview {
    width: 36px;
    height: 36px;
    border-radius: $radius-md;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto;
  }

  .color-preview {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    justify-content: center;

    .color-block {
      width: 20px;
      height: 20px;
      border-radius: $radius-sm;
      border: 1px solid $border-light;
    }

    .color-text {
      font-size: $font-size-xs;
      color: $text-muted;
    }
  }

  .icon-picker {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-sm;

    &__item {
      width: 40px;
      height: 40px;
      border-radius: $radius-md;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      border: 1px solid $border-light;
      transition: all 0.2s;

      &:hover {
        border-color: $primary;
      }

      &.is-active {
        border-color: $primary;
      }
    }
  }

  .color-picker {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-sm;
    align-items: center;

    &__item {
      width: 28px;
      height: 28px;
      border-radius: $radius-sm;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid transparent;
      transition: all 0.2s;

      &:hover {
        transform: scale(1.1);
      }

      &.is-active {
        border-color: $text;
      }
    }

    &__custom {
      margin-left: $spacing-sm;
    }
  }

  .preview-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: $spacing-sm;
    padding: $spacing-md;
    background-color: #fafafa;
    border-radius: $radius-md;
    min-width: 100px;

    &__icon {
      width: 56px;
      height: 56px;
      border-radius: $radius-md;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    &__name {
      font-size: $font-size-sm;
      color: $text;
    }
  }
}
</style>
