<script setup lang="ts">
import { ref, onMounted, reactive, computed } from 'vue'
import { Plus, Search, RefreshRight, Download, Delete, Star } from '@element-plus/icons-vue'
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

// 图标基础路径
const ICON_BASE = '/category-icons/'

// 图标别名映射：别名 -> 实际文件名
// 用于处理不同名称指向同一图标的情况
const ICON_ALIAS: Record<string, string> = {
  // 美食别名
  food: 'meishi',
  hotpot: 'huoguo',
  bbq: 'barbecue',
  burger: 'hanbao',
  // 早餐别名
  chaocan: 'breakfast',
  zaocan: 'breakfast',
  // 面食别名
  mianshi: 'noodles',
  zhoufen: 'zhou',
  // 日料别名
  riliao: 'sushi',
  // 甜品别名
  tianpin: 'dessert',
  cake: 'dessert',
  // 饮品别名
  yinliao: 'drink',
  // 水果别名
  shuiguo: 'fruit',
  // 超市别名
  supermarket: 'store',
  chaoshi: 'store',
  // 药店别名
  yaopin: 'pharmacy',
  // 鲜花别名
  xianhua: 'flower',
  // 功能别名
  quanbu: 'more',
  all: 'more',
}

// 图标列表（全部50个3D黏土风格图片，每个都有对应的.jpg文件）
// 按类别分组排列，便于查找
const iconList = [
  // === 热门/推荐 ===
  { name: 'meishi', label: '美食', color: '#FF6B35', group: '热门' },
  { name: 'huoguo', label: '火锅', color: '#FA541C', group: '热门' },
  { name: 'barbecue', label: '烧烤', color: '#D4380D', group: '热门' },
  { name: 'kuaican', label: '快餐', color: '#FF6B35', group: '热门' },
  { name: 'naicha', label: '奶茶', color: '#C68E5D', group: '热门' },

  // === 中式菜系 ===
  { name: 'chuancai', label: '川菜', color: '#F5222D', group: '中式菜系' },
  { name: 'xiaochi', label: '小吃', color: '#FF7A45', group: '中式菜系' },
  { name: 'xiaolongxia', label: '小龙虾', color: '#F5222D', group: '中式菜系' },
  { name: 'malaxiangguo', label: '麻辣香锅', color: '#FA541C', group: '中式菜系' },
  { name: 'chuanchuan', label: '串串', color: '#D4380D', group: '中式菜系' },
  { name: 'yuecai', label: '粤菜/点心', color: '#FA8C16', group: '中式菜系' },
  { name: 'dongbeicai', label: '东北菜/饺子', color: '#8B4513', group: '中式菜系' },
  { name: 'yexiao', label: '夜宵', color: '#722ED1', group: '中式菜系' },

  // === 西式/异国料理 ===
  { name: 'hanbao', label: '汉堡', color: '#FA8C16', group: '异国料理' },
  { name: 'pizza', label: '披萨', color: '#F5222D', group: '异国料理' },
  { name: 'jitui', label: '炸鸡/鸡腿', color: '#FA8C16', group: '异国料理' },
  { name: 'sushi', label: '寿司/日料', color: '#13C2C2', group: '异国料理' },
  { name: 'dongnanya', label: '东南亚菜', color: '#FA8C16', group: '异国料理' },
  { name: 'seafood', label: '海鲜', color: '#2F54EB', group: '异国料理' },
  { name: 'salad', label: '沙拉/轻食', color: '#52C41A', group: '异国料理' },
  { name: 'taocan', label: '套餐', color: '#FA541C', group: '异国料理' },

  // === 早餐/粥面 ===
  { name: 'breakfast', label: '早餐', color: '#FAAD14', group: '早餐粥面' },
  { name: 'baozi', label: '包子', color: '#FAAD14', group: '早餐粥面' },
  { name: 'doujiang', label: '豆浆', color: '#FADB14', group: '早餐粥面' },
  { name: 'jianbing', label: '煎饼', color: '#FAAD14', group: '早餐粥面' },
  { name: 'noodles', label: '面食', color: '#FAAD14', group: '早餐粥面' },
  { name: 'zhou', label: '粥/稀饭', color: '#FAAD14', group: '早餐粥面' },
  { name: 'tang', label: '汤/炖汤', color: '#FA8C16', group: '早餐粥面' },

  // === 甜品饮品 ===
  { name: 'dessert', label: '甜品/蛋糕', color: '#FF8FAB', group: '甜品饮品' },
  { name: 'icecream', label: '冰淇淋', color: '#40A9FF', group: '甜品饮品' },
  { name: 'coffee', label: '咖啡', color: '#8B4513', group: '甜品饮品' },
  { name: 'drink', label: '饮品/饮料', color: '#13C2C2', group: '甜品饮品' },
  { name: 'beer', label: '啤酒', color: '#FAAD14', group: '甜品饮品' },
  { name: 'wine', label: '酒水', color: '#722ED1', group: '甜品饮品' },

  // === 生鲜商超 ===
  { name: 'shengxian', label: '生鲜', color: '#F5222D', group: '生鲜商超' },
  { name: 'fruit', label: '水果', color: '#FF4D4F', group: '生鲜商超' },
  { name: 'vegetable', label: '蔬菜', color: '#73D13D', group: '生鲜商超' },
  { name: 'store', label: '超市/商店', color: '#2F54EB', group: '生鲜商超' },
  { name: 'lingshi', label: '零食', color: '#FF7A45', group: '生鲜商超' },
  { name: 'pharmacy', label: '药店/药品', color: '#52C41A', group: '生鲜商超' },
  { name: 'flower', label: '鲜花', color: '#EB2F96', group: '生鲜商超' },

  // === 生活服务 ===
  { name: 'brand', label: '品牌馆', color: '#FAAD14', group: '生活服务' },
  { name: 'errand', label: '跑腿代购', color: '#52C41A', group: '生活服务' },
  { name: 'techan', label: '特产/礼品', color: '#FA541C', group: '生活服务' },
  { name: 'muying', label: '母婴', color: '#FF85C0', group: '生活服务' },
  { name: 'chongwu', label: '宠物', color: '#8B4513', group: '生活服务' },
  { name: 'wenju', label: '文具', color: '#1890FF', group: '生活服务' },
  { name: 'shuma', label: '数码3C', color: '#595959', group: '生活服务' },
  { name: 'meizhuang', label: '美妆', color: '#EB2F96', group: '生活服务' },
  { name: 'more', label: '更多/其他', color: '#8C8C8C', group: '生活服务' },
]

