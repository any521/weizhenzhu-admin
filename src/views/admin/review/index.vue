<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { Search, RefreshRight, Download, Delete, Star, ChatDotRound } from '@element-plus/icons-vue'
import { api } from '@/api'
import AppCard from '@/components/AppCard.vue'
import AppHeader from '@/components/AppHeader.vue'
import AppTable, { type TableColumn } from '@/components/AppTable.vue'
import { formatDate, truncateText, resolveImageUrl } from '@/utils/format'
import { exportToExcel, exportToCsv, type ExportColumn } from '@/utils/export'
import { downloadBlob } from '@/utils/download'
import { useSavedQueries, type SavedQuery } from '@/composables/useSavedQueries'
import type { Review } from '@/api/types'
import type { FormInstance } from 'element-plus'

// 搜索表单
interface SearchForm {
  merchantName: string
  rating: number | undefined
  status: number | undefined
  dateRange: string[]
}

const searchForm = reactive<SearchForm>({
  merchantName: '',
  rating: undefined,
  status: undefined,
  dateRange: [],
})

const loading = ref(false)
const exporting = ref(false)
const tableData = ref<Review[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)

// 排序
const sortField = ref<string>('')
const sortOrder = ref<'asc' | 'desc'>('asc')

// 批量选择
const selectedRows = ref<Review[]>([])

// 详情弹窗
const detailVisible = ref(false)
const currentRow = ref<Review | null>(null)

// 回复弹窗
const replyVisible = ref(false)
const replyLoading = ref(false)
const replyRef = ref<FormInstance>()
const replyForm = reactive({
  id: 0,
  content: '',
})

const replyRules = {
  content: [
    { required: true, message: '请输入回复内容', trigger: 'blur' },
    { min: 2, max: 200, message: '长度在 2 到 200 个字符', trigger: 'blur' },
  ],
}

// 列定义
const columns: TableColumn[] = [
  { prop: 'id', label: 'ID', width: 80, sortable: true },
  { prop: 'userNickname', label: '用户', minWidth: 120 },
  { prop: 'merchantName', label: '商家', minWidth: 140 },
  { prop: 'rating', label: '评分', width: 160, sortable: true },
  { prop: 'content', label: '评价内容', minWidth: 220, showOverflowTooltip: true },
  { prop: 'images', label: '评价图片', width: 120, slot: 'images' },
  { prop: 'reply', label: '商家回复', minWidth: 180, showOverflowTooltip: true },
  { prop: 'status', label: '状态', width: 100 },
  { prop: 'createdAt', label: '评价时间', minWidth: 170, sortable: true },
]

// 查询条件保存
const { savedQueries, saveQuery, deleteQuery, applyQuery } = useSavedQueries('admin_review')

// 保存查询弹窗
const saveQueryVisible = ref(false)
const saveQueryName = ref('')

// 构造查询参数
function buildQueryParams() {
  return {
    current: page.value,
    size: pageSize.value,
    merchantName: searchForm.merchantName || undefined,
    rating: searchForm.rating,
    status: searchForm.status,
    startDate: searchForm.dateRange?.[0],
    endDate: searchForm.dateRange?.[1],
    sortField: sortField.value || undefined,
    sortOrder: sortOrder.value,
  }
}

