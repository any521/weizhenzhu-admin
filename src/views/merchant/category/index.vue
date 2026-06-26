<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, reactive, ref, computed } from 'vue'
import { Plus, Rank } from '@element-plus/icons-vue'
import Sortable from 'sortablejs'
import { api } from '@/api'
import type { Category } from '@/api/types'
import { formatDate } from '@/utils/format'
import { CommonStatusMap } from '@/utils/constants'

// 加载状态
const loading = ref(false)
const dialogVisible = ref(false)
const submitLoading = ref(false)
const dragLoading = ref(false)

// 分类列表
const categoryList = ref<any[]>([])
const platformCategories = ref<Category[]>([])
const tableRef = ref<InstanceType<typeof ElTable>>()
let sortableInstance: Sortable | null = null

// 图标基础路径
const ICON_BASE = '/category-icons/'

// 图标别名映射
const ICON_ALIAS: Record<string, string> = {
  food: 'meishi', hotpot: 'huoguo', bbq: 'barbecue', burger: 'hanbao',
  chaocan: 'breakfast', zaocan: 'breakfast', mianshi: 'noodles', zhoufen: 'zhou',
  riliao: 'sushi', tianpin: 'dessert', cake: 'dessert', yinliao: 'drink',
  shuiguo: 'fruit', supermarket: 'store', chaoshi: 'store',
  yaopin: 'pharmacy', xianhua: 'flower', quanbu: 'more', all: 'more',
}

// 精简图标列表（商户菜品分类常用）
const iconList = [
  { name: 'meishi', label: '美食', color: '#FF6B35', group: '热门' },
  { name: 'huoguo', label: '火锅', color: '#FA541C', group: '热门' },
  { name: 'barbecue', label: '烧烤', color: '#D4380D', group: '热门' },
  { name: 'chuancai', label: '川菜', color: '#F5222D', group: '热门' },
  { name: 'xiaochi', label: '小吃', color: '#FF7A45', group: '热门' },
  { name: 'kuaican', label: '快餐', color: '#FF6B35', group: '热门' },
  { name: 'naicha', label: '奶茶', color: '#C68E5D', group: '热门' },

  { name: 'hanbao', label: '汉堡', color: '#FA8C16', group: '主食' },
  { name: 'pizza', label: '披萨', color: '#F5222D', group: '主食' },
  { name: 'jitui', label: '炸鸡', color: '#FA8C16', group: '主食' },
  { name: 'noodles', label: '面食', color: '#FAAD14', group: '主食' },
  { name: 'taocan', label: '套餐', color: '#FA541C', group: '主食' },
  { name: 'breakfast', label: '早餐', color: '#FAAD14', group: '主食' },
  { name: 'baozi', label: '包子', color: '#FAAD14', group: '主食' },
  { name: 'zhou', label: '粥', color: '#FAAD14', group: '主食' },
  { name: 'tang', label: '汤', color: '#FA8C16', group: '主食' },

  { name: 'sushi', label: '寿司', color: '#13C2C2', group: '特色' },
  { name: 'seafood', label: '海鲜', color: '#2F54EB', group: '特色' },
  { name: 'salad', label: '沙拉', color: '#52C41A', group: '特色' },
  { name: 'yuecai', label: '粤菜', color: '#FA8C16', group: '特色' },
  { name: 'dongbeicai', label: '饺子', color: '#8B4513', group: '特色' },
  { name: 'dongnanya', label: '东南亚', color: '#FA8C16', group: '特色' },
  { name: 'xiaolongxia', label: '小龙虾', color: '#F5222D', group: '特色' },
  { name: 'malaxiangguo', label: '麻辣香锅', color: '#FA541C', group: '特色' },
  { name: 'chuanchuan', label: '串串', color: '#D4380D', group: '特色' },

  { name: 'dessert', label: '甜品', color: '#FF8FAB', group: '饮品' },
  { name: 'icecream', label: '冰淇淋', color: '#40A9FF', group: '饮品' },
  { name: 'coffee', label: '咖啡', color: '#8B4513', group: '饮品' },
  { name: 'drink', label: '饮品', color: '#13C2C2', group: '饮品' },
  { name: 'beer', label: '啤酒', color: '#FAAD14', group: '饮品' },
  { name: 'doujiang', label: '豆浆', color: '#FADB14', group: '饮品' },
  { name: 'jianbing', label: '煎饼', color: '#FAAD14', group: '饮品' },

  { name: 'fruit', label: '水果', color: '#FF4D4F', group: '生鲜' },
  { name: 'vegetable', label: '蔬菜', color: '#73D13D', group: '生鲜' },
  { name: 'shengxian', label: '生鲜', color: '#F5222D', group: '生鲜' },
  { name: 'lingshi', label: '零食', color: '#FF7A45', group: '生鲜' },

  { name: 'yexiao', label: '夜宵', color: '#722ED1', group: '其他' },
  { name: 'brand', label: '品牌', color: '#FAAD14', group: '其他' },
  { name: 'more', label: '更多', color: '#8C8C8C', group: '其他' },
]