// 图标映射（key -> 配置）
const iconMap = Object.fromEntries(iconList.map((i) => [i.name, i]))

// 获取图标实际URL（处理别名）
function resolveIconFile(name: string): string {
  const actualName = ICON_ALIAS[name] || name
  // 检查是否在图标列表中
  if (iconMap[actualName]) {
    return ICON_BASE + actualName + '.jpg'
  }
  return ICON_BASE + 'more.jpg'
}

function getIconUrl(name: string): string {
  if (!name) return ICON_BASE + 'more.jpg'
  return resolveIconFile(name)
}

function getIconDefaultColor(name: string): string {
  const actualName = ICON_ALIAS[name] || name
  return iconMap[actualName]?.color || '#FF6B35'
}

function getIconLabel(name: string): string {
  const actualName = ICON_ALIAS[name] || name
  return iconMap[actualName]?.label || name
}

// 按分组整理图标
const groupedIcons = computed(() => {
  const groups: Record<string, typeof iconList> = {}
  iconList.forEach((icon) => {
    if (!groups[icon.group]) groups[icon.group] = []
    groups[icon.group].push(icon)
  })
  return groups
})

const groupNames = computed(() => Object.keys(groupedIcons.value))

// 预设颜色列表（从图标配色中提取）
const colorList = [
  '#FF6B35', '#FA541C', '#F5222D', '#FA8C16', '#FAAD14',
  '#FADB14', '#52C41A', '#73D13D', '#13C2C2', '#40A9FF',
  '#2F54EB', '#722ED1', '#9254DE', '#EB2F96', '#FF85C0',
  '#8B4513', '#595959', '#8C8C8C',
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
  icon: 'meishi',
  color: '#FF6B35',
  sort: 1,
  status: 1,
})
const formRef = ref<FormInstance>()
const activeGroup = ref('热门')

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

function selectIcon(iconName: string) {
  form.icon = iconName
  // 如果当前颜色是默认颜色，则自动切换为该图标的默认推荐颜色
  const currentIsDefault = !form.color || colorList.includes(form.color as string)
  if (currentIsDefault) {
    form.color = getIconDefaultColor(iconName)
  }
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
    icon: 'meishi',
    color: '#FF6B35',
    sort: tableData.value.length + 1,
    status: 1,
  })
  activeGroup.value = '热门'
  dialogVisible.value = true
}

