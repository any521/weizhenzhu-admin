<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { Refresh, Search, RefreshRight } from '@element-plus/icons-vue'
import { api } from '@/api'
import type { Order } from '@/api/types'
import { formatAmount, formatDate } from '@/utils/format'
import { OrderStatusMap, DEFAULT_PAGE_SIZE } from '@/utils/constants'

// 加载状态
const loading = ref(false)

// 搜索表单
const searchForm = reactive({
  orderNo: '',
  phone: '',
  status: undefined as number | undefined,
  dateRange: [] as string[],
})

// 订单列表和分页
const orderList = ref<Order[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(DEFAULT_PAGE_SIZE)

// 订单状态选项
const statusOptions = Object.entries(OrderStatusMap).map(([value, label]) => ({
  value: Number(value),
  label,
}))

// 获取订单列表（服务端分页+筛选）
async function fetchOrderList() {
  loading.value = true
  try {
    const res = await api.order.getList({ current: page.value, size: pageSize.value, status: searchForm.status })
    orderList.value = res.data.list
    total.value = res.data.total
  } finally {
    loading.value = false
  }
}

// 搜索
function handleSearch() {
  page.value = 1
  fetchOrderList()
}

// 重置搜索
function handleReset() {
  searchForm.orderNo = ''
  searchForm.phone = ''
  searchForm.status = undefined
  searchForm.dateRange = []
  page.value = 1
  fetchOrderList()
}

// 分页变化
function handlePageChange() {
  fetchOrderList()
}

// 每页条数变化
function handleSizeChange() {
  fetchOrderList()
}

// 查看详情
function handleViewDetail(row: Order) {
  ElMessage.info(`查看订单详情：${row.orderNo}`)
}

// 接单
async function handleAccept(row: Order) {
  try {
    await ElMessageBox.confirm(`确认接单 ${row.orderNo} 吗？`, '提示', {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await api.order.accept(row.id)
    ElMessage.success('接单成功')
    fetchOrderList()
  } catch {
    // 用户取消操作
  }
}

// 拒单
async function handleReject(row: Order) {
  try {
    const { value } = await ElMessageBox.prompt('请输入拒单原因', '提示', {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      inputPattern: /\S+/,
      inputErrorMessage: '拒单原因不能为空',
    })
    await api.order.reject(row.id, value)
    ElMessage.success('拒单成功')
    fetchOrderList()
  } catch {
    // 用户取消操作
  }
}

// 出餐完成
async function handleReady(row: Order) {
  try {
    await ElMessageBox.confirm(`确认订单 ${row.orderNo} 已出餐？`, '提示', {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      type: 'info',
    })
    await api.order.ready(row.id)
    ElMessage.success('出餐完成')
    fetchOrderList()
  } catch {
    // 用户取消操作
  }
}

onMounted(() => {
  fetchOrderList()
})
</script>

<template>
  <div class="merchant-order-list">
    <app-header title="历史订单">
      <template #right>
        <el-button type="primary" :icon="Refresh" @click="fetchOrderList">刷新</el-button>
      </template>
    </app-header>

    <!-- 搜索栏 -->
    <app-card class="search-card">
      <el-form :model="searchForm" inline>
        <el-form-item label="订单状态">
          <el-select v-model="searchForm.status" placeholder="全部状态" clearable style="width: 180px">
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

    <!-- 订单表格 -->
    <app-card>
      <app-table
        v-model:page="page"
        v-model:page-size="pageSize"
        :data="orderList"
        :loading="loading"
        :total="total"
        @page-change="handlePageChange"
        @size-change="handleSizeChange"
      >
        <el-table-column prop="orderNo" label="订单号" min-width="160" show-overflow-tooltip />
        <el-table-column label="用户" min-width="120">
          <template #default="{ row }">
            <span class="user-name">{{ row.userNickname || row.userName || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="金额" width="120">
          <template #default="{ row }">
            <div class="amount-info">
              <span class="pay-amount">{{ formatAmount(row.payAmount) }}</span>
              <span v-if="row.discountAmount" class="discount-amount">优惠 {{ formatAmount(row.discountAmount) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag
              :type="row.status === 7 ? 'success' : row.status === 8 || row.status === 10 ? 'info' : row.status === 1 ? 'warning' : 'primary'"
              size="small"
            >
              {{ row.statusDesc || OrderStatusMap[row.status] || '未知' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="下单时间" width="170">
          <template #default="{ row }">
            {{ formatDate(row.createTime) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleViewDetail(row)">查看详情</el-button>
            <el-button v-if="row.status === 1" link type="success" size="small" @click="handleAccept(row)">接单</el-button>
            <el-button v-if="row.status === 1" link type="danger" size="small" @click="handleReject(row)">拒单</el-button>
            <el-button v-if="row.status === 2" link type="warning" size="small" @click="handleReady(row)">出餐完成</el-button>
          </template>
        </el-table-column>
      </app-table>
    </app-card>
  </div>
</template>

<style scoped lang="scss">
.merchant-order-list {
  .search-card {
    margin-bottom: $spacing-md;

    :deep(.el-form) {
      margin-bottom: -16px;
    }
  }

  .user-info {
    .user-name {
      color: $text;
      font-weight: 500;
    }
  }

  .amount-info {
    display: flex;
    flex-direction: column;

    .pay-amount {
      color: $primary;
      font-weight: 600;
    }

    .discount-amount {
      font-size: $font-size-xs;
      color: $text-muted;
    }
  }
}
</style>
