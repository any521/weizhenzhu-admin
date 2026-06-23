<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Plus } from '@element-plus/icons-vue'
import { api } from '@/api'
import type { Dish, Category } from '@/api/types'

const route = useRoute()
const router = useRouter()

// 加载状态
const loading = ref(false)
const submitLoading = ref(false)

// 分类列表
const categoryList = ref<Category[]>([])

// 表单数据
const form = reactive<Partial<Dish>>({
  name: '',
  categoryId: undefined,
  price: undefined,
  originalPrice: undefined,
  stock: undefined,
  status: 1,
  description: '',
  image: '',
})

// 表单引用
const formRef = ref<InstanceType<typeof ElForm>>()

// 表单校验规则
const rules = {
  name: [{ required: true, message: '请输入菜品名称', trigger: 'blur' }],
  categoryId: [{ required: true, message: '请选择分类', trigger: 'change' }],
  price: [{ required: true, message: '请输入价格', trigger: 'blur' }],
  status: [{ required: true, message: '请选择状态', trigger: 'change' }],
}

// 当前编辑 ID（使用 string 避免 Long 类型在 JS 中精度丢失）
const editId = ref<string | undefined>(undefined)

// 图片上传中
const uploading = ref(false)

// 隐藏的文件输入
const fileInputRef = ref<HTMLInputElement | null>(null)

// 触发文件选择
function triggerFileSelect() {
  fileInputRef.value?.click()
}

// 处理文件上传
async function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  uploading.value = true
  try {
    const res = await api.file.upload(file)
    form.image = res.data.url
    ElMessage.success('图片上传成功')
  } catch {
    ElMessage.error('图片上传失败')
  } finally {
    uploading.value = false
    // 重置 input，允许重复选择同一文件
    target.value = ''
  }
}

// 获取分类列表
async function fetchCategories() {
  try {
    const res = await api.category.getList()
    categoryList.value = res.data
  } catch {
    categoryList.value = []
  }
}

// 获取菜品详情
async function fetchDishDetail() {
  if (!editId.value) return
  loading.value = true
  try {
    const res = await api.dish.getDetail(editId.value)
    const dish = res.data
    Object.assign(form, {
      ...dish,
      description: dish.description || '',
      image: dish.image || '',
    })
  } finally {
    loading.value = false
  }
}

// 保存菜品
async function handleSave() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitLoading.value = true
  try {
    const payload: Partial<Dish> = {
      name: form.name,
      categoryId: form.categoryId,
      price: form.price,
      originalPrice: form.originalPrice,
      stock: form.stock,
      status: form.status,
      description: form.description,
      image: form.image,
    }
    if (editId.value) {
      await api.dish.update(editId.value, payload)
    } else {
      await api.dish.add(payload)
    }
    ElMessage.success(editId.value ? '保存成功' : '新增成功')
    router.push('/merchant/dishes')
  } finally {
    submitLoading.value = false
  }
}

// 取消返回
function handleCancel() {
  router.back()
}

onMounted(() => {
  const id = route.params.id
  if (id) {
    editId.value = String(id)
  }
  fetchCategories()
  fetchDishDetail()
})
</script>

<template>
  <div v-loading="loading" class="merchant-dish-edit">
    <app-header :title="editId ? '编辑菜品' : '新增菜品'">
      <el-button @click="handleCancel">取消</el-button>
      <el-button type="primary" :loading="submitLoading" @click="handleSave">保存</el-button>
    </app-header>

    <app-card>
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="100px"
        style="max-width: 700px"
      >
        <el-form-item label="菜品名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入菜品名称" maxlength="50" show-word-limit />
        </el-form-item>

        <el-form-item label="菜品分类" prop="categoryId">
          <el-select v-model="form.categoryId" placeholder="请选择分类" style="width: 100%">
            <el-option
              v-for="item in categoryList"
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
                v-model="form.price"
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
                v-model="form.originalPrice"
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
              <el-input-number v-model="form.stock" :min="-1" :step="1" placeholder="-1 表示无限库存" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态" prop="status">
              <el-radio-group v-model="form.status">
                <el-radio :label="1">上架</el-radio>
                <el-radio :label="0">下架</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="菜品描述">
          <el-input
            v-model="form.description"
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
              v-if="form.image"
              :src="form.image"
              fit="cover"
              style="width: 160px; height: 160px; border-radius: 8px"
            />
            <div v-else class="upload-placeholder">
              <el-icon :size="32"><Plus /></el-icon>
              <span>{{ uploading ? '上传中...' : '点击上传图片' }}</span>
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

        <el-form-item>
          <div class="form-actions">
            <el-button @click="handleCancel">取消</el-button>
            <el-button type="primary" :loading="submitLoading" @click="handleSave">保存</el-button>
          </div>
        </el-form-item>
      </el-form>
    </app-card>
  </div>
</template>

<style scoped lang="scss">
.merchant-dish-edit {
  .upload-area {
    width: 160px;
    height: 160px;
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

  .form-actions {
    display: flex;
    gap: $spacing-sm;
    margin-top: $spacing-md;
  }
}
</style>
