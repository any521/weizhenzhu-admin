<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import { UserFilled, Shop, Bicycle, DocumentCopy, Money } from '@element-plus/icons-vue'
import { api } from '@/api'
import AppCard from '@/components/AppCard.vue'
import AppHeader from '@/components/AppHeader.vue'
import { formatAmount, formatNumber } from '@/utils/format'
import type { ChartData } from '@/api/types'

interface DashboardData {
  userCount: number
  merchantCount: number
  riderCount: number
  todayOrderCount: number
  todayIncome: number
  chartData: ChartData
  todos: { id: number; title: string; type: string; count: number }[]
  announcements: { id: number; title: string; content: string; createTime: string }[]
}

const loading = ref(false)
const chartRef = ref<HTMLDivElement>()
const data = ref<DashboardData>({
  userCount: 0,
  merchantCount: 0,
  riderCount: 0,
  todayOrderCount: 0,
  todayIncome: 0,
  chartData: { dates: [], values: [], legend: [], series: [] },
  todos: [],
  announcements: [],
})

// 核心指标卡片配置
const statCards = [
  { title: '总用户数', key: 'userCount', icon: UserFilled, color: '#FF4B33' },
  { title: '总商家数', key: 'merchantCount', icon: Shop, color: '#00C853' },
  { title: '总骑手数', key: 'riderCount', icon: Bicycle, color: '#2196F3' },
  { title: '今日订单数', key: 'todayOrderCount', icon: DocumentCopy, color: '#FF9800' },
  { title: '今日成交额', key: 'todayIncome', icon: Money, color: '#FF4B33', isAmount: true },
] as const

// 初始化图表
function initChart() {
  if (!chartRef.value) return
  const chart = echarts.init(chartRef.value)
  const option: echarts.EChartsOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    legend: { data: data.value.chartData.legend || ['订单量', '销售额'], bottom: 0 },
    grid: { left: '3%', right: '4%', bottom: '10%', top: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      data: data.value.chartData.dates,
      axisLine: { lineStyle: { color: '#E8E8E8' } },
      axisLabel: { color: '#666' },
    },
    yAxis: [
      {
        type: 'value',
        name: '订单量',
        position: 'left',
        axisLine: { show: true, lineStyle: { color: '#FF4B33' } },
        axisLabel: { color: '#666' },
        splitLine: { lineStyle: { color: '#F0F0F0' } },
      },
      {
        type: 'value',
        name: '销售额（元）',
        position: 'right',
        axisLine: { show: true, lineStyle: { color: '#2196F3' } },
        axisLabel: { color: '#666' },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: data.value.chartData.legend?.[0] || '订单量',
        type: 'bar',
        data: data.value.chartData.series?.[0]?.data || data.value.chartData.values,
        itemStyle: { color: '#FF4B33', borderRadius: [4, 4, 0, 0] },
        barWidth: '30%',
      },
      {
        name: data.value.chartData.legend?.[1] || '销售额',
        type: 'line',
        yAxisIndex: 1,
        data: data.value.chartData.series?.[1]?.data || [],
        smooth: true,
        itemStyle: { color: '#2196F3' },
        lineStyle: { width: 3 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(33, 150, 243, 0.3)' },
            { offset: 1, color: 'rgba(33, 150, 243, 0.05)' },
          ]),
        },
      },
    ],
  }
  chart.setOption(option)
  window.addEventListener('resize', () => chart.resize())
}

// 加载数据
async function loadData() {
  loading.value = true
  try {
    const res = await api.stats.getDashboard()
    data.value = res.data
    await nextTick()
    initChart()
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <div v-loading="loading" class="admin-dashboard">
    <AppHeader title="管理控制台" subtitle="平台运营数据一览" />

    <!-- 顶部核心数据卡片 -->
    <el-row :gutter="16" class="stat-row">
      <el-col v-for="card in statCards" :key="card.key" :xs="24" :sm="12" :md="8" :lg="4">
        <AppCard shadow="hover" class="stat-card">
          <div class="stat-card__content">
            <div class="stat-card__icon" :style="{ backgroundColor: `${card.color}15`, color: card.color }">
              <el-icon :size="28">
                <component :is="card.icon" />
              </el-icon>
            </div>
            <div class="stat-card__info">
              <p class="stat-card__title">{{ card.title }}</p>
              <p class="stat-card__value" :style="{ color: card.color }">
                {{ card.isAmount ? formatAmount(data[card.key]) : formatNumber(data[card.key]) }}
              </p>
            </div>
          </div>
        </AppCard>
      </el-col>
    </el-row>

    <!-- 中部图表 -->
    <AppCard title="近 7 天平台订单/成交额趋势" class="chart-card">
      <div ref="chartRef" class="dashboard-chart" />
    </AppCard>

    <!-- 底部左右两栏 -->
    <el-row :gutter="16">
      <el-col :xs="24" :lg="12">
        <AppCard title="待处理事项">
          <div v-if="data.todos.length === 0" class="empty-section">
            <AppEmpty description="暂无待处理事项" />
          </div>
          <ul v-else class="todo-list">
            <li v-for="item in data.todos" :key="item.id" class="todo-item">
              <span class="todo-item__title">{{ item.title }}</span>
              <el-tag type="danger" effect="plain" round>{{ item.count }} 项</el-tag>
            </li>
          </ul>
        </AppCard>
      </el-col>
      <el-col :xs="24" :lg="12">
        <AppCard title="平台公告">
          <div v-if="data.announcements.length === 0" class="empty-section">
            <AppEmpty description="暂无公告" />
          </div>
          <ul v-else class="announcement-list">
            <li v-for="item in data.announcements" :key="item.id" class="announcement-item">
              <p class="announcement-item__title">{{ item.title }}</p>
              <p class="announcement-item__content">{{ item.content }}</p>
              <p class="announcement-item__time">{{ item.createTime }}</p>
            </li>
          </ul>
        </AppCard>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped lang="scss">
.admin-dashboard {
  padding-bottom: $spacing-md;
}

.stat-row {
  margin-bottom: $spacing-md;
}

.stat-card {
  margin-bottom: $spacing-md;

  &__content {
    display: flex;
    align-items: center;
    gap: $spacing-md;
  }

  &__icon {
    width: 56px;
    height: 56px;
    border-radius: $radius-md;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__title {
    font-size: $font-size-sm;
    color: $text-muted;
    margin-bottom: $spacing-xs;
  }

  &__value {
    font-size: 22px;
    font-weight: 700;
  }
}

.chart-card {
  .dashboard-chart {
    width: 100%;
    height: 360px;
  }
}

.empty-section {
  padding: $spacing-lg 0;
}

.todo-list {
  .todo-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: $spacing-md;
    border-bottom: 1px solid $border-light;
    transition: background-color $transition-fast;

    &:last-child {
      border-bottom: none;
    }

    &:hover {
      background-color: #fff9f9;
      border-radius: $radius-md;
    }

    &__title {
      font-size: $font-size-md;
      color: $text;
    }
  }
}

.announcement-list {
  .announcement-item {
    padding: $spacing-md;
    border-bottom: 1px solid $border-light;

    &:last-child {
      border-bottom: none;
    }

    &__title {
      font-size: $font-size-md;
      font-weight: 600;
      color: $text;
      margin-bottom: $spacing-xs;
    }

    &__content {
      font-size: $font-size-sm;
      color: $text-light;
      line-height: 1.6;
      margin-bottom: $spacing-xs;
    }

    &__time {
      font-size: $font-size-xs;
      color: $text-muted;
    }
  }
}
</style>
