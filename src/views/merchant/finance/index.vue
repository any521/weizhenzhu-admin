<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Money, Coin, Wallet, RefreshLeft } from '@element-plus/icons-vue'
import { api } from '@/api'
import type { FinanceStats, FinanceReport } from '@/api/types'
import { formatAmount, formatNumber } from '@/utils/format'
import { DEFAULT_PAGE_SIZE } from '@/utils/constants'

// 加载状态
const loading = ref(false)

// 财务汇总
const summary = ref({
  totalIncome: 0,
  platformFee: 0,
  actualIncome: 0,
  refundAmount: 0,
})

// 对账列表
const financeList = ref<FinanceReport[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(DEFAULT_PAGE_SIZE)

// 获取财务数据
async function fetchFinanceData() {
  loading.value = true
  try {
    const [statsRes, reportRes] = await Promise.all([
      api.finance.getStats(),
      api.finance.getReport(page.value, pageSize.value),
    ])
    const stats: FinanceStats = statsRes.data
    const platformFee = stats.platformFee || 0

    summary.value = {
      totalIncome: stats.totalIncome,
      platformFee,
      actualIncome: (stats.totalIncome || 0) - (stats.platformFee || 0),
      refundAmount: stats.refundAmount,
    }

    financeList.value = reportRes.data.list
    total.value = reportRes.data.total
  } finally {
    loading.value = false
  }
}

// 分页
function handlePageChange() {
  fetchFinanceData()
}

// 每页条数变化
function handleSizeChange() {
  page.value = 1
  fetchFinanceData()
}

onMounted(() => {
  fetchFinanceData()
})
</script>

<template>
  <div v-loading="loading" class="merchant-finance">
    <app-header title="财务对账" />

    <!-- 顶部汇总卡片 -->
    <div class="summary-row">
      <app-card v-for="(item, index) in [
        { label: '累计营业额', value: formatAmount(summary.totalIncome), icon: 'Money', color: '#FF4B33' },
        { label: '平台抽成', value: formatAmount(summary.platformFee), icon: 'Coin', color: '#FF9800' },
        { label: '实际收入', value: formatAmount(summary.actualIncome), icon: 'Wallet', color: '#00C853' },
        { label: '退款金额', value: formatAmount(summary.refundAmount), icon: 'RefreshLeft', color: '#999999' },
      ]" :key="index" class="summary-card" :body-style="{ padding: '20px' }">
        <div class="summary-card__content">
          <div class="summary-card__info">
            <p class="summary-card__label">{{ item.label }}</p>
            <p class="summary-card__value" :style="{ color: item.color }">{{ item.value }}</p>
          </div>
          <div class="summary-card__icon" :style="{ backgroundColor: `${item.color}15`, color: item.color }">
            <el-icon :size="28">
              <component :is="item.icon" />
            </el-icon>
          </div>
        </div>
      </app-card>
    </div>

    <!-- 对账表格 -->
    <app-card title="对账明细">
      <app-table
        v-model:page="page"
        v-model:page-size="pageSize"
        :data="financeList"
        :loading="loading"
        :total="total"
        @page-change="handlePageChange"
        @size-change="handleSizeChange"
      >
        <el-table-column prop="date" label="日期" min-width="120" />
        <el-table-column prop="orderCount" label="订单数" min-width="100">
          <template #default="{ row }">
            {{ formatNumber(row.orderCount) }}
          </template>
        </el-table-column>
        <el-table-column label="营业额" min-width="120">
          <template #default="{ row }">
            <span class="text-primary font-bold">{{ formatAmount(row.income) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="平台抽成" min-width="120">
          <template #default="{ row }">
            {{ formatAmount(row.commission) }}
          </template>
        </el-table-column>
        <el-table-column label="实际收入" min-width="120">
          <template #default="{ row }">
            <span class="text-success font-bold">{{ formatAmount(row.settlement) }}</span>
          </template>
        </el-table-column>
      </app-table>
    </app-card>
  </div>
</template>

<style scoped lang="scss">
.merchant-finance {
  .summary-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: $spacing-md;
    margin-bottom: $spacing-md;

    @media screen and (max-width: 1200px) {
      grid-template-columns: repeat(2, 1fr);
    }

    @media screen and (max-width: 768px) {
      grid-template-columns: 1fr;
    }
  }

  .summary-card {
    margin-bottom: 0;

    &__content {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    &__label {
      font-size: $font-size-sm;
      color: $text-muted;
      margin-bottom: $spacing-sm;
    }

    &__value {
      font-size: 24px;
      font-weight: bold;
      color: $text;
    }

    &__icon {
      width: 52px;
      height: 52px;
      border-radius: $radius-round;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }

  .text-primary {
    color: $primary;
  }

  .text-success {
    color: $success;
  }

  .font-bold {
    font-weight: 600;
  }
}
</style>