const iconMap = Object.fromEntries(iconList.map((i) => [i.name, i]))

const groupedIcons = computed(() => {
  const groups: Record<string, typeof iconList> = {}
  iconList.forEach((icon) => {
    if (!groups[icon.group]) groups[icon.group] = []
    groups[icon.group].push(icon)
  })
  return groups
})

const groupNames = computed(() => Object.keys(groupedIcons.value))
const activeGroup = ref('热门')

// 预设颜色
const colorList = [
  '#FF6B35', '#FA541C', '#F5222D', '#FA8C16', '#FAAD14',
  '#52C41A', '#13C2C2', '#2F54EB', '#722ED1', '#EB2F96',
  '#8B4513', '#595959',
]

function resolveIconFile(name: string): string {
  if (!name) return ICON_BASE + 'meishi.jpg'
  const actualName = ICON_ALIAS[name] || name
  return ICON_BASE + actualName + '.jpg'
}

function getIconDefaultColor(name: string): string {
  const actualName = ICON_ALIAS[name] || name
  return iconMap[actualName]?.color || '#FF6B35'
}

function selectIcon(iconName: string) {
  form.icon = iconName
  const currentIsDefault = !form.color || colorList.includes(form.color)
  if (currentIsDefault) {
    form.color = getIconDefaultColor(iconName)
  }
}

// 表单数据
const form = reactive<{
  name: string
  description: string
  categoryId: number | null
  icon: string
  color: string
  sort: number
  status: number
}>({
  name: '',
  description: '',
  categoryId: null,
  icon: 'meishi',
  color: '#FF6B35',
  sort: 1,
  status: 1,
})

// 表单引用
const formRef = ref<InstanceType<typeof ElForm>>()

// 当前编辑 ID
const editId = ref<number | undefined>(undefined)

// 表单校验规则
const rules = {
  name: [{ required: true, message: '请输入分类名称', trigger: 'blur' }],
  sort: [{ required: true, message: '请输入排序', trigger: 'blur' }],
}

// 获取平台分类列表
async function fetchPlatformCategories() {
  try {
    const res = await api.category.getPlatformList()
    platformCategories.value = res.data || []
  } catch (e) {
    console.error('获取平台分类失败', e)
  }
}

// 获取分类列表
async function fetchCategoryList() {
  loading.value = true
  try {
    const res = await api.category.getList()
    categoryList.value = res.data || []
  } catch (e: any) {
    ElMessage.error(e?.message || '获取分类列表失败')
  } finally {
    loading.value = false
  }
}

// 初始化拖拽排序
function initSortable() {
  if (sortableInstance) {
    sortableInstance.destroy()
    sortableInstance = null
  }
  const tbody = tableRef.value?.$el.querySelector('.el-table__body-wrapper tbody')
  if (!tbody) return

  sortableInstance = new Sortable(tbody, {
    handle: '.drag-handle',
    animation: 200,
    onEnd: handleDragEnd,
  })
}