function handleEdit(row: Category & { color?: string }) {
  Object.assign(form, {
    id: row.id,
    name: row.name,
    icon: row.icon || 'meishi',
    color: row.color || getIconDefaultColor(row.icon || 'meishi'),
    sort: row.sort,
    status: row.status,
  })
  // 找到图标所在分组
  const iconInfo = iconMap[row.icon || 'meishi']
  if (iconInfo) {
    activeGroup.value = iconInfo.group
  }
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
  { prop: 'icon', label: '图标', formatter: (_row, v) => getIconLabel(v as string) },
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
    <AppHeader title="分类管理" subtitle="管理平台商家经营分类（50个3D黏土风格图标）">
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
          <div class="icon-preview">
            <img class="icon-img" :src="getIconUrl(row.icon)" :alt="row.name" />
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
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑分类' : '新增分类'" width="780px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="分类名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入分类名称" maxlength="20" show-word-limit />
        </el-form-item>
        <el-form-item label="分类图标" prop="icon">
          <div class="icon-picker">
            <!-- 分组标签 -->
            <div class="icon-picker__tabs">
              <span
                v-for="groupName in groupNames"
                :key="groupName"
                class="icon-picker__tab"
                :class="{ 'is-active': activeGroup === groupName }"
                @click="activeGroup = groupName"
              >
                {{ groupName }}
              </span>
            </div>
            <!-- 图标网格 -->
            <div class="icon-picker__grid">
              <div
                v-for="item in groupedIcons[activeGroup]"
                :key="item.name"
                class="icon-picker__item"
                :class="{ 'is-active': form.icon === item.name }"
                @click="selectIcon(item.name)"
                :title="item.label"
              >
                <div class="icon-picker__img-wrap">
                  <img class="icon-picker__img" :src="ICON_BASE + item.name + '.jpg'" :alt="item.label" />
                </div>
                <span class="icon-picker__label">{{ item.label }}</span>
              </div>
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
              <el-icon v-if="form.color === color" :size="14" color="#fff"><Star /></el-icon>
            </div>
            <el-color-picker v-model="form.color" class="color-picker__custom" />
          </div>
        </el-form-item>
        <el-form-item label="预览">
          <div class="preview-box">
            <div class="preview-box__icon">
              <img class="preview-box__img" :src="getIconUrl(form.icon)" :alt="form.name" />
            </div>
            <span class="preview-box__name">{{ form.name || '分类名称' }}</span>
            <span class="preview-box__key">{{ form.icon }}</span>
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
    width: 48px;
    height: 48px;
    border-radius: $radius-md;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);

    .icon-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: $radius-md;
    }
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
    width: 100%;
    border: 1px solid $border-light;
    border-radius: $radius-md;
    overflow: hidden;

    &__tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 0;
      border-bottom: 1px solid $border-light;
      background: #fafafa;
      padding: 4px 4px 0;
    }

    &__tab {
      padding: 6px 14px;
      font-size: $font-size-sm;
      color: $text-light;
      cursor: pointer;
      border-radius: $radius-sm $radius-sm 0 0;
      transition: all 0.2s;
      white-space: nowrap;

      &:hover {
        color: $primary;
      }

      &.is-active {
        color: $primary;
        background: #fff;
        font-weight: 500;
        box-shadow: 0 -2px 6px rgba(0, 0, 0, 0.06);
      }
    }

    &__grid {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      max-height: 280px;
      overflow-y: auto;
      padding: $spacing-sm;
    }

    &__item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      padding: 6px;
      border-radius: $radius-md;
      border: 2px solid transparent;
      transition: all 0.2s;
      width: 64px;

      &:hover {
        background-color: #f5f5f5;
        transform: translateY(-2px);
      }

      &.is-active {
        border-color: $primary;
        background-color: rgba($primary, 0.08);
      }
    }

    &__img-wrap {
      width: 48px;
      height: 48px;
      border-radius: $radius-md;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    &__img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    &__label {
      font-size: 11px;
      color: $text-muted;
      text-align: center;
      white-space: nowrap;
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
        transform: scale(1.15);
      }

      &.is-active {
        border-color: $text;
        transform: scale(1.1);
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
    min-width: 140px;

    &__icon {
      width: 64px;
      height: 64px;
      border-radius: $radius-md;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    &__img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    &__name {
      font-size: $font-size-sm;
      color: $text;
      font-weight: 500;
    }

    &__key {
      font-size: $font-size-xs;
      color: $text-muted;
      font-family: monospace;
    }
  }
}
</style>
