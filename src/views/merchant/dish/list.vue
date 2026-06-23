<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, Search, RefreshRight, Food } from '@element-plus/icons-vue'
import { api } from '@/api'
import type { Dish, Category } from '@/api/types'
import { formatAmount, formatDate } from '@/utils/format'
import { CommonStatusMap, DEFAULT_PAGE_SIZE } from '@/utils/constants'

const router = useRouter()

// 加载状态
const loading = ref(false)

// 搜索表单
const searchForm = reactive({
  name: '',
  categoryId: undefined as number | undefined,
  status: undefined as number | undefined,
})

// 菜品列表
const dishList = ref<Dish[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(DEFAULT_PAGE_SIZE)

const categoryList = ref<Category[]>([])

// 状态选项
const statusOptions = [
  { value: 1, label: '上架' },
  { value: 0, label: '下架' },
]

// 获取分类列表
async function fetchCategories() {
  try {
    const res = await api.category.getList()
    categoryList.value = res.data
  } catch {
    categoryList.value = []
  }
}

// 获取菜品列表（服务端分页）
async function fetchDishList() {
  loading.value = true
  try {
    await fetchCategories()
    const res = await api.dish.getList({ current: page.value, size: pageSize.value, categoryId: searchForm.categoryId, keyword: searchForm.name })
    dishList.value = res.data.list
    total.value = res.data.total
  } finally {
    loading.value = false
  }
}

// 搜索
function handleSearch() {
  page.value = 1
  fetchDishList()
}

// 重置搜索
function handleReset() {
  searchForm.name = ''
  searchForm.categoryId = undefined
  searchForm.status = undefined
  page.value = 1
  fetchDishList()
}

// 分页变化
function handlePageChange() {
  fetchDishList()
}

// 每页条数变化
function handleSizeChange() {
  fetchDishList()
}

// 新增菜品
function handleAdd() {
  router.push('/merchant/dishes/edit')
}

// 编辑菜品
function handleEdit(row: Dish) {
  router.push(`/merchant/dishes/edit/${row.id}`)
}

// 上架/下架
async function handleToggleStatus(row: Dish) {
  const newStatus = row.status === 1 ? 0 : 1
  const actionText = newStatus === 1 ? '上架' : '下架'
  try {
    await ElMessageBox.confirm(`确认${actionText}菜品「${row.name}」吗？`, '提示', {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await api.dish.updateStatus(row.id, newStatus)
    ElMessage.success(`${actionText}成功`)
    fetchDishList()
  } catch {
    // 用户取消
  }
}

// 删除菜品
async function handleDelete(row: Dish) {
  try {
    await ElMessageBox.confirm(`确认删除菜品「${row.name}」吗？删除后不可恢复。`, '提示', {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      type: 'danger',
    })
    await api.dish.delete(row.id)
    ElMessage.success('删除成功')
    fetchDishList()
  } catch {
    // 用户取消
  }
}

onMounted(() => {
  fetchDishList()
})
</script>

<template>
  <div class="merchant-dish-list">
    <app-header title="菜品管理">
      <el-button type="primary" :icon="Plus" @click="handleAdd">新增菜品</el-button>
    </app-header>

    <!-- 搜索栏 -->
    <app-card class="search-card">
      <el-form :model="searchForm" inline>
        <el-form-item label="菜品名称">
          <el-input v-model="searchForm.name" placeholder="请输入菜品名称" clearable style="width: 200px" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="searchForm.categoryId" placeholder="全部分类" clearable style="width: 160px">
            <el-option
              v-for="item in categoryList"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部状态" clearable style="width: 140px">
            <el-option
              v-for="item in statusOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
          <el-button :icon="RefreshRight" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </app-card>

    <!-- 菜品表格 -->
    <app-card>
      <app-table
        v-model:page="page"
        v-model:page-size="pageSize"
        :data="dishList"
        :loading="loading"
        :total="total"
        @page-change="handlePageChange"
        @size-change="handleSizeChange"
      >
        <el-table-column label="菜品图片" width="100">
          <template #default="{ row }">
            <div class="dish-image">
              <el-image
                v-if="row.image"
                :src="row.image"
                fit="cover"
                style="width: 56px; height: 56px; border-radius: 8px"
              />
              <div v-else class="image-placeholder">
                <el-icon :size="24"><Food /></el-icon>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="菜品名称" min-width="140" show-overflow-tooltip />
        <el-table-column prop="categoryName" label="分类" min-width="100" />
        <el-table-column label="价格" width="120">
          <template #default="{ row }">
            <div class="price-info">
              <span class="current-price">{{ formatAmount(row.price) }}</span>
              <span v-if="row.originalPrice" class="original-price">{{ formatAmount(row.originalPrice) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="sales" label="销量" width="100" />
        <el-table-column label="状态" width="90">
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
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button link :type="row.status === 1 ? 'warning' : 'success'" size="small" @click="handleToggleStatus(row)">
              {{ row.status === 1 ? '下架' : '上架' }}
            </el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </app-table>
    </app-card>
  </div>
</template>

<style scoped lang="scss">
.merchant-dish-list {
  .search-card {
    margin-bottom: $spacing-md;

    :deep(.el-form) {
      margin-bottom: -16px;
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
}
</style>
