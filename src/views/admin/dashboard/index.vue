<script setup lang="ts">
import { ref, onMounted, nextTick, computed } from 'vue'
import * as echarts from 'echarts'
import {
  UserFilled, Shop, Bicycle, DocumentCopy, Money,
  TrendCharts, Coin, Warning, DataAnalysis
} from '@element-plus/icons-vue'
import api from '@/api'
import AppCard from '@/components/AppCard.vue'
import AppHeader from '@/components/AppHeader.vue'
import AppEmpty from '@/components/AppEmpty.vue'
import { formatNumber } from '@/utils/format'

// ==================== 类型定义 ====================

// 后端返回的金额单位是"元"（double），此函数直接格式化
function formatMoney(v?: number): string {
  if (v === undefined || v === null || isNaN(v)) return '-'
  return `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// 百分比格式化（后端返回如 92.3 表示 92.3%）
function formatPercent(v?: number): string {
  if (v === undefined || v === null || isNaN(v)) return '-'
  return `${v}%`
}

// 待办事项
interface TodoItem {
  id: number
  type: string
  title: string
  count: number
  color?: string
}

// 公告
interface AnnouncementItem {
  id: number
  title: string
  content: string
  createTime: string
}

// 总览数据
interface OverviewData {
  userCount: number
  merchantCount: number
  riderCount: number
  todayOrderCount: number
  todayIncome: number
  pendingMerchants: number
  todos: TodoItem[]
  announcements: AnnouncementItem[]
  chartData: {
    dates: string[]
    orders: number[]
    revenues: number[]
  }
}

// 用户数据
interface UserData {
  totalUsers: number
  dailyActive: number
  todayNew: number
  retentionRate: number
  growthChart: { dates: string[]; newUsers: number[]; totalUsers: number[] }
  sourceData: { name: string; value: number }[]
  activityData: { name: string; value: number }[]
}

// 商家数据
interface MerchantData {
  totalMerchants: number
  activeMerchants: number
  pendingMerchants: number
  disabledMerchants: number
  merchantRank: { name: string; value: number; orderCount: number }[]
  categoryData: { name: string; value: number }[]
  trendChart: { dates: string[]; newMerchants: number[]; auditedMerchants: number[] }
}

// 订单数据
interface OrderData {
  todayOrderCount: number
  completionRate: number
  cancelRate: number
  avgOrderValue: number
  trendChart: { dates: string[]; completed: number[]; canceled: number[]; refunded: number[] }
  statusData: { name: string; value: number }[]
  hourChart: { hours: string[]; counts: number[] }
  topDishes: { name: string; count: number; revenue: number }[]
}

// 骑手数据
interface RiderData {
  totalRiders: number
  onDutyRiders: number
  idleRiders: number
  avgDeliveryTime: number
  statusData: { name: string; value: number }[]
  riderRank: { name: string; orderCount: number; avgDuration: number }[]
  hourChart: { hours: string[]; counts: number[] }
}

// 财务数据
interface FinanceData {
  todayIncome: number
  todayCommission: number
  weekIncome: number
  refundAmount: number
  incomeChart: { dates: string[]; totalRevenue: number[]; commission: number[]; merchantRevenue: number[] }
  compareChart: { weeks: string[]; thisWeek: number[]; lastWeek: number[] }
  refundReasons: { name: string; value: number }[]
}

// 管理对象类型
type ObjectType = 'overview' | 'user' | 'merchant' | 'order' | 'rider' | 'finance'

interface TabConfig {
  key: ObjectType
  label: string
  icon: any
  color: string
}

// ==================== 常量配置 ====================
const THEME_COLOR = '#FF6B35'
const COLORS = {
  primary: THEME_COLOR,
  green: '#06D6A0',
  blue: '#2196F3',
  yellow: '#FFB347',
  red: '#EF476F',
  purple: '#9B5DE5',
  teal: '#073B4C',
  pink: '#F15BB5',
  cyan: '#00BBF9',
  lime: '#9BE300',
}

// 饼图/分类图颜色循环
const PIE_COLORS = [COLORS.primary, COLORS.green, COLORS.blue, COLORS.yellow, COLORS.red, COLORS.purple, COLORS.pink, COLORS.cyan, COLORS.teal, COLORS.lime]
const BAR_COLORS = [COLORS.green, COLORS.cyan, COLORS.blue, COLORS.yellow, COLORS.red, COLORS.purple, COLORS.pink, COLORS.teal, COLORS.primary, COLORS.lime]

// 对象切换标签
const objectTabs: TabConfig[] = [
  { key: 'overview', label: '总览', icon: DataAnalysis, color: COLORS.primary },
  { key: 'user', label: '用户分析', icon: UserFilled, color: COLORS.blue },
  { key: 'merchant', label: '商家分析', icon: Shop, color: COLORS.green },
  { key: 'order', label: '订单分析', icon: DocumentCopy, color: COLORS.yellow },
  { key: 'rider', label: '骑手分析', icon: Bicycle, color: COLORS.purple },
  { key: 'finance', label: '财务分析', icon: Coin, color: COLORS.red },
]

const activeTab = ref<ObjectType>('overview')
const loading = ref(false)
const chartsReady = ref(false)
const dateRange = ref<'7d' | '30d'>('7d')

// ==================== 各面板响应式数据 ====================
const overviewData = ref<OverviewData>({
  userCount: 0,
  merchantCount: 0,
  riderCount: 0,
  todayOrderCount: 0,
  todayIncome: 0,
  pendingMerchants: 0,
  todos: [],
  announcements: [],
  chartData: { dates: [], orders: [], revenues: [] },
})

const userData = ref<UserData>({
  totalUsers: 0,
  dailyActive: 0,
  todayNew: 0,
  retentionRate: 0,
  growthChart: { dates: [], newUsers: [], totalUsers: [] },
  sourceData: [],
  activityData: [],
})

const merchantData = ref<MerchantData>({
  totalMerchants: 0,
  activeMerchants: 0,
  pendingMerchants: 0,
  disabledMerchants: 0,
  merchantRank: [],
  categoryData: [],
  trendChart: { dates: [], newMerchants: [], auditedMerchants: [] },
})

const orderData = ref<OrderData>({
  todayOrderCount: 0,
  completionRate: 0,
  cancelRate: 0,
  avgOrderValue: 0,
  trendChart: { dates: [], completed: [], canceled: [], refunded: [] },
  statusData: [],
  hourChart: { hours: [], counts: [] },
  topDishes: [],
})

const riderData = ref<RiderData>({
  totalRiders: 0,
  onDutyRiders: 0,
  idleRiders: 0,
  avgDeliveryTime: 0,
  statusData: [],
  riderRank: [],
  hourChart: { hours: [], counts: [] },
})

const financeData = ref<FinanceData>({
  todayIncome: 0,
  todayCommission: 0,
  weekIncome: 0,
  refundAmount: 0,
  incomeChart: { dates: [], totalRevenue: [], commission: [], merchantRevenue: [] },
  compareChart: { weeks: [], thisWeek: [], lastWeek: [] },
  refundReasons: [],
})

// 总览指标卡片
const overviewCards = computed(() => [
  { title: '总用户数', value: overviewData.value.userCount, icon: UserFilled, color: COLORS.blue, trend: '' },
  { title: '总商家数', value: overviewData.value.merchantCount, icon: Shop, color: COLORS.green, trend: '' },
  { title: '总骑手数', value: overviewData.value.riderCount, icon: Bicycle, color: COLORS.purple, trend: '' },
  { title: '今日订单', value: overviewData.value.todayOrderCount, icon: DocumentCopy, color: COLORS.yellow, trend: '' },
  { title: '今日成交额', value: overviewData.value.todayIncome, icon: Money, color: COLORS.primary, isAmount: true, trend: '' },
  { title: '待审核', value: overviewData.value.todos.reduce((s, t) => s + t.count, 0), icon: Warning, color: COLORS.red, trend: '需处理' },
])

// 辅助：给饼图数据项循环上色
function withPieColors(data: { name: string; value: number }[]): { name: string; value: number; itemStyle: { color: string } }[] {
  return data.map((item, i) => ({ ...item, itemStyle: { color: PIE_COLORS[i % PIE_COLORS.length] } }))
}

// ==================== 图表ref ====================
const chartRefs: Record<string, HTMLDivElement | null> = {
  overview: null,
  userGrowth: null,
  userSource: null,
  userActive: null,
  merchantRank: null,
  merchantCategory: null,
  merchantTrend: null,
  orderTrend: null,
  orderStatus: null,
  orderHour: null,
  orderTopDish: null,
  riderStatus: null,
  riderEfficiency: null,
  riderHour: null,
  financeIncome: null,
  financeCompare: null,
  financeRefund: null,
}

const chartInstances: Record<string, echarts.ECharts | null> = {}

// ==================== 图表初始化函数 ====================

// 总览双Y轴趋势图
function initOverviewChart() {
  const el = chartRefs.overview
  if (!el) return
  const chart = echarts.init(el)
  chartInstances.overview = chart
  const { dates, orders, revenues } = overviewData.value.chartData

  chart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    legend: { data: ['订单量', '销售额'], bottom: 0 },
    grid: { left: '3%', right: '4%', bottom: '12%', top: '10%', containLabel: true },
    xAxis: { type: 'category', data: dates, axisLine: { lineStyle: { color: '#E8E8E8' } }, axisLabel: { color: '#666' } },
    yAxis: [
      { type: 'value', name: '订单量', position: 'left', axisLine: { show: true, lineStyle: { color: COLORS.primary } }, splitLine: { lineStyle: { color: '#F0F0F0' } } },
      { type: 'value', name: '销售额(元)', position: 'right', axisLine: { show: true, lineStyle: { color: COLORS.yellow } }, splitLine: { show: false } },
    ],
    series: [
      {
        name: '订单量', type: 'bar', data: orders, barWidth: '30%',
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: COLORS.primary }, { offset: 1, color: '#FF9A6C' }
          ]), borderRadius: [4, 4, 0, 0]
        }
      },
      {
        name: '销售额', type: 'line', yAxisIndex: 1, data: revenues, smooth: true,
        itemStyle: { color: COLORS.yellow }, lineStyle: { width: 3 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(255,179,71,0.3)' }, { offset: 1, color: 'rgba(255,179,71,0.05)' }
          ])
        }
      }
    ]
  })
}

// 用户增长趋势
function initUserGrowthChart() {
  const el = chartRefs.userGrowth
  if (!el) return
  const chart = echarts.init(el)
  chartInstances.userGrowth = chart
  const { dates, newUsers, totalUsers: cumulative } = userData.value.growthChart

  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['新增用户', '累计用户'], bottom: 0 },
    grid: { left: '3%', right: '4%', bottom: '12%', top: '10%', containLabel: true },
    xAxis: { type: 'category', data: dates, axisLine: { lineStyle: { color: '#E8E8E8' } }, axisLabel: { color: '#666' } },
    yAxis: [
      { type: 'value', name: '新增', position: 'left', splitLine: { lineStyle: { color: '#F0F0F0' } } },
      { type: 'value', name: '累计', position: 'right', splitLine: { show: false } },
    ],
    series: [
      { name: '新增用户', type: 'bar', data: newUsers, barWidth: '30%', itemStyle: { color: COLORS.blue, borderRadius: [4, 4, 0, 0] } },
      { name: '累计用户', type: 'line', yAxisIndex: 1, data: cumulative, smooth: true, itemStyle: { color: COLORS.cyan }, lineStyle: { width: 3 },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(0,187,249,0.25)' }, { offset: 1, color: 'rgba(0,187,249,0.02)' }]) } }
    ]
  })
}

// 用户来源分布
function initUserSourceChart() {
  const el = chartRefs.userSource
  if (!el) return
  const chart = echarts.init(el)
  chartInstances.userSource = chart
  chart.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, left: 'center' },
    series: [{
      type: 'pie', radius: ['40%', '70%'], center: ['50%', '45%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold' } },
      labelLine: { show: false },
      data: withPieColors(userData.value.sourceData),
    }]
  })
}

// 用户活跃度分布
function initUserActiveChart() {
  const el = chartRefs.userActive
  if (!el) return
  const chart = echarts.init(el)
  chartInstances.userActive = chart
  const data = userData.value.activityData.map((item, i) => ({
    value: item.value,
    itemStyle: { color: BAR_COLORS[i % BAR_COLORS.length] },
  }))
  const names = userData.value.activityData.map(d => d.name)

  chart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '4%', bottom: '8%', top: '10%', containLabel: true },
    xAxis: { type: 'value', splitLine: { lineStyle: { color: '#F0F0F0' } } },
    yAxis: { type: 'category', data: names, axisLine: { lineStyle: { color: '#E8E8E8' } } },
    series: [{
      type: 'bar',
      data,
      barWidth: '50%',
      itemStyle: { borderRadius: [0, 6, 6, 0] },
      label: { show: true, position: 'right', formatter: '{c}人' }
    }]
  })
}

// 商家销售排行TOP10
function initMerchantRankChart() {
  const el = chartRefs.merchantRank
  if (!el) return
  const chart = echarts.init(el)
  chartInstances.merchantRank = chart
  const rank = [...merchantData.value.merchantRank].sort((a, b) => a.value - b.value)
  const merchants = rank.map(r => r.name)
  const sales = rank.map(r => r.value)

  chart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '8%', bottom: '3%', top: '5%', containLabel: true },
    xAxis: { type: 'value', axisLabel: { formatter: '{value}元' }, splitLine: { lineStyle: { color: '#F0F0F0' } } },
    yAxis: { type: 'category', data: merchants, axisLine: { lineStyle: { color: '#E8E8E8' } } },
    series: [{
      type: 'bar', data: sales, barWidth: '55%',
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: COLORS.green }, { offset: 1, color: '#4EE5B8' }
        ]), borderRadius: [0, 6, 6, 0]
      },
      label: { show: true, position: 'right', formatter: (p: any) => `¥${(p.value / 1000).toFixed(1)}k` }
    }]
  })
}

// 商家品类分布
function initMerchantCategoryChart() {
  const el = chartRefs.merchantCategory
  if (!el) return
  const chart = echarts.init(el)
  chartInstances.merchantCategory = chart
  chart.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c}家 ({d}%)' },
    legend: { bottom: 0, left: 'center', type: 'scroll' },
    series: [{
      type: 'pie', radius: ['40%', '70%'], center: ['50%', '45%'], roseType: 'radius',
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      label: { formatter: '{b}\n{d}%' },
      data: withPieColors(merchantData.value.categoryData),
    }]
  })
}

// 商家入驻趋势
function initMerchantTrendChart() {
  const el = chartRefs.merchantTrend
  if (!el) return
  const chart = echarts.init(el)
  chartInstances.merchantTrend = chart
  const { dates, newMerchants, auditedMerchants } = merchantData.value.trendChart

  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['新入驻', '审核通过'], bottom: 0 },
    grid: { left: '3%', right: '4%', bottom: '12%', top: '10%', containLabel: true },
    xAxis: { type: 'category', data: dates, axisLine: { lineStyle: { color: '#E8E8E8' } } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#F0F0F0' } } },
    series: [
      { name: '新入驻', type: 'line', data: newMerchants, smooth: true, itemStyle: { color: COLORS.green }, areaStyle: { color: 'rgba(6,214,160,0.15)' } },
      { name: '审核通过', type: 'line', data: auditedMerchants, smooth: true, itemStyle: { color: COLORS.blue }, areaStyle: { color: 'rgba(33,150,243,0.1)' } },
    ]
  })
}

// 订单趋势分析
function initOrderTrendChart() {
  const el = chartRefs.orderTrend
  if (!el) return
  const chart = echarts.init(el)
  chartInstances.orderTrend = chart
  const { dates, completed, canceled, refunded } = orderData.value.trendChart

  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['已完成', '已取消', '退款'], bottom: 0 },
    grid: { left: '3%', right: '4%', bottom: '12%', top: '10%', containLabel: true },
    xAxis: { type: 'category', data: dates, axisLine: { lineStyle: { color: '#E8E8E8' } } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#F0F0F0' } } },
    series: [
      { name: '已完成', type: 'bar', stack: 'total', data: completed, itemStyle: { color: COLORS.green, borderRadius: [0, 0, 0, 0] } },
      { name: '已取消', type: 'bar', stack: 'total', data: canceled, itemStyle: { color: COLORS.yellow } },
      { name: '退款', type: 'bar', stack: 'total', data: refunded, itemStyle: { color: COLORS.red, borderRadius: [4, 4, 0, 0] } },
    ]
  })
}

// 订单状态分布
function initOrderStatusChart() {
  const el = chartRefs.orderStatus
  if (!el) return
  const chart = echarts.init(el)
  chartInstances.orderStatus = chart
  chart.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c}单 ({d}%)' },
    legend: { bottom: 0, left: 'center' },
    series: [{
      type: 'pie', radius: ['45%', '70%'], center: ['50%', '45%'],
      itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
      label: { formatter: '{b}\n{d}%' },
      data: withPieColors(orderData.value.statusData),
    }]
  })
}

// 订单时段分布
function initOrderHourChart() {
  const el = chartRefs.orderHour
  if (!el) return
  const chart = echarts.init(el)
  chartInstances.orderHour = chart
  const { hours, counts } = orderData.value.hourChart

  chart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '8%', top: '10%', containLabel: true },
    xAxis: { type: 'category', data: hours, axisLine: { lineStyle: { color: '#E8E8E8' } }, axisLabel: { interval: 2 } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#F0F0F0' } } },
    series: [{
      type: 'bar', data: counts, barWidth: '60%',
      markPoint: {
        data: [{ type: 'max', name: '高峰时段' }],
        itemStyle: { color: COLORS.red }
      },
      itemStyle: {
        color: (p: any) => {
          const v = p.value
          if (v > 180) return COLORS.red
          if (v > 100) return COLORS.primary
          if (v > 50) return COLORS.yellow
          return COLORS.cyan
        },
        borderRadius: [4, 4, 0, 0]
      }
    }]
  })
}

// 热销菜品TOP10
function initOrderTopDishChart() {
  const el = chartRefs.orderTopDish
  if (!el) return
  const chart = echarts.init(el)
  chartInstances.orderTopDish = chart
  const dishes = [...orderData.value.topDishes].sort((a, b) => a.count - b.count)
  const names = dishes.map(d => d.name)
  const counts = dishes.map(d => d.count)

  chart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '8%', bottom: '3%', top: '5%', containLabel: true },
    xAxis: { type: 'value', splitLine: { lineStyle: { color: '#F0F0F0' } } },
    yAxis: { type: 'category', data: names, axisLine: { lineStyle: { color: '#E8E8E8' } } },
    series: [{
      type: 'bar', data: counts, barWidth: '55%',
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: COLORS.yellow }, { offset: 1, color: '#FFD380' }
        ]), borderRadius: [0, 6, 6, 0]
      },
      label: { show: true, position: 'right', formatter: '{c}份' }
    }]
  })
}

// 骑手状态分布
function initRiderStatusChart() {
  const el = chartRefs.riderStatus
  if (!el) return
  const chart = echarts.init(el)
  chartInstances.riderStatus = chart
  chart.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c}人 ({d}%)' },
    legend: { bottom: 0, left: 'center' },
    series: [{
      type: 'pie', radius: ['45%', '70%'], center: ['50%', '45%'],
      itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
      label: { formatter: '{b}\n{d}%' },
      data: withPieColors(riderData.value.statusData),
    }]
  })
}

// 骑手绩效排行
function initRiderEfficiencyChart() {
  const el = chartRefs.riderEfficiency
  if (!el) return
  const chart = echarts.init(el)
  chartInstances.riderEfficiency = chart
  const rank = [...riderData.value.riderRank].sort((a, b) => a.orderCount - b.orderCount)
  const riders = rank.map(r => r.name)
  const orders = rank.map(r => r.orderCount)
  const durations = rank.map(r => r.avgDuration)

  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['完成订单', '平均配送时长(分)'], bottom: 0 },
    grid: { left: '3%', right: '4%', bottom: '12%', top: '10%', containLabel: true },
    xAxis: { type: 'category', data: riders, axisLabel: { rotate: 30 }, axisLine: { lineStyle: { color: '#E8E8E8' } } },
    yAxis: [
      { type: 'value', name: '订单数', splitLine: { lineStyle: { color: '#F0F0F0' } } },
      { type: 'value', name: '时长(分)', splitLine: { show: false } },
    ],
    series: [
      { name: '完成订单', type: 'bar', data: orders, barWidth: '40%', itemStyle: { color: COLORS.purple, borderRadius: [4, 4, 0, 0] } },
      { name: '平均配送时长(分)', type: 'line', yAxisIndex: 1, data: durations, smooth: true, itemStyle: { color: COLORS.yellow }, lineStyle: { width: 3 }, symbolSize: 8 }
    ]
  })
}

// 骑手配送时段
function initRiderHourChart() {
  const el = chartRefs.riderHour
  if (!el) return
  const chart = echarts.init(el)
  chartInstances.riderHour = chart
  const { hours, counts } = riderData.value.hourChart

  chart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '8%', top: '10%', containLabel: true },
    xAxis: { type: 'category', data: hours, axisLine: { lineStyle: { color: '#E8E8E8' } }, axisLabel: { interval: 2 } },
    yAxis: { type: 'value', name: '配送量', splitLine: { lineStyle: { color: '#F0F0F0' } } },
    series: [{
      type: 'line', data: counts, smooth: true,
      itemStyle: { color: COLORS.purple }, lineStyle: { width: 3 },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(155,93,229,0.3)' }, { offset: 1, color: 'rgba(155,93,229,0.03)' }
        ])
      }
    }]
  })
}

// 财务收入趋势
function initFinanceIncomeChart() {
  const el = chartRefs.financeIncome
  if (!el) return
  const chart = echarts.init(el)
  chartInstances.financeIncome = chart
  const { dates, totalRevenue, commission, merchantRevenue } = financeData.value.incomeChart

  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['总交易额', '平台佣金', '商家收入'], bottom: 0 },
    grid: { left: '3%', right: '4%', bottom: '12%', top: '10%', containLabel: true },
    xAxis: { type: 'category', data: dates, axisLine: { lineStyle: { color: '#E8E8E8' } } },
    yAxis: { type: 'value', axisLabel: { formatter: '¥{value}' }, splitLine: { lineStyle: { color: '#F0F0F0' } } },
    series: [
      { name: '总交易额', type: 'line', data: totalRevenue, smooth: true, itemStyle: { color: COLORS.red }, lineStyle: { width: 3 },
        areaStyle: { color: 'rgba(239,71,111,0.12)' } },
      { name: '平台佣金', type: 'line', data: commission, smooth: true, itemStyle: { color: COLORS.primary }, lineStyle: { width: 2 } },
      { name: '商家收入', type: 'line', data: merchantRevenue, smooth: true, itemStyle: { color: COLORS.green }, lineStyle: { width: 2 } },
    ]
  })
}

// 财务周度对比
function initFinanceCompareChart() {
  const el = chartRefs.financeCompare
  if (!el) return
  const chart = echarts.init(el)
  chartInstances.financeCompare = chart
  const { weeks, thisWeek, lastWeek } = financeData.value.compareChart

  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['本周', '上周'], bottom: 0 },
    grid: { left: '3%', right: '4%', bottom: '12%', top: '10%', containLabel: true },
    xAxis: { type: 'category', data: weeks, axisLine: { lineStyle: { color: '#E8E8E8' } } },
    yAxis: { type: 'value', name: '交易额(元)', axisLabel: { formatter: '¥{value}' }, splitLine: { lineStyle: { color: '#F0F0F0' } } },
    series: [
      { name: '本周', type: 'bar', data: thisWeek, barWidth: '35%', itemStyle: { color: COLORS.red, borderRadius: [4, 4, 0, 0] } },
      { name: '上周', type: 'bar', data: lastWeek, barWidth: '35%', itemStyle: { color: COLORS.primary, borderRadius: [4, 4, 0, 0] } },
    ]
  })
}

// 退款分析
function initFinanceRefundChart() {
  const el = chartRefs.financeRefund
  if (!el) return
  const chart = echarts.init(el)
  chartInstances.financeRefund = chart
  chart.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
    legend: { bottom: 0, left: 'center' },
    series: [{
      type: 'pie', radius: ['40%', '70%'], center: ['50%', '45%'],
      itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
      label: { formatter: '{b}\n¥{c}' },
      data: withPieColors(financeData.value.refundReasons),
    }]
  })
}

// ==================== 初始化当前Tab的所有图表 ====================
function initAllCharts() {
  // 销毁旧图表
  Object.values(chartInstances).forEach(c => c?.dispose())
  Object.keys(chartInstances).forEach(k => { chartInstances[k] = null })

  // 外层已经 await nextTick()，DOM已就绪，直接初始化
  switch (activeTab.value) {
    case 'overview':
      initOverviewChart()
      break
    case 'user':
      initUserGrowthChart()
      initUserSourceChart()
      initUserActiveChart()
      break
    case 'merchant':
      initMerchantRankChart()
      initMerchantCategoryChart()
      initMerchantTrendChart()
      break
    case 'order':
      initOrderTrendChart()
      initOrderStatusChart()
      initOrderHourChart()
      initOrderTopDishChart()
      break
    case 'rider':
      initRiderStatusChart()
      initRiderEfficiencyChart()
      initRiderHourChart()
      break
    case 'finance':
      initFinanceIncomeChart()
      initFinanceCompareChart()
      initFinanceRefundChart()
      break
  }
}

// ==================== 数据加载 ====================
function getDays(): number {
  return dateRange.value === '7d' ? 7 : 30
}

// 标准化总览数据（将后端字段映射为模板期望的字段）
function normalizeOverviewData(raw: any): OverviewData {
  const todos: TodoItem[] = Array.isArray(raw.todos)
    ? raw.todos.map((t: any, idx: number) => ({
        id: t.id ?? idx,
        type: t.type ?? '',
        title: t.title ?? '',
        count: t.count ?? 0,
        color: t.color,
      }))
    : []
  const announcements: AnnouncementItem[] = Array.isArray(raw.announcements)
    ? raw.announcements.map((a: any) => ({
        id: a.id,
        title: a.title ?? '',
        content: a.content ?? '',
        createTime: a.date ?? a.createTime ?? '',
      }))
    : []
  return {
    userCount: raw.totalUsers ?? 0,
    merchantCount: raw.totalMerchants ?? 0,
    riderCount: raw.totalRiders ?? 0,
    todayOrderCount: raw.todayOrderCount ?? 0,
    todayIncome: raw.todayIncome ?? 0,
    pendingMerchants: raw.pendingMerchants ?? 0,
    todos,
    announcements,
    chartData: {
      dates: raw.chartData?.dates ?? [],
      orders: raw.chartData?.orders ?? [],
      revenues: raw.chartData?.revenues ?? [],
    },
  }
}

// 加载指定 Tab 的数据
async function loadTabData(tab: ObjectType) {
  chartsReady.value = false
  loading.value = true
  const days = getDays()
  try {
    let res
    switch (tab) {
      case 'overview':
        res = await api.adminStats.dashboard(days)
        overviewData.value = normalizeOverviewData(res.data)
        break
      case 'user':
        res = await api.adminStats.user(days)
        userData.value = {
          totalUsers: res.data.totalUsers ?? 0,
          dailyActive: res.data.dailyActive ?? 0,
          todayNew: res.data.todayNew ?? 0,
          retentionRate: res.data.retentionRate ?? 0,
          growthChart: {
            dates: res.data.growthChart?.dates ?? [],
            newUsers: res.data.growthChart?.newUsers ?? [],
            totalUsers: res.data.growthChart?.totalUsers ?? [],
          },
          sourceData: res.data.sourceData ?? [],
          activityData: res.data.activityData ?? [],
        }
        // 同步总览的 userCount 以便跨面板引用
        overviewData.value.userCount = userData.value.totalUsers
        break
      case 'merchant':
        res = await api.adminStats.merchant(days)
        merchantData.value = {
          totalMerchants: res.data.totalMerchants ?? 0,
          activeMerchants: res.data.activeMerchants ?? 0,
          pendingMerchants: res.data.pendingMerchants ?? 0,
          disabledMerchants: res.data.disabledMerchants ?? 0,
          merchantRank: res.data.merchantRank ?? [],
          categoryData: res.data.categoryData ?? [],
          trendChart: {
            dates: res.data.trendChart?.dates ?? [],
            newMerchants: res.data.trendChart?.newMerchants ?? [],
            auditedMerchants: res.data.trendChart?.auditedMerchants ?? [],
          },
        }
        overviewData.value.merchantCount = merchantData.value.totalMerchants
        break
      case 'order':
        res = await api.adminStats.order(days)
        orderData.value = {
          todayOrderCount: res.data.todayOrderCount ?? 0,
          completionRate: res.data.completionRate ?? 0,
          cancelRate: res.data.cancelRate ?? 0,
          avgOrderValue: res.data.avgOrderValue ?? 0,
          trendChart: {
            dates: res.data.trendChart?.dates ?? [],
            completed: res.data.trendChart?.completed ?? [],
            canceled: res.data.trendChart?.canceled ?? [],
            refunded: res.data.trendChart?.refunded ?? [],
          },
          statusData: res.data.statusData ?? [],
          hourChart: {
            hours: res.data.hourChart?.hours ?? [],
            counts: res.data.hourChart?.counts ?? [],
          },
          topDishes: res.data.topDishes ?? [],
        }
        overviewData.value.todayOrderCount = orderData.value.todayOrderCount
        break
      case 'rider':
        res = await api.adminStats.rider(days)
        riderData.value = {
          totalRiders: res.data.totalRiders ?? 0,
          onDutyRiders: res.data.onDutyRiders ?? 0,
          idleRiders: res.data.idleRiders ?? 0,
          avgDeliveryTime: res.data.avgDeliveryTime ?? 0,
          statusData: res.data.statusData ?? [],
          riderRank: res.data.riderRank ?? [],
          hourChart: {
            hours: res.data.hourChart?.hours ?? [],
            counts: res.data.hourChart?.counts ?? [],
          },
        }
        overviewData.value.riderCount = riderData.value.totalRiders
        break
      case 'finance':
        res = await api.adminStats.finance(days)
        financeData.value = {
          todayIncome: res.data.todayIncome ?? 0,
          todayCommission: res.data.todayCommission ?? 0,
          weekIncome: res.data.weekIncome ?? 0,
          refundAmount: res.data.refundAmount ?? 0,
          incomeChart: {
            dates: res.data.incomeChart?.dates ?? [],
            totalRevenue: res.data.incomeChart?.totalRevenue ?? [],
            commission: res.data.incomeChart?.commission ?? [],
            merchantRevenue: res.data.incomeChart?.merchantRevenue ?? [],
          },
          compareChart: {
            weeks: res.data.compareChart?.weeks ?? [],
            thisWeek: res.data.compareChart?.thisWeek ?? [],
            lastWeek: res.data.compareChart?.lastWeek ?? [],
          },
          refundReasons: res.data.refundReasons ?? [],
        }
        overviewData.value.todayIncome = financeData.value.todayIncome
        break
    }
    // 关键修复：先让图表容器DOM渲染出来，再初始化ECharts
    chartsReady.value = true
    await nextTick()
    // 给布局一点时间，确保容器尺寸正确
    await new Promise(resolve => setTimeout(resolve, 30))
    initAllCharts()
  } catch (e) {
    console.error(`加载${tab}数据失败`, e)
    // 失败时重置为空数据，确保图表能初始化
    if (tab === 'overview') {
      overviewData.value = {
        todayIncome: 0, todayOrderCount: 0, todayMerchantCount: 0, todayRiderCount: 0,
        totalUsers: 0, totalMerchants: 0, totalRiders: 0, totalOrders: 0, totalIncome: 0,
        compareChart: { weeks: [], thisWeek: [], lastWeek: [] },
        refundReasons: [],
      }
    } else if (tab === 'user') {
      userData.value = {
        totalUsers: 0, newUsers: 0, activeUsers: 0, trendChart: { dates: [], newUsers: [], activeUsers: [] },
        userDistribution: [], hourChart: { hours: [], counts: [] },
      }
    } else if (tab === 'merchant') {
      merchantData.value = {
        totalMerchants: 0, activeMerchants: 0, pendingMerchants: 0, disabledMerchants: 0,
        merchantRank: [], categoryData: [], trendChart: { dates: [], newMerchants: [], auditedMerchants: [] },
      }
    } else if (tab === 'rider') {
      riderData.value = {
        totalRiders: 0, onDutyRiders: 0, idleRiders: 0, avgDeliveryTime: 0,
        statusData: [], riderRank: [], hourChart: { hours: [], counts: [] },
      }
    } else if (tab === 'order') {
      orderData.value = {
        todayOrderCount: 0, completedToday: 0, canceledToday: 0, avgOrderAmount: 0,
        statusDistribution: [], timeChart: { dates: [], orders: [], completed: [], canceled: [] },
        hotDishes: [],
      }
    } else if (tab === 'finance') {
      financeData.value = {
        todayIncome: 0, todayOrderCount: 0, weekIncome: 0, monthIncome: 0, totalIncome: 0, refundAmount: 0,
        incomeChart: { dates: [], incomes: [] },
        settlementStats: { pending: 0, settled: 0, pendingAmount: 0, settledAmount: 0 },
      }
    }
    // 失败时也隐藏骨架屏并初始化空图表
    chartsReady.value = true
    await nextTick()
    initAllCharts()
  } finally {
    loading.value = false
  }
}

// Tab切换
function switchTab(key: ObjectType) {
  if (activeTab.value === key) return
  activeTab.value = key
  loadTabData(key)
}

// 日期范围切换
function changeDateRange(range: '7d' | '30d') {
  if (dateRange.value === range) return
  dateRange.value = range
  loadTabData(activeTab.value)
}

// 窗口resize
function handleResize() {
  Object.values(chartInstances).forEach(c => c?.resize())
}

onMounted(() => {
  loadTabData('overview')
  window.addEventListener('resize', handleResize)
})

// 跳转到对应管理页面
function goToPage(path: string) {
  // @ts-ignore
  window.$router?.push(path)
}
</script>

<template>
  <div v-loading="loading" class="admin-dashboard">
    <AppHeader title="管理控制台" subtitle="平台运营数据一览" />

    <!-- ===== 对象切换标签栏（中间位置） ===== -->
    <AppCard shadow="never" class="tab-switcher-card">
      <div class="tab-switcher">
        <div
          v-for="tab in objectTabs"
          :key="tab.key"
          :class="['tab-item', { 'tab-item--active': activeTab === tab.key }]"
          :style="activeTab === tab.key ? { '--active-color': tab.color } : {}"
          @click="switchTab(tab.key)"
        >
          <el-icon :size="18"><component :is="tab.icon" /></el-icon>
          <span>{{ tab.label }}</span>
        </div>
      </div>
    </AppCard>

    <!-- ===== 日期范围切换 ===== -->
    <div class="date-range-bar">
      <div class="range-btns">
        <button :class="['range-btn', { active: dateRange === '7d' }]" @click="changeDateRange('7d')">近7天</button>
        <button :class="['range-btn', { active: dateRange === '30d' }]" @click="changeDateRange('30d')">近30天</button>
      </div>
    </div>

    <!-- ==================== 总览面板 ==================== -->
    <template v-if="activeTab === 'overview'">
      <!-- 核心指标卡片 -->
      <el-row :gutter="16" class="stat-row">
        <el-col v-for="(card, idx) in overviewCards" :key="idx" :xs="24" :sm="12" :md="8" :lg="4">
          <AppCard shadow="hover" class="stat-card">
            <div class="stat-card__content">
              <div class="stat-card__icon" :style="{ backgroundColor: `${card.color}15`, color: card.color }">
                <el-icon :size="28"><component :is="card.icon" /></el-icon>
              </div>
              <div class="stat-card__info">
                <p class="stat-card__title">{{ card.title }}</p>
                <p class="stat-card__value" :style="{ color: card.color }">
                  {{ card.isAmount ? formatMoney(card.value) : formatNumber(card.value) }}
                </p>
                <p class="stat-card__trend">{{ card.trend }}</p>
              </div>
            </div>
          </AppCard>
        </el-col>
      </el-row>

      <!-- 趋势图 -->
      <AppCard title="平台订单/成交额趋势" class="chart-card">
        <div v-if="!chartsReady" class="chart-skeleton chart-skeleton--large">
          <div class="skeleton-bar" style="width: 40%;" />
          <div class="skeleton-chart" />
        </div>
        <div v-else :ref="(el: any) => chartRefs.overview = el" class="chart-area chart-area--large" />
      </AppCard>

      <!-- 待处理 & 公告 -->
      <el-row :gutter="16">
        <el-col :xs="24" :lg="12">
          <AppCard title="待处理事项">
            <div v-if="overviewData.todos.length === 0" class="empty-section">
              <AppEmpty description="暂无待处理事项" />
            </div>
            <ul v-else class="todo-list">
              <li v-for="item in overviewData.todos" :key="item.id" class="todo-item" @click="goToPage('/admin/orders')">
                <span class="todo-item__title">{{ item.title }}</span>
                <el-tag type="danger" effect="plain" round>{{ item.count }} 项</el-tag>
              </li>
            </ul>
          </AppCard>
        </el-col>
        <el-col :xs="24" :lg="12">
          <AppCard title="平台公告">
            <div v-if="overviewData.announcements.length === 0" class="empty-section">
              <AppEmpty description="暂无公告" />
            </div>
            <ul v-else class="announcement-list">
              <li v-for="item in overviewData.announcements" :key="item.id" class="announcement-item">
                <p class="announcement-item__title">{{ item.title }}</p>
                <p class="announcement-item__content">{{ item.content }}</p>
                <p class="announcement-item__time">{{ item.createTime }}</p>
              </li>
            </ul>
          </AppCard>
        </el-col>
      </el-row>
    </template>

    <!-- ==================== 用户分析面板 ==================== -->
    <template v-if="activeTab === 'user'">
      <el-row :gutter="16" class="stat-row">
        <el-col :xs="24" :sm="12" :md="6">
          <AppCard shadow="hover" class="stat-card stat-card--mini">
            <div class="stat-card__content">
              <div class="stat-card__icon" :style="{ backgroundColor: `${COLORS.blue}15`, color: COLORS.blue }">
                <el-icon :size="24"><UserFilled /></el-icon>
              </div>
              <div class="stat-card__info">
                <p class="stat-card__title">总用户数</p>
                <p class="stat-card__value" :style="{ color: COLORS.blue }">{{ formatNumber(userData.totalUsers) }}</p>
              </div>
            </div>
          </AppCard>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <AppCard shadow="hover" class="stat-card stat-card--mini">
            <div class="stat-card__content">
              <div class="stat-card__icon" :style="{ backgroundColor: `${COLORS.green}15`, color: COLORS.green }">
                <el-icon :size="24"><TrendCharts /></el-icon>
              </div>
              <div class="stat-card__info">
                <p class="stat-card__title">日活用户</p>
                <p class="stat-card__value" :style="{ color: COLORS.green }">{{ formatNumber(userData.dailyActive) }}</p>
              </div>
            </div>
          </AppCard>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <AppCard shadow="hover" class="stat-card stat-card--mini">
            <div class="stat-card__content">
              <div class="stat-card__icon" :style="{ backgroundColor: `${COLORS.yellow}15`, color: COLORS.yellow }">
                <el-icon :size="24"><TrendCharts /></el-icon>
              </div>
              <div class="stat-card__info">
                <p class="stat-card__title">新增用户(今日)</p>
                <p class="stat-card__value" :style="{ color: COLORS.yellow }">+{{ formatNumber(userData.todayNew) }}</p>
              </div>
            </div>
          </AppCard>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <AppCard shadow="hover" class="stat-card stat-card--mini">
            <div class="stat-card__content">
              <div class="stat-card__icon" :style="{ backgroundColor: `${COLORS.purple}15`, color: COLORS.purple }">
                <el-icon :size="24"><TrendCharts /></el-icon>
              </div>
              <div class="stat-card__info">
                <p class="stat-card__title">留存率</p>
                <p class="stat-card__value" :style="{ color: COLORS.purple }">{{ formatPercent(userData.retentionRate) }}</p>
              </div>
            </div>
          </AppCard>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :xs="24" :lg="16">
          <AppCard title="用户增长趋势" class="chart-card">
            <div v-if="!chartsReady" class="chart-skeleton">
              <div class="skeleton-bar" style="width: 40%;" />
              <div class="skeleton-chart" />
            </div>
            <div v-else :ref="(el: any) => chartRefs.userGrowth = el" class="chart-area" />
          </AppCard>
        </el-col>
        <el-col :xs="24" :lg="8">
          <AppCard title="用户来源分布" class="chart-card">
            <div v-if="!chartsReady" class="chart-skeleton">
              <div class="skeleton-bar" style="width: 40%;" />
              <div class="skeleton-pie" />
            </div>
            <div v-else :ref="(el: any) => chartRefs.userSource = el" class="chart-area" />
          </AppCard>
        </el-col>
      </el-row>

      <AppCard title="用户活跃度分布" class="chart-card">
        <div v-if="!chartsReady" class="chart-skeleton chart-skeleton--medium">
          <div class="skeleton-bar" style="width: 40%;" />
          <div class="skeleton-chart" />
        </div>
        <div v-else :ref="(el: any) => chartRefs.userActive = el" class="chart-area chart-area--medium" />
      </AppCard>
    </template>

    <!-- ==================== 商家分析面板 ==================== -->
    <template v-if="activeTab === 'merchant'">
      <el-row :gutter="16" class="stat-row">
        <el-col :xs="24" :sm="12" :md="6">
          <AppCard shadow="hover" class="stat-card stat-card--mini">
            <div class="stat-card__content">
              <div class="stat-card__icon" :style="{ backgroundColor: `${COLORS.green}15`, color: COLORS.green }">
                <el-icon :size="24"><Shop /></el-icon>
              </div>
              <div class="stat-card__info">
                <p class="stat-card__title">入驻商家</p>
                <p class="stat-card__value" :style="{ color: COLORS.green }">{{ formatNumber(merchantData.totalMerchants) }}</p>
              </div>
            </div>
          </AppCard>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <AppCard shadow="hover" class="stat-card stat-card--mini">
            <div class="stat-card__content">
              <div class="stat-card__icon" :style="{ backgroundColor: `${COLORS.primary}15`, color: COLORS.primary }">
                <el-icon :size="24"><Shop /></el-icon>
              </div>
              <div class="stat-card__info">
                <p class="stat-card__title">营业中</p>
                <p class="stat-card__value" :style="{ color: COLORS.primary }">{{ formatNumber(merchantData.activeMerchants) }}</p>
              </div>
            </div>
          </AppCard>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <AppCard shadow="hover" class="stat-card stat-card--mini">
            <div class="stat-card__content">
              <div class="stat-card__icon" :style="{ backgroundColor: `${COLORS.yellow}15`, color: COLORS.yellow }">
                <el-icon :size="24"><Warning /></el-icon>
              </div>
              <div class="stat-card__info">
                <p class="stat-card__title">待审核</p>
                <p class="stat-card__value" :style="{ color: COLORS.yellow }">{{ formatNumber(merchantData.pendingMerchants) }}</p>
              </div>
            </div>
          </AppCard>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <AppCard shadow="hover" class="stat-card stat-card--mini">
            <div class="stat-card__content">
              <div class="stat-card__icon" :style="{ backgroundColor: `${COLORS.red}15`, color: COLORS.red }">
                <el-icon :size="24"><Shop /></el-icon>
              </div>
              <div class="stat-card__info">
                <p class="stat-card__title">已下架</p>
                <p class="stat-card__value" :style="{ color: COLORS.red }">{{ formatNumber(merchantData.disabledMerchants) }}</p>
              </div>
            </div>
          </AppCard>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :xs="24" :lg="14">
          <AppCard title="商家销售额TOP10" class="chart-card">
            <div v-if="!chartsReady" class="chart-skeleton chart-skeleton--tall">
              <div class="skeleton-bar" style="width: 40%;" />
              <div class="skeleton-chart" />
            </div>
            <div v-else :ref="(el: any) => chartRefs.merchantRank = el" class="chart-area chart-area--tall" />
          </AppCard>
        </el-col>
        <el-col :xs="24" :lg="10">
          <AppCard title="商家品类分布" class="chart-card">
            <div v-if="!chartsReady" class="chart-skeleton chart-skeleton--tall">
              <div class="skeleton-bar" style="width: 40%;" />
              <div class="skeleton-pie" />
            </div>
            <div v-else :ref="(el: any) => chartRefs.merchantCategory = el" class="chart-area chart-area--tall" />
          </AppCard>
        </el-col>
      </el-row>

      <AppCard title="商家入驻/审核趋势" class="chart-card">
        <div v-if="!chartsReady" class="chart-skeleton">
          <div class="skeleton-bar" style="width: 40%;" />
          <div class="skeleton-chart" />
        </div>
        <div v-else :ref="(el: any) => chartRefs.merchantTrend = el" class="chart-area" />
      </AppCard>
    </template>

    <!-- ==================== 订单分析面板 ==================== -->
    <template v-if="activeTab === 'order'">
      <el-row :gutter="16" class="stat-row">
        <el-col :xs="24" :sm="12" :md="6">
          <AppCard shadow="hover" class="stat-card stat-card--mini">
            <div class="stat-card__content">
              <div class="stat-card__icon" :style="{ backgroundColor: `${COLORS.yellow}15`, color: COLORS.yellow }">
                <el-icon :size="24"><DocumentCopy /></el-icon>
              </div>
              <div class="stat-card__info">
                <p class="stat-card__title">今日订单</p>
                <p class="stat-card__value" :style="{ color: COLORS.yellow }">{{ formatNumber(orderData.todayOrderCount) }}</p>
              </div>
            </div>
          </AppCard>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <AppCard shadow="hover" class="stat-card stat-card--mini">
            <div class="stat-card__content">
              <div class="stat-card__icon" :style="{ backgroundColor: `${COLORS.green}15`, color: COLORS.green }">
                <el-icon :size="24"><DocumentCopy /></el-icon>
              </div>
              <div class="stat-card__info">
                <p class="stat-card__title">完成率</p>
                <p class="stat-card__value" :style="{ color: COLORS.green }">{{ formatPercent(orderData.completionRate) }}</p>
              </div>
            </div>
          </AppCard>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <AppCard shadow="hover" class="stat-card stat-card--mini">
            <div class="stat-card__content">
              <div class="stat-card__icon" :style="{ backgroundColor: `${COLORS.red}15`, color: COLORS.red }">
                <el-icon :size="24"><Warning /></el-icon>
              </div>
              <div class="stat-card__info">
                <p class="stat-card__title">取消率</p>
                <p class="stat-card__value" :style="{ color: COLORS.red }">{{ formatPercent(orderData.cancelRate) }}</p>
              </div>
            </div>
          </AppCard>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <AppCard shadow="hover" class="stat-card stat-card--mini">
            <div class="stat-card__content">
              <div class="stat-card__icon" :style="{ backgroundColor: `${COLORS.purple}15`, color: COLORS.purple }">
                <el-icon :size="24"><Money /></el-icon>
              </div>
              <div class="stat-card__info">
                <p class="stat-card__title">平均客单价</p>
                <p class="stat-card__value" :style="{ color: COLORS.purple }">{{ formatMoney(orderData.avgOrderValue) }}</p>
              </div>
            </div>
          </AppCard>
        </el-col>
      </el-row>

      <AppCard title="订单量趋势分析" class="chart-card">
        <div v-if="!chartsReady" class="chart-skeleton">
          <div class="skeleton-bar" style="width: 40%;" />
          <div class="skeleton-chart" />
        </div>
        <div v-else :ref="(el: any) => chartRefs.orderTrend = el" class="chart-area" />
      </AppCard>

      <el-row :gutter="16">
        <el-col :xs="24" :lg="10">
          <AppCard title="订单状态分布" class="chart-card">
            <div v-if="!chartsReady" class="chart-skeleton">
              <div class="skeleton-bar" style="width: 40%;" />
              <div class="skeleton-pie" />
            </div>
            <div v-else :ref="(el: any) => chartRefs.orderStatus = el" class="chart-area" />
          </AppCard>
        </el-col>
        <el-col :xs="24" :lg="14">
          <AppCard title="24小时订单分布" class="chart-card">
            <div v-if="!chartsReady" class="chart-skeleton">
              <div class="skeleton-bar" style="width: 40%;" />
              <div class="skeleton-chart" />
            </div>
            <div v-else :ref="(el: any) => chartRefs.orderHour = el" class="chart-area" />
          </AppCard>
        </el-col>
      </el-row>

      <AppCard title="热销菜品TOP10" class="chart-card">
        <div v-if="!chartsReady" class="chart-skeleton chart-skeleton--tall">
          <div class="skeleton-bar" style="width: 40%;" />
          <div class="skeleton-chart" />
        </div>
        <div v-else :ref="(el: any) => chartRefs.orderTopDish = el" class="chart-area chart-area--tall" />
      </AppCard>
    </template>

    <!-- ==================== 骑手分析面板 ==================== -->
    <template v-if="activeTab === 'rider'">
      <el-row :gutter="16" class="stat-row">
        <el-col :xs="24" :sm="12" :md="6">
          <AppCard shadow="hover" class="stat-card stat-card--mini">
            <div class="stat-card__content">
              <div class="stat-card__icon" :style="{ backgroundColor: `${COLORS.purple}15`, color: COLORS.purple }">
                <el-icon :size="24"><Bicycle /></el-icon>
              </div>
              <div class="stat-card__info">
                <p class="stat-card__title">注册骑手</p>
                <p class="stat-card__value" :style="{ color: COLORS.purple }">{{ formatNumber(riderData.totalRiders) }}</p>
              </div>
            </div>
          </AppCard>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <AppCard shadow="hover" class="stat-card stat-card--mini">
            <div class="stat-card__content">
              <div class="stat-card__icon" :style="{ backgroundColor: `${COLORS.blue}15`, color: COLORS.blue }">
                <el-icon :size="24"><Bicycle /></el-icon>
              </div>
              <div class="stat-card__info">
                <p class="stat-card__title">配送中</p>
                <p class="stat-card__value" :style="{ color: COLORS.blue }">{{ formatNumber(riderData.onDutyRiders) }}</p>
              </div>
            </div>
          </AppCard>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <AppCard shadow="hover" class="stat-card stat-card--mini">
            <div class="stat-card__content">
              <div class="stat-card__icon" :style="{ backgroundColor: `${COLORS.green}15`, color: COLORS.green }">
                <el-icon :size="24"><Bicycle /></el-icon>
              </div>
              <div class="stat-card__info">
                <p class="stat-card__title">空闲中</p>
                <p class="stat-card__value" :style="{ color: COLORS.green }">{{ formatNumber(riderData.idleRiders) }}</p>
              </div>
            </div>
          </AppCard>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <AppCard shadow="hover" class="stat-card stat-card--mini">
            <div class="stat-card__content">
              <div class="stat-card__icon" :style="{ backgroundColor: `${COLORS.yellow}15`, color: COLORS.yellow }">
                <el-icon :size="24"><TrendCharts /></el-icon>
              </div>
              <div class="stat-card__info">
                <p class="stat-card__title">平均配送时长</p>
                <p class="stat-card__value" :style="{ color: COLORS.yellow }">{{ riderData.avgDeliveryTime }}分钟</p>
              </div>
            </div>
          </AppCard>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :xs="24" :lg="8">
          <AppCard title="骑手状态分布" class="chart-card">
            <div v-if="!chartsReady" class="chart-skeleton">
              <div class="skeleton-bar" style="width: 40%;" />
              <div class="skeleton-pie" />
            </div>
            <div v-else :ref="(el: any) => chartRefs.riderStatus = el" class="chart-area" />
          </AppCard>
        </el-col>
        <el-col :xs="24" :lg="16">
          <AppCard title="骑手绩效排行TOP10" class="chart-card">
            <div v-if="!chartsReady" class="chart-skeleton">
              <div class="skeleton-bar" style="width: 40%;" />
              <div class="skeleton-chart" />
            </div>
            <div v-else :ref="(el: any) => chartRefs.riderEfficiency = el" class="chart-area" />
          </AppCard>
        </el-col>
      </el-row>

      <AppCard title="24小时配送时段分布" class="chart-card">
        <div v-if="!chartsReady" class="chart-skeleton">
          <div class="skeleton-bar" style="width: 40%;" />
          <div class="skeleton-chart" />
        </div>
        <div v-else :ref="(el: any) => chartRefs.riderHour = el" class="chart-area" />
      </AppCard>
    </template>

    <!-- ==================== 财务分析面板 ==================== -->
    <template v-if="activeTab === 'finance'">
      <el-row :gutter="16" class="stat-row">
        <el-col :xs="24" :sm="12" :md="6">
          <AppCard shadow="hover" class="stat-card stat-card--mini">
            <div class="stat-card__content">
              <div class="stat-card__icon" :style="{ backgroundColor: `${COLORS.red}15`, color: COLORS.red }">
                <el-icon :size="24"><Money /></el-icon>
              </div>
              <div class="stat-card__info">
                <p class="stat-card__title">今日成交额</p>
                <p class="stat-card__value" :style="{ color: COLORS.red }">{{ formatMoney(financeData.todayIncome) }}</p>
              </div>
            </div>
          </AppCard>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <AppCard shadow="hover" class="stat-card stat-card--mini">
            <div class="stat-card__content">
              <div class="stat-card__icon" :style="{ backgroundColor: `${COLORS.primary}15`, color: COLORS.primary }">
                <el-icon :size="24"><Coin /></el-icon>
              </div>
              <div class="stat-card__info">
                <p class="stat-card__title">今日佣金收入</p>
                <p class="stat-card__value" :style="{ color: COLORS.primary }">{{ formatMoney(financeData.todayCommission) }}</p>
              </div>
            </div>
          </AppCard>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <AppCard shadow="hover" class="stat-card stat-card--mini">
            <div class="stat-card__content">
              <div class="stat-card__icon" :style="{ backgroundColor: `${COLORS.green}15`, color: COLORS.green }">
                <el-icon :size="24"><Coin /></el-icon>
              </div>
              <div class="stat-card__info">
                <p class="stat-card__title">本周收入</p>
                <p class="stat-card__value" :style="{ color: COLORS.green }">{{ formatMoney(financeData.weekIncome) }}</p>
              </div>
            </div>
          </AppCard>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <AppCard shadow="hover" class="stat-card stat-card--mini">
            <div class="stat-card__content">
              <div class="stat-card__icon" :style="{ backgroundColor: `${COLORS.yellow}15`, color: COLORS.yellow }">
                <el-icon :size="24"><Warning /></el-icon>
              </div>
              <div class="stat-card__info">
                <p class="stat-card__title">退款金额</p>
                <p class="stat-card__value" :style="{ color: COLORS.yellow }">{{ formatMoney(financeData.refundAmount) }}</p>
              </div>
            </div>
          </AppCard>
        </el-col>
      </el-row>

      <AppCard title="收入趋势分析" class="chart-card">
        <div v-if="!chartsReady" class="chart-skeleton">
          <div class="skeleton-bar" style="width: 40%;" />
          <div class="skeleton-chart" />
        </div>
        <div v-else :ref="(el: any) => chartRefs.financeIncome = el" class="chart-area" />
      </AppCard>

      <el-row :gutter="16">
        <el-col :xs="24" :lg="12">
          <AppCard title="周度数据对比" class="chart-card">
            <div v-if="!chartsReady" class="chart-skeleton">
              <div class="skeleton-bar" style="width: 40%;" />
              <div class="skeleton-chart" />
            </div>
            <div v-else :ref="(el: any) => chartRefs.financeCompare = el" class="chart-area" />
          </AppCard>
        </el-col>
        <el-col :xs="24" :lg="12">
          <AppCard title="退款原因分析" class="chart-card">
            <div v-if="!chartsReady" class="chart-skeleton">
              <div class="skeleton-bar" style="width: 40%;" />
              <div class="skeleton-pie" />
            </div>
            <div v-else :ref="(el: any) => chartRefs.financeRefund = el" class="chart-area" />
          </AppCard>
        </el-col>
      </el-row>
    </template>
  </div>
</template>

<style scoped lang="scss">
.admin-dashboard {
  padding-bottom: $spacing-md;
}

// ===== 标签切换器 =====
.tab-switcher-card {
  margin-bottom: $spacing-md;
  padding: 0 !important;
  :deep(.el-card__body) {
    padding: 0;
  }
}

.tab-switcher {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px;
  overflow-x: auto;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  border-radius: $radius-md;
  font-size: $font-size-md;
  color: $text-light;
  cursor: pointer;
  transition: all 0.25s ease;
  white-space: nowrap;
  font-weight: 500;
  border: 2px solid transparent;

  &:hover {
    background: #f5f5f5;
    color: $text;
  }

  &--active {
    color: var(--active-color, $primary);
    background: color-mix(in srgb, var(--active-color, $primary) 12%, transparent);
    border-color: var(--active-color, $primary);
    font-weight: 600;
  }
}

// 日期范围
.date-range-bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: $spacing-md;
}

.range-btns {
  display: flex;
  background: $card;
  border-radius: $radius-md;
  padding: 3px;
  box-shadow: $shadow;
}

.range-btn {
  padding: 6px 16px;
  border: none;
  background: transparent;
  border-radius: $radius-sm;
  font-size: $font-size-sm;
  color: $text-light;
  cursor: pointer;
  transition: all 0.2s;

  &.active {
    background: $primary;
    color: #fff;
    font-weight: 600;
  }
}

// ===== 统计卡片 =====
.stat-row {
  margin-bottom: $spacing-md;
}

.stat-card {
  margin-bottom: $spacing-md;

  &--mini {
    .stat-card__icon {
      width: 44px;
      height: 44px;
    }
    .stat-card__value {
      font-size: 18px !important;
    }
  }

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
    flex-shrink: 0;
  }

  &__title {
    font-size: $font-size-sm;
    color: $text-muted;
    margin-bottom: 2px;
  }

  &__value {
    font-size: 22px;
    font-weight: 700;
    line-height: 1.2;
  }

  &__trend {
    font-size: $font-size-xs;
    color: $text-muted;
    margin-top: 2px;
  }
}

// ===== 图表区域 =====
.chart-card {
  margin-bottom: $spacing-md;
  position: relative;
}

.chart-area {
  width: 100%;
  height: 320px;

  &--large { height: 380px; }
  &--medium { height: 280px; }
  &--tall { height: 400px; }
}

// 骨架屏
.chart-skeleton {
  width: 100%;
  padding: 20px 10px;
  display: flex;
  flex-direction: column;
  gap: 16px;

  &--large { height: 380px; }
  &--medium { height: 280px; }
  &--tall { height: 400px; }
  &:not(&--large):not(&--medium):not(&--tall) { height: 320px; }
}

.skeleton-bar {
  height: 16px;
  border-radius: 4px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
}

.skeleton-chart {
  flex: 1;
  border-radius: 8px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 60%;
    background: linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.5) 100%);
    border-radius: 0 0 8px 8px;
  }
}

.skeleton-row {
  display: flex;
  gap: 12px;
  height: 100%;
}

.skeleton-pie {
  flex: 1;
  border-radius: $radius-round;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  max-width: 280px;
  margin: 0 auto;
  aspect-ratio: 1;
}

.skeleton-bars {
  flex: 1;
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 0 10px;
}

.skeleton-bar-item {
  flex: 1;
  border-radius: 4px 4px 0 0;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
}

@keyframes skeleton-loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

// ===== 待处理/公告列表 =====
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
    cursor: pointer;
    transition: background-color $transition-fast;

    &:last-child { border-bottom: none; }
    &:hover { background-color: #fff9f9; border-radius: $radius-md; }

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

    &:last-child { border-bottom: none; }

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