// 拖拽结束处理
async function handleDragEnd(evt: Sortable.SortableEvent) {
  const { oldIndex, newIndex } = evt
  if (oldIndex === newIndex || oldIndex == null || newIndex == null) return

  const newList = [...categoryList.value]
  const [moved] = newList.splice(oldIndex, 1)
  newList.splice(newIndex, 0, moved)

  categoryList.value = newList
  dragLoading.value = true
  try {
    await api.category.reorder(newList.map((item) => item.id))
    ElMessage.success('排序已更新')
    await fetchCategoryList()
  } catch (e: any) {
    ElMessage.error(e?.message || '排序失败')
    await fetchCategoryList()
  } finally {
    dragLoading.value = false
  }
}

// 打开新增对话框
function handleAdd() {
  editId.value = undefined
  form.name = ''
  form.description = ''
  form.categoryId = null
  form.icon = 'meishi'
  form.color = '#FF6B35'
  form.sort = categoryList.value.length + 1
  form.status = 1
  activeGroup.value = '热门'
  dialogVisible.value = true
}

// 打开编辑对话框
function handleEdit(row: any) {
  editId.value = row.id
  form.name = row.name
  form.description = row.description || ''
  form.categoryId = row.categoryId || null
  form.icon = row.icon || 'meishi'
  form.color = row.color || getIconDefaultColor(row.icon || 'meishi')
  form.sort = row.sort
  form.status = row.status
  const iconInfo = iconMap[row.icon || 'meishi']
  if (iconInfo) {
    activeGroup.value = iconInfo.group
  }
  dialogVisible.value = true
}

// 删除分类
async function handleDelete(row: Category) {
  try {
    await ElMessageBox.confirm(
      `确认删除分类「${row.name}」吗？<br/><span class="text-gray-400 text-xs">删除前请确保分类下没有在售菜品</span>`,
      '删除确认',
      {
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        type: 'warning',
        dangerouslyUseHTMLString: true,
      }
    )
    await api.category.delete(row.id)
    ElMessage.success('删除成功')
    fetchCategoryList()
  } catch (e: any) {
    if (e !== 'cancel' && e?.message) {
      ElMessage.error(e.message)
    }
  }
}

// 切换状态
async function handleStatusChange(row: Category) {
  const newStatus = row.status === 1 ? 0 : 1
  try {
    await api.category.updateStatus(row.id, newStatus)
    row.status = newStatus
    ElMessage.success(newStatus === 1 ? '已启用' : '已禁用')
  } catch (e: any) {
    ElMessage.error(e?.message || '状态更新失败')
  }
}

// 根据平台分类ID获取名称
function getPlatformCategoryName(id: number): string {
  const found = platformCategories.value.find((c) => c.id === id)
  return found ? found.name : '-'
}

// 提交表单
async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitLoading.value = true
  try {
    if (editId.value) {
      await api.category.update(editId.value, { ...form })
    } else {
      await api.category.create({ ...form } as any)
    }
    ElMessage.success(editId.value ? '修改成功' : '新增成功')
    dialogVisible.value = false
    await fetchCategoryList()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    submitLoading.value = false
  }
}

onMounted(() => {
  fetchPlatformCategories()
  fetchCategoryList().then(() => {
    nextTick(initSortable)
  })
})

onUnmounted(() => {
  if (sortableInstance) {
    sortableInstance.destroy()
    sortableInstance = null
  }
})
</script>

