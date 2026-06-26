<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import * as echarts from 'echarts'
import {
  Document,
  Money,
  Bell,
  ChatDotRound,
  WarningFilled,
  InfoFilled,
  CircleCloseFilled,
  CircleCheckFilled,
} from '@element-plus/icons-vue'
import { api } from '@/api'
import type { Order, Review, ChartData, MerchantDashboardStats } from '@/api/types'
import { formatAmount, formatDate, formatNumber } from '@/utils/format'
import { OrderStatusMap } from '@/utils/constants'

// 加载状态
const loading = ref(false)
const chartRef = ref<HTMLDivElement | null>(null)
let chartInstance: echarts.ECharts | null = null
const THEME_COLOR = '#FF6B35'

// 统计数据
const stats = ref({
  todayOrderCount: 0,
  todayIncome: 0,
  pendingOrderCount: 0,
  pendingReviewCount: 0,
})

// 图表数据
const chartData = ref<ChartData>({
  dates: [],
  values: [],
  legend: [],
  series: [],
})

// 最新订单
const latestOrders = ref<Order[]>([])

// 经营提醒
const reminders = ref<{ type: string; text: string; time: string; highlight?: boolean }[]>([])

// 初始化图表
function initChart() {
  if (!chartRef.value) return
  chartInstance = echarts.init(chartRef.value)
  updateChart()
}

// 更新图表配置
function updateChart() {
  if (!chartInstance) return
  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
    },
    legend: {
      data: chartData.value.legend,
      bottom: 0,
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: chartData.value.dates,
      axisLine: { lineStyle: { color: '#E8E8E8' } },
      axisLabel: { color: '#999' },
    },
    yAxis: [
      {
        type: 'value',
        name: '订单量',
        position: 'left',
        axisLine: { show: false },
        axisLabel: { color: '#999' },
        splitLine: { lineStyle: { color: '#F0F0F0' } },
      },
      {
        type: 'value',
        name: '营业额',
        position: 'right',
        axisLine: { show: false },
        axisLabel: {
          color: '#999',
          formatter: (value: number) => `¥${value}`,
        },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: chartData.value.series[0]?.name || '订单量',
        type: 'bar',
        barWidth: '30%',
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#FF9A6C' },
            { offset: 1, color: THEME_COLOR },
          ]),
          borderRadius: [4, 4, 0, 0],
        },
        data: chartData.value.series[0]?.data || [],
      },
      {
        name: chartData.value.series[1]?.name || '销售额',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        itemStyle: { color: '#FFB347' },
        lineStyle: { width: 3 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(255, 179, 71, 0.2)' },
            { offset: 1, color: 'rgba(255, 179, 71, 0)' },
          ]),
        },
        data: chartData.value.series[1]?.data || [],
      },
    ],
  }
  chartInstance.setOption(option)
}

// 获取工作台数据
async function fetchDashboardData() {
  loading.value = true
  try {
    const [dashRes, orderRes, reviewRes, chartRes] = await Promise.all([
      api.stats.getDashboard(),
      api.order.getList({ current: 1, size: 5 }),
      api.review.getList({ current: 1, size: 100 }),
      api.finance.getChartData(),
    ])

    const dash = dashRes.data as MerchantDashboardStats
    const orders: Order[] = orderRes.data.list
    const reviews: Review[] = reviewRes.data.list
    chartData.value = chartRes.data

    stats.value = {
      todayOrderCount: dash.todayOrders || 0,
      todayIncome: dash.todayRevenue || 0,
      pendingOrderCount: dash.pendingOrders || 0,
      pendingReviewCount: reviews.filter((item) => !(item.merchantReply || item.reply)).length,
    }

    latestOrders.value = orders

    reminders.value = [
      { type: 'warning', text: `您有 ${stats.value.pendingOrderCount} 笔待接单订单`, time: '刚刚', highlight: true },
      { type: 'info', text: `今日营业额已达 ${formatAmount(stats.value.todayIncome)}`, time: '今日', highlight: false },
      { type: 'danger', text: `有 ${reviews.filter((item) => item.rating <= 3).length} 条中差评待回复`, time: '今日', highlight: false },
      { type: 'success', text: '店铺评分保持稳定，请继续努力', time: '昨日', highlight: false },
    ]

    updateChart()
  } finally {
    loading.value = false
  }
}

// 窗口大小变化时重绘图表
function handleResize() {
  chartInstance?.resize()
}

onMounted(() => {
  initChart()
  fetchDashboardData()
  window.addEventListener('resize', handleResize)

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
    chartInstance?.dispose()
  })
})
</script>

