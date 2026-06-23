<script setup lang="ts">
import { reactive, ref, computed, onMounted, watch } from 'vue'
import { Delete, RefreshLeft, Search } from '@element-plus/icons-vue'
import { api } from '@/api'
import AppCard from '@/components/AppCard.vue'
import AppHeader from '@/components/AppHeader.vue'
import AppTable, { type TableColumn } from '@/components/AppTable.vue'
import { formatDate } from '@/utils/format'
import type { RecycleBinItem } from '@/api/types'

const activeType = ref('user')
const typeLabels = reactive<Record<string, string>>({})
const typeList = computed(() => Object.keys(typeLabels))

const loading = ref(false)
const tableData = ref<RecycleBinItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const keyword = ref('')
const selectedRows = ref<RecycleBinItem[]>([])

const columns: TableColumn[] = [
  { prop: 'title', label: '名称/内容', minWidth: 200 },
  { prop: 'subtitle', label: '补充信息', minWidth: 240 },
  { prop: 'deletedTime', label: '删除时间', width: 170 },
]

async function loadTypes() {
  try {
    const res = await api.recycleBin.getTypes()
    if (res.code === 200 && res.data) {
      Object.assign(typeLabels, res.data.labels)
      if (!typeLabels[activeType.value] && res.data.types.length > 0) {
        activeType.value = res.data.types[0]
      }
    }
  } catch {
    // 兜底
    Object.assign(typeLabels, {
      user: '用户',
      merchant: '商家',
      rider: '骑手',
      coupon: '优惠券',
      dish: '菜品',
      dishCategory: '菜品分类',
      address: '收货地址',
      message: '站内消息',
      review: '评价',
    })
  }
}

async function loadList() {
  loading.value = true
  try {
    const res = await api.recycleBin.getList(activeType.value, {
      page: page.value,
      pageSize: pageSize.value,
      keyword: keyword.value || undefined,
    })
    tableData.value = res.data.list
    total.value = res.data.total
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  page.value = 1
  loadList()
}

function handleTypeChange() {
  page.value = 1
  keyword.value = ''
  selectedRows.value = []
  loadList()
}

function handleSelectionChange(selection: RecycleBinItem[]) {
  selectedRows.value = selection
}

async function handleRestore(row: RecycleBinItem) {
  try {
    await ElMessageBox.confirm('确定要恢复该记录吗？', '提示', { type: 'warning' })
    const res = await api.recycleBin.restore(row.type, row.id)
    if (res.code === 200) {
      ElMessage.success('恢复成功')
      loadList()
    }
  } catch {
    // 取消
  }
}

async function handlePhysicalDelete(row: RecycleBinItem) {
  try {
    await ElMessageBox.confirm('彻底删除后无法恢复，确定要继续吗？', '警告', { type: 'error' })
    const res = await api.recycleBin.physicalDelete(row.type, row.id)
    if (res.code === 200) {
      ElMessage.success('已彻底删除')
      loadList()
    }
  } catch {
    // 取消
  }
}

async function handleBatchRestore() {
  if (selectedRows.value.length === 0) {
    ElMessage.warning('请先选择要恢复的记录')
    return
  }
  try {
    await ElMessageBox.confirm(`确定要恢复选中的 ${selectedRows.value.length} 条记录吗？`, '提示', { type: 'warning' })
    const ids = selectedRows.value.map((row) => row.id)
    const res = await api.recycleBin.batchRestore(activeType.value, ids)
    if (res.code === 200) {
      ElMessage.success('批量恢复成功')
      selectedRows.value = []
      loadList()
    }
  } catch {
    // 取消
  }
}

async function handleBatchPhysicalDelete() {
  if (selectedRows.value.length === 0) {
    ElMessage.warning('请先选择要彻底删除的记录')
    return
  }
  try {
    await ElMessageBox.confirm(`确定要彻底删除选中的 ${selectedRows.value.length} 条记录吗？删除后无法恢复！`, '警告', { type: 'error' })
    const ids = selectedRows.value.map((row) => row.id)
    const res = await api.recycleBin.batchPhysicalDelete(activeType.value, ids)
    if (res.code === 200) {
      ElMessage.success('批量彻底删除成功')
      selectedRows.value = []
      loadList()
    }
  } catch {
    // 取消
  }
}

watch(activeType, handleTypeChange)

onMounted(async () => {
  await loadTypes()
  loadList()
})
</script>

<template>
  <div class="admin-recycle-bin">
    <AppHeader title="回收站" subtitle="查看并管理已软删除的数据">
      <el-button type="primary" :icon="RefreshLeft" @click="handleBatchRestore">批量恢复</el-button>
      <el-button type="danger" :icon="Delete" @click="handleBatchPhysicalDelete">批量彻底删除</el-button>
    </AppHeader>

    <AppCard class="search-card">
      <el-tabs v-model="activeType" type="border-card">
        <el-tab-pane
          v-for="(label, type) in typeLabels"
          :key="type"
          :label="label"
          :name="type"
        />
      </el-tabs>
      <div class="search-row">
        <el-input
          v-model="keyword"
          placeholder="请输入关键词搜索"
          clearable
          style="width: 280px"
          @keyup.enter="handleSearch"
        />
        <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
      </div>
    </AppCard>

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
        @selection-change="handleSelectionChange"
      >
        <template #cell-title="{ row }">
          <div class="cell-title">{{ row.title || '-' }}</div>
          <el-tag size="small" type="info">{{ row.typeLabel }}</el-tag>
        </template>
        <template #cell-subtitle="{ row }">
          <span class="cell-subtitle">{{ row.subtitle || '-' }}</span>
        </template>
        <template #cell-deletedTime="{ row }">
          {{ formatDate(row.deletedTime) }}
        </template>
        <template #actions="{ row }">
          <el-button link type="primary" :icon="RefreshLeft" @click="handleRestore(row)">恢复</el-button>
          <el-button link type="danger" :icon="Delete" @click="handlePhysicalDelete(row)">彻底删除</el-button>
        </template>
      </AppTable>
    </AppCard>
  </div>
</template>

<style scoped lang="scss">
.admin-recycle-bin {
  .search-card {
    margin-bottom: 16px;
  }

  .search-row {
    margin-top: 16px;
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .cell-title {
    font-weight: 500;
    margin-bottom: 4px;
  }

  .cell-subtitle {
    color: #86909c;
    font-size: 13px;
  }
}
</style>