<template>
  <div v-loading="dragLoading" class="merchant-category">
    <app-header title="分类管理">
      <el-button type="primary" :icon="Plus" @click="handleAdd">新增分类</el-button>
    </app-header>

    <app-card>
      <div class="text-xs text-gray-500 mb-4">
        <el-icon class="align-middle mr-1"><Rank /></el-icon>
        提示：拖拽左侧排序图标可调整分类展示顺序
      </div>

      <app-table
        ref="tableRef"
        :data="categoryList"
        :loading="loading"
        :show-pagination="false"
        row-key="id"
      >
        <el-table-column width="60" align="center">
          <template #default>
            <el-icon class="drag-handle cursor-move text-gray-400 hover:text-primary">
              <Rank />
            </el-icon>
          </template>
        </el-table-column>
        <el-table-column label="图标" width="80" align="center">
          <template #default="{ row }">
            <div class="icon-preview">
              <img class="icon-img" :src="resolveIconFile(row.icon)" :alt="row.name" />
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="分类名称" min-width="150" />
        <el-table-column prop="description" label="分类描述" min-width="200">
          <template #default="{ row }">
            <span class="text-gray-500">{{ row.description || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="所属平台分类" min-width="140">
          <template #default="{ row }">
            <span v-if="row.categoryId">{{ getPlatformCategoryName(row.categoryId) }}</span>
            <span v-else class="text-gray-400">未关联</span>
          </template>
        </el-table-column>
        <el-table-column prop="sort" label="排序" width="80" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">
              {{ CommonStatusMap[row.status] || '未知' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="160">
          <template #default="{ row }">
            {{ formatDate(row.createTime, 'YYYY-MM-DD HH:mm') }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button link :type="row.status === 1 ? 'warning' : 'success'" size="small" @click="handleStatusChange(row)">
              {{ row.status === 1 ? '禁用' : '启用' }}
            </el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </app-table>
    </app-card>

    <!-- 新增/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editId ? '编辑分类' : '新增分类'"
      width="680px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="分类名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入分类名称" maxlength="50" show-word-limit />
        </el-form-item>
        <el-form-item label="分类图标">
          <div class="icon-picker">
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
        <el-form-item label="图标颜色">
          <div class="color-picker">
            <div
              v-for="color in colorList"
              :key="color"
              class="color-picker__item"
              :class="{ 'is-active': form.color === color }"
              :style="{ backgroundColor: color }"
              @click="form.color = color"
            />
            <el-color-picker v-model="form.color" class="color-picker__custom" />
          </div>
        </el-form-item>
        <el-form-item label="预览">
          <div class="preview-box">
            <div class="preview-box__icon">
              <img class="preview-box__img" :src="resolveIconFile(form.icon)" :alt="form.name" />
            </div>
            <span class="preview-box__name">{{ form.name || '分类名称' }}</span>
          </div>
        </el-form-item>
        <el-form-item label="所属平台分类">
          <el-select v-model="form.categoryId" placeholder="请选择平台大分类（可选）" clearable style="width: 100%">
            <el-option
              v-for="cat in platformCategories"
              :key="cat.id"
              :label="cat.name"
              :value="cat.id"
            />
          </el-select>
          <div class="form-tip">关联平台大分类后，可用于按分类筛选和推荐</div>
        </el-form-item>
        <el-form-item label="分类描述">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            placeholder="请输入分类描述，最多200字"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="排序" prop="sort">
          <el-input-number v-model="form.sort" :min="1" :step="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :label="1">启用</el-radio>
            <el-radio :label="0">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.merchant-category {
  .drag-handle {
    font-size: 16px;
  }

  .icon-preview {
    width: 44px;
    height: 44px;
    border-radius: $radius-md;
    overflow: hidden;
    margin: 0 auto;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

    .icon-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: $radius-md;
    }
  }

  .form-tip {
    font-size: $font-size-xs;
    color: $text-muted;
    margin-top: 4px;
    line-height: 1.4;
  }

  .text-gray-500 {
    color: $text-light;
  }

  .text-gray-400 {
    color: $text-muted;
  }

  .hover\:text-primary:hover {
    color: $primary;
  }

  .align-middle {
    vertical-align: middle;
  }

  .mb-4 {
    margin-bottom: $spacing-md;
  }

  .mr-1 {
    margin-right: $spacing-xs;
  }

  .text-xs {
    font-size: $font-size-sm;
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
      }
    }

    &__grid {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      max-height: 240px;
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
      width: 60px;

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
      width: 44px;
      height: 44px;
      border-radius: $radius-md;
      overflow: hidden;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
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
      width: 26px;
      height: 26px;
      border-radius: $radius-sm;
      cursor: pointer;
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
    align-items: center;
    gap: $spacing-md;
    padding: $spacing-md;
    background-color: #fafafa;
    border-radius: $radius-md;

    &__icon {
      width: 56px;
      height: 56px;
      border-radius: $radius-md;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
      flex-shrink: 0;
    }

    &__img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    &__name {
      font-size: $font-size-md;
      color: $text;
      font-weight: 500;
    }
  }
}
</style>
