<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { Refresh, Search, RefreshRight } from '@element-plus/icons-vue'
import { api } from '@/api'
import type { Review } from '@/api/types'
import { formatDate } from '@/utils/format'
import { DEFAULT_PAGE_SIZE } from '@/utils/constants'

// 加载状态
const loading = ref(false)
const submitLoading = ref(false)
const dialogVisible = ref(false)

// 评价列表
const reviewList = ref<Review[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(DEFAULT_PAGE_SIZE)

// 搜索表单
const searchForm = reactive({
  rating: undefined as number | undefined,
})

// 回复表单
const replyForm = reactive({
  id: undefined as number | string | undefined,
  content: '',
})
const replyFormRef = ref<InstanceType<typeof ElForm>>()

// 评分颜色
function getRatingColor(rating: number) {
  if (rating >= 5) return '#FF4B33'
  if (rating >= 4) return '#FF9800'
  if (rating >= 3) return '#FFC300'
  return '#999999'
}

// 获取评价列表（服务端分页）
async function fetchReviewList() {
  loading.value = true
  try {
    const res = await api.review.getList({ current: page.value, size: pageSize.value, rating: searchForm.rating })
    reviewList.value = res.data.list
    total.value = res.data.total
  } finally {
    loading.value = false
  }
}

// 搜索
function handleSearch() {
  page.value = 1
  fetchReviewList()
}

// 重置搜索
function handleReset() {
  searchForm.rating = undefined
  page.value = 1
  fetchReviewList()
}

// 分页变化
function handlePageChange() {
  fetchReviewList()
}

// 每页条数变化
function handleSizeChange() {
  fetchReviewList()
}

// 打开回复对话框
function handleReply(row: Review) {
  replyForm.id = row.id
  replyForm.content = row.merchantReply || row.reply || ''
  dialogVisible.value = true
}

// 提交回复
async function handleSubmitReply() {
  const valid = await replyFormRef.value?.validate().catch(() => false)
  if (!valid || replyForm.id === undefined) return

  submitLoading.value = true
  try {
    await api.review.reply(replyForm.id, replyForm.content)
    ElMessage.success('回复成功')
    dialogVisible.value = false
    fetchReviewList()
  } finally {
    submitLoading.value = false
  }
}

onMounted(() => {
  fetchReviewList()
})
</script>

<template>
  <div class="merchant-review">
    <app-header title="评价管理">
      <template #right>
        <el-button type="primary" :icon="Refresh" @click="fetchReviewList">刷新</el-button>
      </template>
    </app-header>

    <!-- 搜索栏 -->
    <app-card class="search-card">
      <el-form :model="searchForm" inline>
        <el-form-item label="评分筛选">
          <el-select v-model="searchForm.rating" placeholder="全部" clearable style="width: 140px">
            <el-option label="5 分" :value="5" />
            <el-option label="4 分" :value="4" />
            <el-option label="3 分及以下" :value="3" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
          <el-button :icon="RefreshRight" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </app-card>

    <!-- 评价列表 -->
    <app-card>
      <app-table
        v-model:page="page"
        v-model:page-size="pageSize"
        :data="reviewList"
        :loading="loading"
        :total="total"
        @page-change="handlePageChange"
        @size-change="handleSizeChange"
      >
        <el-table-column label="用户" min-width="120">
          <template #default="{ row }">
            <span>{{ row.userNickname || row.userName || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="评分" width="140">
          <template #default="{ row }">
            <el-rate :model-value="row.rating" disabled :colors="['#FF4B33', '#FF4B33', '#FF4B33']" />
            <span class="rating-text" :style="{ color: getRatingColor(row.rating) }">{{ row.rating }} 分</span>
          </template>
        </el-table-column>
        <el-table-column prop="content" label="评价内容" min-width="200" show-overflow-tooltip />
        <el-table-column prop="merchantName" label="关联商家" min-width="130" />
        <el-table-column label="评价时间" width="160">
          <template #default="{ row }">
            {{ formatDate(row.createTime, 'YYYY-MM-DD HH:mm') }}
          </template>
        </el-table-column>
        <el-table-column label="回复状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.merchantReply || row.reply ? 'success' : 'warning'" size="small">
              {{ row.merchantReply || row.reply ? '已回复' : '待回复' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleReply(row)">
              {{ row.merchantReply || row.reply ? '修改回复' : '回复' }}
            </el-button>
          </template>
        </el-table-column>
      </app-table>
    </app-card>

    <!-- 回复对话框 -->
    <el-dialog v-model="dialogVisible" title="回复评价" width="500px" destroy-on-close>
      <el-form ref="replyFormRef" :model="replyForm" label-width="80px">
        <el-form-item
          label="回复内容"
          prop="content"
          :rules="[{ required: true, message: '请输入回复内容', trigger: 'blur' }]"
        >
          <el-input
            v-model="replyForm.content"
            type="textarea"
            :rows="4"
            placeholder="请输入回复内容"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmitReply">确认回复</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.merchant-review {
  .search-card {
    margin-bottom: $spacing-md;

    :deep(.el-form) {
      margin-bottom: -16px;
    }
  }

  .rating-text {
    margin-left: $spacing-sm;
    font-size: $font-size-sm;
    font-weight: 600;
  }
}
</style>
