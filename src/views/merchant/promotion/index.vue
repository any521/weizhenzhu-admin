<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { api } from '@/api'
import type { Promotion } from '@/api/types'
import { formatDate } from '@/utils/format'
import { DEFAULT_PAGE_SIZE } from '@/utils/constants'

// 加载状态
const loading = ref(false)
const dialogVisible = ref(false)
const submitLoading = ref(false)

// 促销列表
const promotionList = ref<Promotion[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(DEFAULT_PAGE_SIZE)

// 表单数据
const form = ref<Partial<Promotion>>({
  name: '',
  type: 'fullReduction',
  startTime: '',
  endTime: '',
  status: 1,
  content: '',
})
const formRef = ref<InstanceType<typeof ElForm>>()
const editId = ref<number | undefined>(undefined)

// 类型选项
const typeOptions = [
  { value: 'fullReduction', label: '满减活动' },
  { value: 'discount', label: '折扣活动' },
  { value: 'coupon', label: '优惠券' },
]

// 表单校验
const rules = {
  name: [{ required: true, message: '请输入活动名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择活动类型', trigger: 'change' }],
  startTime: [{ required: true, message: '请选择开始时间', trigger: 'change' }],
  endTime: [{ required: true, message: '请选择结束时间', trigger: 'change' }],
  content: [{ required: true, message: '请输入活动内容', trigger: 'blur' }],
}

// 获取类型标签颜色
function getTypeTagType(type: string) {
  const map: Record<string, string> = {
    fullReduction: 'danger',
    discount: 'warning',
    coupon: 'success',
  }
  return map[type] || 'info'
}

// 获取类型文本
function getTypeText(type: string) {
  const item = typeOptions.find((t) => t.value === type)
  return item?.label || '未知'
}

// 获取促销列表
async function fetchPromotionList() {
  loading.value = true
  try {
    const res = await api.promotion.getList(page.value, pageSize.value)
    promotionList.value = res.data.list
    total.value = res.data.total
  } catch {
    promotionList.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

// 分页变化
function handlePageChange() {
  fetchPromotionList()
}

// 每页条数变化
function handleSizeChange() {
  page.value = 1
  fetchPromotionList()
}

// 新增
function handleAdd() {
  editId.value = undefined
  form.value = {
    name: '',
    type: 'fullReduction',
    startTime: '',
    endTime: '',
    status: 1,
    content: '',
  }
  dialogVisible.value = true
}

// 编辑
function handleEdit(row: Promotion) {
  editId.value = row.id
  form.value = { ...row }
  dialogVisible.value = true
}

// 删除
async function handleDelete(row: Promotion) {
  try {
    await ElMessageBox.confirm(`确认删除活动「${row.name}」吗？`, '提示', {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      type: 'warning',
    })
    if (row.id) {
      await api.promotion.delete(row.id)
      ElMessage.success('删除成功')
      fetchPromotionList()
    }
  } catch {
    // 用户取消或删除失败
  }
}

// 提交
async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitLoading.value = true
  try {
    await api.promotion.save(form.value)
    ElMessage.success(editId.value ? '修改成功' : '新增成功')
    dialogVisible.value = false
    fetchPromotionList()
  } finally {
    submitLoading.value = false
  }
}

onMounted(() => {
  fetchPromotionList()
})
</script>

<template>
  <div class="merchant-promotion">
    <app-header title="促销管理">
      <template #right>
        <el-button type="primary" :icon="Plus" @click="handleAdd">新增活动</el-button>
      </template>
    </app-header>

    <app-card>
      <app-table
        v-model:page="page"
        v-model:page-size="pageSize"
        :data="promotionList"
        :loading="loading"
        :total="total"
        @page-change="handlePageChange"
        @size-change="handleSizeChange"
      >
        <el-table-column prop="name" label="活动名称" min-width="160" show-overflow-tooltip />
        <el-table-column label="类型" width="110">
          <template #default="{ row }">
            <el-tag :type="getTypeTagType(row.type)" size="small">{{ getTypeText(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="content" label="活动内容" min-width="180" show-overflow-tooltip />
        <el-table-column label="有效期" min-width="220">
          <template #default="{ row }">
            {{ formatDate(row.startTime, 'YYYY-MM-DD') }} 至 {{ formatDate(row.endTime, 'YYYY-MM-DD') }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">
              {{ row.status === 1 ? '进行中' : '已结束' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </app-table>
    </app-card>

    <!-- 新增/编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="editId ? '编辑活动' : '新增活动'" width="560px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="活动名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入活动名称" maxlength="50" show-word-limit />
        </el-form-item>
        <el-form-item label="活动类型" prop="type">
          <el-select v-model="form.type" placeholder="请选择活动类型" style="width: 100%">
            <el-option
              v-for="item in typeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="活动时间" prop="startTime">
          <el-date-picker
            v-model="form.startTime"
            type="datetime"
            placeholder="开始时间"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 48%"
          />
          <span style="margin: 0 2%">至</span>
          <el-date-picker
            v-model="form.endTime"
            type="datetime"
            placeholder="结束时间"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 48%"
          />
        </el-form-item>
        <el-form-item label="活动内容" prop="content">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="3"
            placeholder="请输入活动内容"
            maxlength="100"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :label="1">进行中</el-radio>
            <el-radio :label="0">已结束</el-radio>
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
.merchant-promotion {
  // 样式统一使用组件和变量
}
</style>