<template>
  <div v-loading="loading" class="merchant-dashboard">
    <!-- 顶部数据卡片 -->
    <div class="stats-row">
      <app-card v-for="(item, index) in [
        { label: '今日订单数', value: formatNumber(stats.todayOrderCount), icon: 'Document', color: THEME_COLOR },
        { label: '今日营业额', value: formatAmount(stats.todayIncome), icon: 'Money', color: '#FFB347' },
        { label: '待处理订单', value: formatNumber(stats.pendingOrderCount), icon: 'Bell', color: '#EF476F' },
        { label: '待回复评价', value: formatNumber(stats.pendingReviewCount), icon: 'ChatDotRound', color: '#06D6A0' },
      ]" :key="index" class="stats-card" :body-style="{ padding: '20px' }">
        <div class="stats-card__content">
          <div class="stats-card__info">
            <p class="stats-card__label">{{ item.label }}</p>
            <p class="stats-card__value" :style="{ color: item.color }">{{ item.value }}</p>
          </div>
          <div class="stats-card__icon" :style="{ backgroundColor: `${item.color}15`, color: item.color }">
            <el-icon :size="28">
              <component :is="item.icon" />
            </el-icon>
          </div>
        </div>
      </app-card>
    </div>

    <!-- 中部趋势图 -->
    <app-card title="近 7 天订单/营业额趋势">
      <div ref="chartRef" class="trend-chart" />
    </app-card>

    <!-- 底部左右两栏 -->
    <div class="bottom-row">
      <app-card title="最新订单" class="bottom-card">
        <el-table :data="latestOrders" stripe>
          <el-table-column prop="orderNo" label="订单号" min-width="140" show-overflow-tooltip />
          <el-table-column prop="userName" label="用户" min-width="100" />
          <el-table-column label="金额" width="100">
            <template #default="{ row }">
              <span class="text-primary font-bold">{{ formatAmount(row.payAmount) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.status === 4 ? 'success' : row.status === 1 ? 'warning' : 'info'" size="small">
                {{ OrderStatusMap[row.status] || '未知' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="时间" width="160">
            <template #default="{ row }">
              {{ formatDate(row.createTime, 'MM-DD HH:mm') }}
            </template>
          </el-table-column>
        </el-table>
        <app-empty v-if="!latestOrders.length" description="暂无最新订单" />
      </app-card>

      <app-card title="经营提醒" class="bottom-card">
        <ul class="reminder-list">
          <li
            v-for="(item, index) in reminders"
            :key="index"
            class="reminder-item"
            :class="{ 'reminder-item--highlight': item.highlight }"
          >
            <el-icon :size="16" :class="`reminder-icon--${item.type}`">
              <WarningFilled v-if="item.type === 'warning'" />
              <InfoFilled v-else-if="item.type === 'info'" />
              <CircleCloseFilled v-else-if="item.type === 'danger'" />
              <CircleCheckFilled v-else />
            </el-icon>
            <span class="reminder-text">{{ item.text }}</span>
            <span class="reminder-time">{{ item.time }}</span>
          </li>
        </ul>
        <app-empty v-if="!reminders.length" description="暂无提醒" />
      </app-card>
    </div>
  </div>
</template>

<style scoped lang="scss">
.merchant-dashboard {
  .stats-row {
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

  .stats-card {
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
      font-size: 26px;
      font-weight: bold;
      color: $text;
    }

    &__icon {
      width: 56px;
      height: 56px;
      border-radius: $radius-round;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }

  .trend-chart {
    width: 100%;
    height: 360px;
  }

  .bottom-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: $spacing-md;

    @media screen and (max-width: 992px) {
      grid-template-columns: 1fr;
    }
  }

  .bottom-card {
    margin-bottom: 0;
  }

  .reminder-list {
    .reminder-item {
      display: flex;
      align-items: center;
      gap: $spacing-sm;
      padding: $spacing-md 0;
      border-bottom: 1px solid $border-light;
      transition: background-color $transition-fast;

      &:last-child {
        border-bottom: none;
      }

      &--highlight {
        background-color: #fff5f5;
        border-radius: $radius-md;
        padding: $spacing-md;
        border: 1px solid rgba($primary, 0.2);

        .reminder-text {
          color: $primary;
          font-weight: 600;
        }
      }

      .reminder-text {
        flex: 1;
        color: $text;
        font-size: $font-size-md;
      }

      .reminder-time {
        font-size: $font-size-sm;
        color: $text-muted;
      }
    }
  }

  .reminder-icon--warning {
    color: $warning;
  }

  .reminder-icon--info {
    color: $info;
  }

  .reminder-icon--danger {
    color: $danger;
  }

  .reminder-icon--success {
    color: $success;
  }

  .font-bold {
    font-weight: 600;
  }
}
</style>
