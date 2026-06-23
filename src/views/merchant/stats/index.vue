<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import * as echarts from 'echarts'
import { Document, Money, User, Shop } from '@element-plus/icons-vue'
import { api } from '@/api'
import type { ChartData } from '@/api/types'
import { formatAmount, formatNumber } from '@/utils/format'

// 加载状态
const loading = ref(false)

// 图表 DOM 引用
const trendChartRef = ref<HTMLDivElement | null>(null)
const topDishChartRef = ref<HTMLDivElement | null>(null)
const sourceChartRef = ref<HTMLDivElement | null>(null)
const hourChartRef = ref<HTMLDivElement | null>(null)

// 图表实例
let trendChart: echarts.ECharts | null = null
let topDishChart: echarts.ECharts | null = null
let sourceChart: echarts.ECharts | null = null
let hourChart: echarts.ECharts | null = null

// 统计数据
const stats = ref({
  orderCount: 0,
  income: 0,
  userCount: 0,
  merchantCount: 0,
})

// 图表数据
const chartData = ref<ChartData>({
  dates: [],
  values: [],
  legend: [],
  series: [],
})

// TOP10 菜品数据
const topDishes = ref<{ name: string; value: number }[]>([])

// 用户来源数据
const userSources = ref<{ name: string; value: number }[]>([])

// 时段分析数据
const hourData = ref<{ hours: string[]; values: number[] }>({ hours: [], values: [] })

// 初始化图表
function initCharts() {
  if (trendChartRef.value) trendChart = echarts.init(trendChartRef.value)
  if (topDishChartRef.value) topDishChart = echarts.init(topDishChartRef.value)
  if (sourceChartRef.value) sourceChart = echarts.init(sourceChartRef.value)
  if (hourChartRef.value) hourChart = echarts.init(hourChartRef.value)
}

// 更新订单趋势图
function updateTrendChart() {
  if (!trendChart) return
  const option: echarts.EChartsOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: chartData.value.legend, bottom: 0 },
    grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category',
      data: chartData.value.dates,
      axisLine: { lineStyle: { color: '#E8E8E8' } },
      axisLabel: { color: '#999' },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisLabel: { color: '#999' },
      splitLine: { lineStyle: { color: '#F0F0F0' } },
    },
    series: [
      {
        name: chartData.value.series[0]?.name || '订单量',
        type: 'line',
        smooth: true,
        data: chartData.value.series[0]?.data || [],
        itemStyle: { color: '#FF4B33' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(255, 75, 51, 0.3)' },
            { offset: 1, color: 'rgba(255, 75, 51, 0)' },
          ]),
        },
      },
    ],
  }
  trendChart.setOption(option)
}

// 更新热销菜品 TOP10
function updateTopDishChart() {
  if (!topDishChart) return
  const option: echarts.EChartsOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '8%', bottom: '5%', top: '5%', containLabel: true },
    xAxis: {
      type: 'value',
      axisLine: { show: false },
      axisLabel: { color: '#999' },
      splitLine: { lineStyle: { color: '#F0F0F0' } },
    },
    yAxis: {
      type: 'category',
      data: topDishes.value.map((item) => item.name).reverse(),
      axisLine: { lineStyle: { color: '#E8E8E8' } },
      axisLabel: { color: '#666' },
    },
    series: [
      {
        type: 'bar',
        data: topDishes.value.map((item) => item.value).reverse(),
        barWidth: '50%',
        itemStyle: {
          color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [
            { offset: 0, color: '#FF4B33' },
            { offset: 1, color: '#FF8A80' },
          ]),
          borderRadius: [0, 4, 4, 0],
        },
      },
    ],
  }
  topDishChart.setOption(option)
}

// 更新用户来源饼图
function updateSourceChart() {
  if (!sourceChart) return
  const option: echarts.EChartsOption = {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    color: ['#FF4B33', '#FFC300', '#00C853', '#2196F3', '#9C27B0'],
    series: [
      {
        type: 'pie',
        radius: ['40%', '65%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
        label: { show: true, formatter: '{b}: {d}%' },
        data: userSources.value,
      },
    ],
  }
  sourceChart.setOption(option)
}

// 更新时段分析图
function updateHourChart() {
  if (!hourChart) return
  const option: echarts.EChartsOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '10%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category',
      data: hourData.value.hours,
      axisLine: { lineStyle: { color: '#E8E8E8' } },
      axisLabel: { color: '#999' },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisLabel: { color: '#999' },
      splitLine: { lineStyle: { color: '#F0F0F0' } },
    },
    series: [
      {
        type: 'bar',
        data: hourData.value.values,
        barWidth: '40%',
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#FFC300' },
            { offset: 1, color: '#FF9800' },
          ]),
          borderRadius: [4, 4, 0, 0],
        },
      },
    ],
  }
  hourChart.setOption(option)
}