// 加载评价列表
async function loadList() {
  loading.value = true
  try {
    const res = await api.review.getList(buildQueryParams())
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
  searchForm.merchantName = ''
  searchForm.rating = undefined
  searchForm.status = undefined
  searchForm.dateRange = []
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
function handleSelectionChange(selection: Review[]) {
  selectedRows.value = selection
}

// 查看详情
function handleView(row: Review) {
  currentRow.value = row
  detailVisible.value = true
}

// 打开回复弹窗
function handleReply(row: Review) {
  replyForm.id = row.id
  replyForm.content = row.reply || row.merchantReply || ''
  replyVisible.value = true
}

// 保存回复
async function handleReplySave() {
  const valid = await replyRef.value?.validate().catch(() => false)
  if (!valid) return

  replyLoading.value = true
  try {
    await api.review.reply(replyForm.id, replyForm.content)
    ElMessage.success('回复成功')
    replyVisible.value = false
    loadList()
  } finally {
    replyLoading.value = false
  }
}

// 切换显示/隐藏
async function handleToggleStatus(row: Review) {
  const action = row.status === 1 ? '隐藏' : '显示'
  try {
    await ElMessageBox.confirm(`确定要${action}该评价吗？`, '提示', { type: 'warning' })
    await api.review.updateStatus(row.id, row.status === 1 ? 0 : 1)
    row.status = row.status === 1 ? 0 : 1
    ElMessage.success(`${action}成功`)
  } catch {
    // 取消
  }
}

// 单条删除
async function handleDelete(row: Review) {
  try {
    await ElMessageBox.confirm(`确定要删除该评价吗？删除后不可恢复。`, '提示', {
      type: 'warning',
      confirmButtonText: '确认',
      cancelButtonText: '取消',
    })
    await api.review.delete(row.id)
    ElMessage.success('删除成功')
    loadList()
  } catch {
    // 取消
  }
}

// 批量删除
async function handleBatchDelete() {
  if (selectedRows.value.length === 0) {
    ElMessage.warning('请先选择要删除的评价')
    return
  }
  try {
    await ElMessageBox.confirm(`确定要删除选中的 ${selectedRows.value.length} 条评价吗？`, '提示', {
      type: 'warning',
      confirmButtonText: '确认',
      cancelButtonText: '取消',
    })
    await Promise.all(selectedRows.value.map((row) => api.review.delete(row.id)))
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
  { prop: 'userNickname', label: '用户' },
  { prop: 'merchantName', label: '商家' },
  { prop: 'rating', label: '评分' },
  { prop: 'content', label: '评价内容' },
  { prop: 'reply', label: '商家回复' },
  { prop: 'status', label: '状态', formatter: (_row, v) => (v === 1 ? '显示' : '隐藏') },
  { prop: 'createdAt', label: '评价时间' },
]

async function handleExport(format: 'xlsx' | 'csv') {
  exporting.value = true
  try {
    // 优先调用后端导出接口
    try {
      const blob = await api.review.export({ ...buildQueryParams(), format })
      downloadBlob(blob, `评价列表.${format}`, format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv;charset=utf-8;')
      ElMessage.success('导出成功')
      return
    } catch {
      // 后端不支持时降级为前端导出
    }
    // 前端导出（导出当前页）
    const filename = `评价列表_${formatDate(new Date(), 'YYYYMMDD_HHmmss')}`
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
    !searchForm.merchantName &&
    searchForm.rating === undefined &&
    searchForm.status === undefined &&
    (!searchForm.dateRange || searchForm.dateRange.length === 0)
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

onMounted(loadList)
</script>

<template>
  <div class="admin-review">
    <AppHeader title="评价管理" subtitle="管理平台用户评价">
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
        <el-form-item label="商家名称">
          <el-input v-model="searchForm.merchantName" placeholder="请输入商家名称" clearable />
        </el-form-item>
        <el-form-item label="评分">
          <el-select v-model="searchForm.rating" placeholder="全部评分" clearable style="width: 140px">
            <el-option label="5 星" :value="5" />
            <el-option label="4 星" :value="4" />
            <el-option label="3 星" :value="3" />
            <el-option label="2 星" :value="2" />
            <el-option label="1 星" :value="1" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部状态" clearable style="width: 120px">
            <el-option label="显示" :value="1" />
            <el-option label="隐藏" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item label="评价时间">
          <el-date-picker
            v-model="searchForm.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
          />
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

        <template #cell-rating="{ row }">
          <el-rate :model-value="row.rating" disabled show-score text-color="#FF9900" />
        </template>

        <template #cell-content="{ row }">
          {{ truncateText(row.content, 30) }}
        </template>

        <template #cell-reply="{ row }">
          <span v-if="row.reply || row.merchantReply">{{ truncateText(row.reply || row.merchantReply, 20) }}</span>
          <span v-else class="text-muted">未回复</span>
        </template>

        <template #cell-status="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'info'">
            {{ row.status === 1 ? '显示' : '隐藏' }}
          </el-tag>
        </template>

        <template #cell-images="{ row }">
          <div v-if="row.images && row.images.length" class="review-images-cell">
            <el-image
              :src="resolveImageUrl(row.images[0])"
              fit="cover"
              class="review-thumb"
              :preview-src-list="row.images.map((i: string) => resolveImageUrl(i))"
              preview-teleported
              :z-index="3000"
            />
            <span v-if="row.images.length > 1" class="review-images-count">+{{ row.images.length - 1 }}</span>
          </div>
          <span v-else class="text-muted">-</span>
        </template>

        <template #cell-createdAt="{ row }">
          {{ formatDate(row.createdAt) }}
        </template>

        <template #append>
          <el-table-column label="操作" width="240" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="handleView(row)">查看</el-button>
              <el-button link type="primary" :icon="ChatDotRound" @click="handleReply(row)">回复</el-button>
              <el-button link :type="row.status === 1 ? 'warning' : 'success'" @click="handleToggleStatus(row)">
                {{ row.status === 1 ? '隐藏' : '显示' }}
              </el-button>
              <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </template>
      </AppTable>
    </AppCard>

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailVisible" title="评价详情" width="600px">
      <el-descriptions v-if="currentRow" :column="1" border>
        <el-descriptions-item label="ID">{{ currentRow.id }}</el-descriptions-item>
        <el-descriptions-item label="订单号">{{ currentRow.orderNo || '-' }}</el-descriptions-item>
        <el-descriptions-item label="用户">{{ currentRow.userNickname || currentRow.userName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="商家">{{ currentRow.merchantName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="评分">
          <el-rate :model-value="currentRow.rating" disabled show-score text-color="#FF9900" />
        </el-descriptions-item>
        <el-descriptions-item label="口味分">{{ currentRow.tasteScore ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="包装分">{{ currentRow.packingScore ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="配送分">{{ currentRow.deliveryScore ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="评价内容">{{ currentRow.content }}</el-descriptions-item>
        <el-descriptions-item label="评价图片">
          <div v-if="currentRow.images && currentRow.images.length > 0" class="image-list">
            <el-image
              v-for="(img, idx) in currentRow.images"
              :key="idx"
              :src="resolveImageUrl(img)"
              :preview-src-list="currentRow.images.map((i: string) => resolveImageUrl(i))"
              fit="cover"
              style="width: 80px; height: 80px; border-radius: 4px; margin-right: 8px"
            />
          </div>
          <span v-else class="text-muted">无</span>
        </el-descriptions-item>
        <el-descriptions-item label="商家回复">{{ currentRow.reply || currentRow.merchantReply || '未回复' }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="currentRow.status === 1 ? 'success' : 'info'">
            {{ currentRow.status === 1 ? '显示' : '隐藏' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="评价时间">{{ formatDate(currentRow.createdAt) }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>

    <!-- 回复弹窗 -->
    <el-dialog v-model="replyVisible" title="回复评价" width="500px">
      <el-form ref="replyRef" :model="replyForm" :rules="replyRules" label-width="80px">
        <el-form-item label="回复内容" prop="content">
          <el-input
            v-model="replyForm.content"
            type="textarea"
            :rows="5"
            placeholder="请输入回复内容（2-200 字）"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="replyVisible = false">取消</el-button>
        <el-button type="primary" :loading="replyLoading" @click="handleReplySave">提交回复</el-button>
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
.admin-review {
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

  .text-muted {
    color: $text-muted;
  }

  .image-list {
    display: flex;
    flex-wrap: wrap;
  }

  .review-images-cell {
    position: relative;
    display: inline-flex;
    align-items: center;

    .review-thumb {
      width: 40px;
      height: 40px;
      border-radius: 4px;
      cursor: pointer;
      border: 1px solid #ebeef5;
    }

    .review-images-count {
      position: absolute;
      right: -4px;
      top: -4px;
      background: rgba(0, 0, 0, 0.6);
      color: #fff;
      font-size: 10px;
      line-height: 1;
      padding: 2px 4px;
      border-radius: 8px;
      min-width: 16px;
      text-align: center;
    }
  }
}
</style>
