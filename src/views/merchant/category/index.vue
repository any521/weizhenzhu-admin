<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, reactive, ref } from 'vue'
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
const categoryList = ref<Category[]>([])
const tableRef = ref<InstanceType<typeof ElTable>>()
let sortableInstance: Sortable | null = null

// 表单数据
const form = reactive<Partial<Category>>({
  name: '',
  description: '',
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

  // 乐观更新 UI
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
  form.sort = categoryList.value.length + 1
  form.status = 1
  dialogVisible.value = true
}

// 打开编辑对话框
function handleEdit(row: Category) {
  editId.value = row.id
  form.name = row.name
  form.description = row.description || ''
  form.sort = row.sort
  form.status = row.status
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
        <el-table-column prop="name" label="分类名称" min-width="150" />
        <el-table-column prop="description" label="分类描述" min-width="200">
          <template #default="{ row }">
            <span class="text-gray-500">{{ row.description || '-' }}</span>
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
      width="500px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="分类名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入分类名称" maxlength="50" show-word-limit />
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
}
</style>