// 获取图表数据（热销菜品、用户来源、时段分析）
async function fetchChartData() {
  try {
    const [topDishesRes, userSourcesRes, hourDataRes] = await Promise.all([
      api.stats.getTopDishes(),
      api.stats.getUserSources(),
      api.stats.getHourlyDistribution(),
    ])
    topDishes.value = topDishesRes.data || []
    userSources.value = userSourcesRes.data || []
    hourData.value = hourDataRes.data || { hours: [], values: [] }
  } catch {
    topDishes.value = []
    userSources.value = []
    hourData.value = { hours: [], values: [] }
  }
}

// 获取统计数据
async function fetchStatsData() {
  loading.value = true
  try {
    const [dashboardRes, chartRes] = await Promise.all([
      api.stats.getDashboard(),
      api.finance.getChartData(),
    ])

    stats.value = {
      orderCount: dashboardRes.data.orderCount,
      income: dashboardRes.data.income,
      userCount: dashboardRes.data.userCount,
      merchantCount: dashboardRes.data.merchantCount,
    }
    chartData.value = chartRes.data

    await fetchChartData()

    updateTrendChart()
    updateTopDishChart()
    updateSourceChart()
    updateHourChart()
  } finally {
    loading.value = false
  }
}

// 窗口大小变化时重绘
function handleResize() {
  trendChart?.resize()
  topDishChart?.resize()
  sourceChart?.resize()
  hourChart?.resize()
}

onMounted(() => {
  initCharts()
  fetchStatsData()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  trendChart?.dispose()
  topDishChart?.dispose()
  sourceChart?.dispose()
  hourChart?.dispose()
})
</script>

<template>
  <div class="merchant-stats">
    <app-header title="数据统计" />

    <!-- 顶部统计卡片 -->
    <div class="stats-row">
      <app-card class="stats-card" :body-style="{ padding: '20px' }">
        <div class="stats-card__content">
          <div class="stats-card__info">
            <p class="stats-card__label">累计订单</p>
            <p class="stats-card__value" style="color: #FF4B33">{{ formatNumber(stats.orderCount) }}<span class="suffix">单</span></p>
          </div>
          <div class="stats-card__icon" style="backgroundColor: #FF4B3315; color: #FF4B33">
            <el-icon :size="28"><Document /></el-icon>
          </div>
        </div>
      </app-card>
      <app-card class="stats-card" :body-style="{ padding: '20px' }">
        <div class="stats-card__content">
          <div class="stats-card__info">
            <p class="stats-card__label">累计收入</p>
            <p class="stats-card__value" style="color: #FFC300">{{ formatAmount(stats.income) }}</p>
          </div>
          <div class="stats-card__icon" style="backgroundColor: #FFC30015; color: #FFC300">
            <el-icon :size="28"><Money /></el-icon>
          </div>
        </div>
      </app-card>
      <app-card class="stats-card" :body-style="{ padding: '20px' }">
        <div class="stats-card__content">
          <div class="stats-card__info">
            <p class="stats-card__label">用户总数</p>
            <p class="stats-card__value" style="color: #00C853">{{ formatNumber(stats.userCount) }}<span class="suffix">人</span></p>
          </div>
          <div class="stats-card__icon" style="backgroundColor: #00C85315; color: #00C853">
            <el-icon :size="28"><User /></el-icon>
          </div>
        </div>
      </app-card>
      <app-card class="stats-card" :body-style="{ padding: '20px' }">
        <div class="stats-card__content">
          <div class="stats-card__info">
            <p class="stats-card__label">合作商家</p>
            <p class="stats-card__value" style="color: #2196F3">{{ formatNumber(stats.merchantCount) }}<span class="suffix">家</span></p>
          </div>
          <div class="stats-card__icon" style="backgroundColor: #2196F315; color: #2196F3">
            <el-icon :size="28"><Shop /></el-icon>
          </div>
        </div>
      </app-card>
    </div>

    <!-- 订单趋势图 -->
    <app-card title="订单趋势">
      <div ref="trendChartRef" v-loading="loading" class="chart trend-chart" />
    </app-card>

    <!-- 多维度图表 -->
    <div class="charts-row">
      <app-card title="热销菜品 TOP10" class="chart-card">
        <div ref="topDishChartRef" v-loading="loading" class="chart" />
      </app-card>
      <app-card title="用户来源分布" class="chart-card">
        <div ref="sourceChartRef" v-loading="loading" class="chart" />
      </app-card>
    </div>

    <app-card title="时段分析">
      <div ref="hourChartRef" v-loading="loading" class="chart hour-chart" />
    </app-card>
  </div>
</template>

<style scoped lang="scss">
.merchant-stats {
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

      .suffix {
        font-size: $font-size-md;
        margin-left: $spacing-xs;
      }
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

  .chart {
    width: 100%;
    height: 320px;
  }

  .trend-chart {
    height: 360px;
  }

  .hour-chart {
    height: 300px;
  }

  .charts-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: $spacing-md;
    margin-bottom: $spacing-md;

    @media screen and (max-width: 992px) {
      grid-template-columns: 1fr;
    }
  }

  .chart-card {
    margin-bottom: 0;
  }
}
</style>
