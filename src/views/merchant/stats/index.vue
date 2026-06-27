<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import * as echarts from 'echarts'
import { Document, Money, Bell, User, TrendCharts, ShoppingCart, Coin, Timer } from '@element-plus/icons-vue'
import { api } from '@/api'
import { formatAmount, formatNumber } from '@/utils/format'

// 主题色
const THEME_COLOR = '#FF6B35'
const THEME_COLOR_LIGHT = '#FF9A6C'
const COLORS = ['#FF6B35', '#FFB347', '#06D6A0', '#118AB2', '#073B4C', '#EF476F', '#9B5DE5', '#F15BB5']

// 时间范围
const timeRange = ref<7 | 30>(7)

// 加载状态
const loading = ref(false)

// 图表 DOM 引用
const orderTrendRef = ref<HTMLDivElement | null>(null)
const salesTrendRef = ref<HTMLDivElement | null>(null)
const topDishChartRef = ref<HTMLDivElement | null>(null)
const orderStatusRef = ref<HTMLDivElement | null>(null)
const hourDistRef = ref<HTMLDivElement | null>(null)
const categorySalesRef = ref<HTMLDivElement | null>(null)
const avgOrderValueRef = ref<HTMLDivElement | null>(null)

// 图表实例
let orderTrendChart: echarts.ECharts | null = null
let salesTrendChart: echarts.ECharts | null = null
let topDishChart: echarts.ECharts | null = null
let orderStatusChart: echarts.ECharts | null = null
let hourDistChart: echarts.ECharts | null = null
let categorySalesChart: echarts.ECharts | null = null
let avgOrderValueChart: echarts.ECharts | null = null

// 概览数据
const overview = ref({
  todayOrderCount: 0,
  todaySales: 0,
  pendingOrderCount: 0,
  weekOrderCount: 0,
  weekSales: 0,
  monthOrderCount: 0,
  monthSales: 0,
  totalOrders: 0,
  totalSales: 0,
  avgOrderValue: 0,
  completionRate: 0,
})

// 趋势数据
const trendData = ref({
  dates: [] as string[],
  orders: [] as number[],
  sales: [] as number[],
  newUsers: [] as number[],
})

// 热销菜品
const topDishes = ref<{ name: string; value: number; sales?: number }[]>([])

// 订单状态分布
const orderStatus = ref<{ name: string; value: number }[]>([])

// 时段分布数据
const hourDistribution = ref<{ hour: string; orders: number }[]>([])

// 分类销售数据
const categorySales = ref<{ name: string; value: number }[]>([])

// 客单价趋势
const avgOrderTrend = ref({
  dates: [] as string[],
  values: [] as number[],
})

// 生成日期数组
function generateDates(days: number): string[] {
  const dates: string[] = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    dates.push(`${d.getMonth() + 1}/${d.getDate()}`)
  }
  return dates
}

// 生成模拟数据（后端无数据时使用）
function generateMockData() {
  const days = timeRange.value
  trendData.value.dates = generateDates(days)
  trendData.value.orders = Array.from({ length: days }, (_, i) => {
    const base = 30 + Math.floor(Math.random() * 50)
    const weekend = (new Date().getDay() - (days - 1 - i) + 7) % 7
    return weekend === 0 || weekend === 6 ? base + 20 : base
  })
  trendData.value.sales = trendData.value.orders.map(o => Math.floor(o * (25 + Math.random() * 20)))
  trendData.value.newUsers = Array.from({ length: days }, () => Math.floor(Math.random() * 20) + 5)

  topDishes.value = [
    { name: '招牌红烧肉', value: 328, sales: 9840 },
    { name: '宫保鸡丁', value: 286, sales: 7436 },
    { name: '麻婆豆腐', value: 254, sales: 5080 },
    { name: '鱼香肉丝', value: 221, sales: 5304 },
    { name: '水煮鱼', value: 198, sales: 11880 },
    { name: '回锅肉', value: 176, sales: 4928 },
    { name: '糖醋里脊', value: 152, sales: 4256 },
    { name: '酸菜鱼', value: 134, sales: 6700 },
    { name: '干锅花菜', value: 112, sales: 2688 },
    { name: '地三鲜', value: 98, sales: 1960 },
  ]

  orderStatus.value = [
    { name: '已完成', value: 1256 },
    { name: '配送中', value: 45 },
    { name: '待接单', value: 34 },
    { name: '已取消', value: 52 },
    { name: '退款单', value: 12 },
  ]

  // 时段分布（模拟：午餐11-13点，晚餐17-20点高峰）
  const hours = []
  for (let h = 0; h < 24; h++) {
    let orders = 0
    if (h >= 11 && h <= 13) orders = 30 + Math.floor(Math.random() * 30)
    else if (h >= 17 && h <= 20) orders = 40 + Math.floor(Math.random() * 40)
    else if (h >= 9 && h <= 10) orders = 5 + Math.floor(Math.random() * 10)
    else if (h >= 14 && h <= 16) orders = 8 + Math.floor(Math.random() * 12)
    else if (h >= 21 && h <= 22) orders = 10 + Math.floor(Math.random() * 15)
    else orders = Math.floor(Math.random() * 5)
    hours.push({ hour: `${h}:00`, orders })
  }
  hourDistribution.value = hours

  categorySales.value = [
    { name: '热菜', value: 15680 },
    { name: '凉菜', value: 4520 },
    { name: '主食', value: 6890 },
    { name: '汤类', value: 3240 },
    { name: '饮品', value: 2180 },
    { name: '甜品', value: 1560 },
  ]

  avgOrderTrend.value.dates = generateDates(days)
  avgOrderTrend.value.values = Array.from({ length: days }, () => 28 + Math.random() * 15)

  // 概览数据
  const todayOrders = trendData.value.orders[trendData.value.orders.length - 1] || 50
  const todaySales = trendData.value.sales[trendData.value.sales.length - 1] || 1500
  const weekOrders = trendData.value.orders.reduce((a, b) => a + b, 0)
  const weekSales = trendData.value.sales.reduce((a, b) => a + b, 0)
  overview.value = {
    todayOrderCount: todayOrders,
    todaySales: todaySales,
    pendingOrderCount: 34,
    weekOrderCount: weekOrders,
    weekSales: weekSales,
    monthOrderCount: weekOrders * 4 + Math.floor(Math.random() * 200),
    monthSales: weekSales * 4 + Math.floor(Math.random() * 5000),
    totalOrders: 1443,
    totalSales: 45680,
    avgOrderValue: todayOrders > 0 ? Math.round(todaySales / todayOrders * 100) / 100 : 35,
    completionRate: 95.6,
  }
}

// 初始化图表
function initCharts() {
  if (orderTrendRef.value) orderTrendChart = echarts.init(orderTrendRef.value)
  if (salesTrendRef.value) salesTrendChart = echarts.init(salesTrendRef.value)
  if (topDishChartRef.value) topDishChart = echarts.init(topDishChartRef.value)
  if (orderStatusRef.value) orderStatusChart = echarts.init(orderStatusRef.value)
  if (hourDistRef.value) hourDistChart = echarts.init(hourDistRef.value)
  if (categorySalesRef.value) categorySalesChart = echarts.init(categorySalesRef.value)
  if (avgOrderValueRef.value) avgOrderValueChart = echarts.init(avgOrderValueRef.value)
}

// 通用样式
const commonAxisStyle = {
  axisLine: { lineStyle: { color: '#E8E8E8' } },
  axisLabel: { color: '#999', fontSize: 11 },
}
const commonSplitLine = { lineStyle: { color: '#F5F5F5' } }

// 更新订单趋势图
function updateOrderTrendChart() {
  if (!orderTrendChart) return
  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.98)',
      borderColor: 'rgba(255,107,53,0.2)',
      borderWidth: 1,
      textStyle: { color: '#333', fontSize: 12 },
      formatter: (params: any) => {
        const p = params[0]
        return `<div style="font-weight:600;margin-bottom:4px">${p.axisValue}</div>
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${THEME_COLOR};margin-right:6px;"></span>订单量: <b style="color:${THEME_COLOR}">${p.value}</b> 单`
      },
    },
    grid: { left: '3%', right: '4%', bottom: '8%', top: '10%', containLabel: true },
    xAxis: { type: 'category', data: trendData.value.dates, ...commonAxisStyle, axisTick: { show: false } },
    yAxis: { type: 'value', axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#999' }, splitLine: commonSplitLine },
    series: [
      {
        name: '订单量',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        data: trendData.value.orders,
        itemStyle: { color: THEME_COLOR, borderWidth: 2, borderColor: '#fff' },
        lineStyle: { width: 3, color: THEME_COLOR },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(255, 107, 53, 0.35)' },
            { offset: 1, color: 'rgba(255, 107, 53, 0.02)' },
          ]),
        },
      },
    ],
  }
  orderTrendChart.setOption(option, true)
}

// 更新销售额趋势图（包含订单量对比）
function updateSalesTrendChart() {
  if (!salesTrendChart) return
  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.98)',
      borderColor: 'rgba(255,179,71,0.2)',
      borderWidth: 1,
      textStyle: { color: '#333', fontSize: 12 },
      axisPointer: { type: 'cross', crossStyle: { color: '#999' } },
    },
    legend: {
      data: ['销售额', '订单量'],
      right: 10,
      top: 0,
      textStyle: { color: '#666', fontSize: 11 },
    },
    grid: { left: '3%', right: '4%', bottom: '8%', top: '15%', containLabel: true },
    xAxis: { type: 'category', data: trendData.value.dates, ...commonAxisStyle, axisTick: { show: false } },
    yAxis: [
      {
        type: 'value',
        name: '销售额(元)',
        nameTextStyle: { color: '#999', fontSize: 10 },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#999', formatter: (v: number) => `¥${v}` },
        splitLine: commonSplitLine,
      },
      {
        type: 'value',
        name: '订单量',
        nameTextStyle: { color: '#999', fontSize: 10 },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#999' },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '销售额',
        type: 'bar',
        barWidth: '40%',
        data: trendData.value.sales,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#FFB347' },
            { offset: 1, color: '#FFCC80' },
          ]),
          borderRadius: [4, 4, 0, 0],
        },
      },
      {
        name: '订单量',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        data: trendData.value.orders,
        itemStyle: { color: THEME_COLOR },
        lineStyle: { width: 2, color: THEME_COLOR, type: 'dashed' },
      },
    ],
  }
  salesTrendChart.setOption(option, true)
}

// 更新热销菜品TOP10
function updateTopDishChart() {
  if (!topDishChart) return
  const names = topDishes.value.map((item) => item.name).reverse()
  const values = topDishes.value.map((item) => item.value).reverse()
  const salesValues = topDishes.value.map((item) => item.sales || item.value * 28).reverse()
  const maxVal = Math.max(...values)
  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(255,255,255,0.98)',
      borderColor: 'rgba(255,107,53,0.2)',
      borderWidth: 1,
      textStyle: { color: '#333', fontSize: 12 },
      formatter: (params: any) => {
        const p = params[0]
        const saleIdx = params.findIndex((x: any) => x.seriesName === '销售额')
        const saleVal = saleIdx >= 0 ? params[saleIdx].value : 0
        return `<div style="font-weight:600;margin-bottom:4px">${p.name}</div>
                <div>销量: <b style="color:${THEME_COLOR}">${p.value}</b> 份</div>
                <div>销售额: <b style="color:#FFB347">¥${saleVal}</b></div>`
      },
    },
    grid: { left: '3%', right: '10%', bottom: '5%', top: '5%', containLabel: true },
    xAxis: { type: 'value', axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#999' }, splitLine: commonSplitLine },
    yAxis: { type: 'category', data: names, ...commonAxisStyle, axisTick: { show: false } },
    series: [
      {
        name: '销量',
        type: 'bar',
        data: values,
        barWidth: '50%',
        itemStyle: {
          color: (params: any) => {
            const ratio = params.value / maxVal
            if (ratio > 0.8) return new echarts.graphic.LinearGradient(1, 0, 0, 0, [
              { offset: 0, color: '#FF6B35' },
              { offset: 1, color: '#FF9A6C' },
            ])
            return new echarts.graphic.LinearGradient(1, 0, 0, 0, [
              { offset: 0, color: '#FFB347' },
              { offset: 1, color: '#FFD180' },
            ])
          },
          borderRadius: [0, 6, 6, 0],
        },
        label: {
          show: true,
          position: 'right',
          color: '#666',
          fontSize: 11,
          formatter: '{c}份',
        },
      },
    ],
  }
  topDishChart.setOption(option, true)
}

// 更新订单状态饼图
function updateOrderStatusChart() {
  if (!orderStatusChart) return
  const total = orderStatus.value.reduce((sum, item) => sum + item.value, 0)
  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255,255,255,0.98)',
      borderColor: '#eee',
      borderWidth: 1,
      textStyle: { color: '#333', fontSize: 12 },
      formatter: (params: any) => `${params.name}: ${params.value} 单 (${params.percent}%)`,
    },
    legend: {
      bottom: 0,
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: '#666', fontSize: 11 },
      itemGap: 12,
    },
    color: COLORS,
    series: [
      {
        type: 'pie',
        radius: ['42%', '68%'],
        center: ['50%', '42%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        label: {
          show: true,
          position: 'center',
          formatter: () => `{total|${total}}\n{label|总订单}`,
          rich: {
            total: { fontSize: 24, fontWeight: 'bold', color: THEME_COLOR, lineHeight: 30 },
            label: { fontSize: 12, color: '#999', lineHeight: 20 },
          },
        },
        emphasis: {
          scale: true,
          scaleSize: 8,
          itemStyle: { shadowBlur: 15, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.15)' },
        },
        labelLine: { show: false },
        data: orderStatus.value,
      },
    ],
  }
  orderStatusChart.setOption(option, true)
}

// 更新时段分布图
function updateHourDistChart() {
  if (!hourDistChart) return
  const hours = hourDistribution.value.map(h => h.hour)
  const orders = hourDistribution.value.map(h => h.orders)
  const maxOrders = Math.max(...orders)
  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.98)',
      borderColor: 'rgba(6,214,160,0.2)',
      borderWidth: 1,
      textStyle: { color: '#333', fontSize: 12 },
      formatter: (params: any) => {
        const p = params[0]
        return `${p.axisValue}<br/>订单量: <b style="color:#06D6A0">${p.value}</b> 单`
      },
    },
    grid: { left: '3%', right: '4%', bottom: '10%', top: '8%', containLabel: true },
    xAxis: {
      type: 'category',
      data: hours,
      ...commonAxisStyle,
      axisTick: { show: false },
      axisLabel: { color: '#999', fontSize: 10, interval: 2 },
    },
    yAxis: { type: 'value', axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#999' }, splitLine: commonSplitLine },
    series: [
      {
        name: '订单量',
        type: 'bar',
        data: orders.map((val, idx) => ({
          value: val,
          itemStyle: {
            color: val > maxOrders * 0.6
              ? new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: '#06D6A0' },
                  { offset: 1, color: '#80ED99' },
                ])
              : new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: '#B7B7B7' },
                  { offset: 1, color: '#D9D9D9' },
                ]),
            borderRadius: [3, 3, 0, 0],
          },
        })),
        barWidth: '60%',
        markArea: {
          silent: true,
          itemStyle: { color: 'rgba(255, 107, 53, 0.06)' },
          data: [
            [{ xAxis: '11:00' }, { xAxis: '13:00' }],
            [{ xAxis: '17:00' }, { xAxis: '20:00' }],
          ],
        },
      },
    ],
  }
  hourDistChart.setOption(option, true)
}

// 更新分类销售占比
function updateCategorySalesChart() {
  if (!categorySalesChart) return
  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255,255,255,0.98)',
      borderColor: '#eee',
      borderWidth: 1,
      textStyle: { color: '#333', fontSize: 12 },
      formatter: '{b}: ¥{c} ({d}%)',
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center',
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: '#666', fontSize: 11 },
      itemGap: 10,
    },
    color: COLORS,
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
        label: {
          show: true,
          formatter: '{d}%',
          fontSize: 11,
          color: '#666',
        },
        emphasis: {
          scale: true,
          scaleSize: 6,
          label: { fontSize: 14, fontWeight: 'bold' },
        },
        labelLine: { length: 8, length2: 8 },
        data: categorySales.value,
      },
    ],
  }
  categorySalesChart.setOption(option, true)
}

// 更新客单价趋势
function updateAvgOrderValueChart() {
  if (!avgOrderValueChart) return
  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.98)',
      borderColor: 'rgba(155,93,229,0.2)',
      borderWidth: 1,
      textStyle: { color: '#333', fontSize: 12 },
      formatter: (params: any) => {
        const p = params[0]
        return `${p.axisValue}<br/>客单价: <b style="color:#9B5DE5">¥${p.value.toFixed(2)}</b>`
      },
    },
    grid: { left: '3%', right: '4%', bottom: '8%', top: '10%', containLabel: true },
    xAxis: { type: 'category', data: avgOrderTrend.value.dates, ...commonAxisStyle, axisTick: { show: false } },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#999', formatter: (v: number) => `¥${v}` },
      splitLine: commonSplitLine,
    },
    series: [
      {
        name: '客单价',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        data: avgOrderTrend.value.values,
        itemStyle: { color: '#9B5DE5', borderWidth: 2, borderColor: '#fff' },
        lineStyle: { width: 2, color: '#9B5DE5' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(155, 93, 229, 0.25)' },
            { offset: 1, color: 'rgba(155, 93, 229, 0.02)' },
          ]),
        },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: '#9B5DE5', type: 'dashed', width: 1 },
          data: [{ type: 'average', name: '平均客单价' }],
          label: { formatter: '均值 ¥{c}', fontSize: 10 },
        },
      },
    ],
  }
  avgOrderValueChart.setOption(option, true)
}

// 刷新所有图表
function refreshCharts() {
  updateOrderTrendChart()
  updateSalesTrendChart()
  updateTopDishChart()
  updateOrderStatusChart()
  updateHourDistChart()
  updateCategorySalesChart()
  updateAvgOrderValueChart()
}

// 切换时间范围
function handleRangeChange(range: 7 | 30) {
  timeRange.value = range
  generateMockData()
  refreshCharts()
}

// 获取统计数据
async function fetchStatsData() {
  loading.value = true
  try {
    // 并行请求三个接口
    const [financeRes, chartRes, dashRes, topDishRes, hourlyRes] = await Promise.all([
      api.finance.getStats().catch(() => null),
      api.finance.getChartData().catch(() => null),
      api.stats.getDashboard().catch(() => null),
      api.stats.getTopDishes().catch(() => null),
      api.stats.getHourlyDistribution().catch(() => null),
    ])

    // 使用后端数据覆盖
    if (financeRes?.data) {
      const f = financeRes.data as any
      overview.value.todayOrderCount = Number(f.todayOrderCount) || 0
      overview.value.todaySales = Number(f.todayIncome) || 0
      overview.value.weekSales = Number(f.weekIncome) || 0
      overview.value.monthSales = Number(f.monthIncome) || 0
      overview.value.totalSales = Number(f.totalIncome) || 0
      // 客单价 = 总营业额 / 总订单数
      if (overview.value.totalOrders > 0) {
        overview.value.avgOrderValue = overview.value.totalSales / overview.value.totalOrders
      }
    }

    if (dashRes?.data) {
      const d = dashRes.data as any
      overview.value.pendingOrderCount = Number(d.pendingOrders) || 0
      overview.value.totalOrders = Number(d.totalOrders) || overview.value.totalOrders
      overview.value.weekOrderCount = Number(d.weekOrders) || 0
      overview.value.monthOrderCount = Number(d.monthOrders) || 0
      // 如果finance没返回数据，用dashboard的
      if (!financeRes?.data) {
        overview.value.todayOrderCount = Number(d.todayOrders) || 0
        overview.value.todaySales = Number(d.todayRevenue) || Number(d.todayIncome) || 0
        overview.value.weekSales = Number(d.weekSales) || Number(d.weekRevenue) || 0
        overview.value.monthSales = Number(d.monthSales) || 0
      }
      // 重新计算客单价
      if (overview.value.totalOrders > 0 && overview.value.totalSales > 0) {
        overview.value.avgOrderValue = Math.round((overview.value.totalSales / overview.value.totalOrders) * 100) / 100
      }
    }

    if (chartRes?.data?.dates && chartRes.data.values) {
      const days = chartRes.data.dates.length
      trendData.value.dates = chartRes.data.dates.map((d: string) => {
        const date = new Date(d)
        return `${date.getMonth() + 1}/${date.getDate()}`
      })
      trendData.value.sales = chartRes.data.values.map((v: any) => Number(v) || 0)
      // 订单量需要后端返回，暂时用估算（客单价30元）
      trendData.value.orders = chartRes.data.values.map((v: any) => Math.max(1, Math.round(Number(v) / 30)))
      timeRange.value = days === 7 ? 7 : 30
    } else {
      generateMockData()
    }

    // 热销菜品
    if (topDishRes?.data && Array.isArray(topDishRes.data)) {
      topDishes.value = topDishRes.data.map((item: any) => ({
        name: item.name || '未知菜品',
        value: Number(item.value) || Number(item.sales) || 0,
        sales: Number(item.sales) || Number(item.value) || 0,
      }))
    }

    // 时段分布
    if (hourlyRes?.data?.hours && hourlyRes.data.values) {
      hourDistribution.value = hourlyRes.data.hours.map((h: string, i: number) => ({
        hour: h,
        orders: Number(hourlyRes.data.values[i]) || 0,
      }))
    }

    // 订单状态分布（从dashboard或默认值）
    if (overview.value.todayOrderCount > 0 || overview.value.pendingOrderCount > 0) {
      orderStatus.value = [
        { name: '待处理', value: overview.value.pendingOrderCount },
        { name: '已完成', value: Math.max(0, overview.value.todayOrderCount - overview.value.pendingOrderCount) },
        { name: '已取消', value: 0 },
      ].filter(s => s.value > 0)
    }

    // 分类销售（暂无接口，保留模拟）
    if (categorySales.value.length === 0) {
      categorySales.value = [
        { name: '主食', value: Math.round(overview.value.todaySales * 0.4) || 100 },
        { name: '小吃', value: Math.round(overview.value.todaySales * 0.25) || 60 },
        { name: '饮料', value: Math.round(overview.value.todaySales * 0.2) || 50 },
        { name: '甜点', value: Math.round(overview.value.todaySales * 0.15) || 40 },
      ]
    }

    // 完成率（默认95%或根据实际计算）
    overview.value.completionRate = overview.value.totalOrders > 0 ? 95 : 0

    refreshCharts()
  } finally {
    loading.value = false
  }
}

// 窗口大小变化时重绘
function handleResize() {
  orderTrendChart?.resize()
  salesTrendChart?.resize()
  topDishChart?.resize()
  orderStatusChart?.resize()
  hourDistChart?.resize()
  categorySalesChart?.resize()
  avgOrderValueChart?.resize()
}

onMounted(() => {
  initCharts()
  fetchStatsData()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  orderTrendChart?.dispose()
  salesTrendChart?.dispose()
  topDishChart?.dispose()
  orderStatusChart?.dispose()
  hourDistChart?.dispose()
  categorySalesChart?.dispose()
  avgOrderValueChart?.dispose()
})
</script>

<template>
  <div v-loading="loading" class="merchant-stats">
    <app-header title="数据统计" subtitle="店铺经营数据全面分析" />

    <!-- 顶部概览卡片 -->
    <div class="overview-row">
      <app-card class="overview-card" :body-style="{ padding: '20px' }">
        <div class="overview-card__content">
          <div class="overview-card__info">
            <p class="overview-card__label">今日订单</p>
            <p class="overview-card__value" :style="{ color: THEME_COLOR }">
              {{ formatNumber(overview.todayOrderCount) }}
              <span class="suffix">单</span>
            </p>
            <p class="overview-card__sub">本周 {{ formatNumber(overview.weekOrderCount) }} 单</p>
          </div>
          <div class="overview-card__icon" :style="{ backgroundColor: 'rgba(255,107,53,0.12)', color: THEME_COLOR }">
            <el-icon :size="24"><ShoppingCart /></el-icon>
          </div>
        </div>
      </app-card>

      <app-card class="overview-card" :body-style="{ padding: '20px' }">
        <div class="overview-card__content">
          <div class="overview-card__info">
            <p class="overview-card__label">今日销售额</p>
            <p class="overview-card__value" style="color: #FFB347">
              {{ formatAmount(overview.todaySales) }}
            </p>
            <p class="overview-card__sub">本周 {{ formatAmount(overview.weekSales) }}</p>
          </div>
          <div class="overview-card__icon" style="background-color: rgba(255,179,71,0.12); color: #FFB347">
            <el-icon :size="24"><Money /></el-icon>
          </div>
        </div>
      </app-card>

      <app-card class="overview-card" :body-style="{ padding: '20px' }">
        <div class="overview-card__content">
          <div class="overview-card__info">
            <p class="overview-card__label">待处理订单</p>
            <p class="overview-card__value" style="color: #EF476F">
              {{ formatNumber(overview.pendingOrderCount) }}
              <span class="suffix">单</span>
            </p>
            <p class="overview-card__sub sub-warn">需及时处理</p>
          </div>
          <div class="overview-card__icon" style="background-color: rgba(239,71,111,0.12); color: #EF476F">
            <el-icon :size="24"><Bell /></el-icon>
          </div>
        </div>
      </app-card>

      <app-card class="overview-card" :body-style="{ padding: '20px' }">
        <div class="overview-card__content">
          <div class="overview-card__info">
            <p class="overview-card__label">平均客单价</p>
            <p class="overview-card__value" style="color: #9B5DE5">
              ¥{{ overview.avgOrderValue.toFixed(2) }}
            </p>
            <p class="overview-card__sub">完成率 {{ overview.completionRate }}%</p>
          </div>
          <div class="overview-card__icon" style="background-color: rgba(155,93,229,0.12); color: #9B5DE5">
            <el-icon :size="24"><Coin /></el-icon>
          </div>
        </div>
      </app-card>
    </div>

    <!-- 第二行概览 -->
    <div class="overview-row overview-row--secondary">
      <app-card class="overview-card overview-card--compact" :body-style="{ padding: '16px 20px' }">
        <div class="compact-stat">
          <div class="compact-stat__icon" style="background: rgba(6,214,160,0.1); color: #06D6A0">
            <el-icon :size="18"><TrendCharts /></el-icon>
          </div>
          <div class="compact-stat__info">
            <p class="compact-stat__label">本月订单</p>
            <p class="compact-stat__value">{{ formatNumber(overview.monthOrderCount) }} <span class="unit">单</span></p>
          </div>
        </div>
      </app-card>
      <app-card class="overview-card overview-card--compact" :body-style="{ padding: '16px 20px' }">
        <div class="compact-stat">
          <div class="compact-stat__icon" style="background: rgba(17,138,178,0.1); color: #118AB2">
            <el-icon :size="18"><Money /></el-icon>
          </div>
          <div class="compact-stat__info">
            <p class="compact-stat__label">本月销售额</p>
            <p class="compact-stat__value">{{ formatAmount(overview.monthSales) }}</p>
          </div>
        </div>
      </app-card>
      <app-card class="overview-card overview-card--compact" :body-style="{ padding: '16px 20px' }">
        <div class="compact-stat">
          <div class="compact-stat__icon" style="background: rgba(255,107,53,0.1); color: #FF6B35">
            <el-icon :size="18"><Document /></el-icon>
          </div>
          <div class="compact-stat__info">
            <p class="compact-stat__label">累计订单</p>
            <p class="compact-stat__value">{{ formatNumber(overview.totalOrders) }} <span class="unit">单</span></p>
          </div>
        </div>
      </app-card>
      <app-card class="overview-card overview-card--compact" :body-style="{ padding: '16px 20px' }">
        <div class="compact-stat">
          <div class="compact-stat__icon" style="background: rgba(7,59,76,0.1); color: #073B4C">
            <el-icon :size="18"><Timer /></el-icon>
          </div>
          <div class="compact-stat__info">
            <p class="compact-stat__label">累计收入</p>
            <p class="compact-stat__value">{{ formatAmount(overview.totalSales) }}</p>
          </div>
        </div>
      </app-card>
    </div>

    <!-- 时间范围切换 + 趋势图 -->
    <div class="charts-grid">
      <app-card class="chart-card chart-card--full">
        <template #header>
          <div class="chart-header">
            <span class="chart-title">📈 订单量趋势分析</span>
            <div class="range-tabs">
              <span
                class="range-tab"
                :class="{ 'range-tab--active': timeRange === 7 }"
                @click="handleRangeChange(7)"
              >近7天</span>
              <span
                class="range-tab"
                :class="{ 'range-tab--active': timeRange === 30 }"
                @click="handleRangeChange(30)"
              >近30天</span>
            </div>
          </div>
        </template>
        <div ref="orderTrendRef" class="chart chart--tall" />
      </app-card>

      <app-card class="chart-card chart-card--full">
        <template #header>
          <span class="chart-title">💰 销售额与订单量对比</span>
        </template>
        <div ref="salesTrendRef" class="chart chart--tall" />
      </app-card>

      <app-card class="chart-card chart-card--half">
        <template #header>
          <span class="chart-title">🏆 热销菜品 TOP10</span>
        </template>
        <div ref="topDishChartRef" class="chart" />
      </app-card>

      <app-card class="chart-card chart-card--half">
        <template #header>
          <span class="chart-title">📊 订单状态分布</span>
        </template>
        <div ref="orderStatusRef" class="chart" />
      </app-card>

      <app-card class="chart-card chart-card--full">
        <template #header>
          <span class="chart-title">⏰ 营业时段订单分布 <span class="chart-subtitle">（阴影区域为高峰时段）</span></span>
        </template>
        <div ref="hourDistRef" class="chart chart--medium" />
      </app-card>

      <app-card class="chart-card chart-card--half">
        <template #header>
          <span class="chart-title">🍽️ 品类销售占比</span>
        </template>
        <div ref="categorySalesRef" class="chart" />
      </app-card>

      <app-card class="chart-card chart-card--half">
        <template #header>
          <span class="chart-title">💎 客单价趋势</span>
        </template>
        <div ref="avgOrderValueRef" class="chart" />
      </app-card>
    </div>
  </div>
</template>

<style scoped lang="scss">
.merchant-stats {
  padding-bottom: $spacing-lg;

  .overview-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: $spacing-md;
    margin-bottom: $spacing-md;

    &--secondary {
      margin-bottom: $spacing-md;
    }

    @media screen and (max-width: 1200px) {
      grid-template-columns: repeat(2, 1fr);
    }

    @media screen and (max-width: 576px) {
      grid-template-columns: 1fr;
    }
  }

  .overview-card {
    margin-bottom: 0;
    border-radius: $radius-lg;
    transition: transform 0.2s, box-shadow 0.2s;

    &:hover {
      transform: translateY(-2px);
      box-shadow: $shadow-lg;
    }

    &--compact {
      .compact-stat {
        display: flex;
        align-items: center;
        gap: $spacing-md;
      }
      .compact-stat__icon {
        width: 40px;
        height: 40px;
        border-radius: $radius-md;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .compact-stat__label {
        font-size: $font-size-sm;
        color: $text-muted;
        margin-bottom: 2px;
      }
      .compact-stat__value {
        font-size: 20px;
        font-weight: 700;
        color: $text;
        .unit {
          font-size: $font-size-sm;
          font-weight: 400;
          color: $text-light;
        }
      }
    }

    &__content {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    &__info {
      flex: 1;
    }

    &__label {
      font-size: $font-size-sm;
      color: $text-muted;
      margin-bottom: $spacing-xs;
    }

    &__value {
      font-size: 26px;
      font-weight: 700;
      line-height: 1.2;
      margin-bottom: 4px;

      .suffix {
        font-size: $font-size-md;
        font-weight: 400;
        margin-left: 2px;
        color: $text-light;
      }
    }

    &__sub {
      font-size: 11px;
      color: $text-muted;
      &.sub-warn {
        color: #EF476F;
      }
    }

    &__icon {
      width: 48px;
      height: 48px;
      border-radius: $radius-md;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
  }

  .charts-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: $spacing-md;

    @media screen and (max-width: 992px) {
      grid-template-columns: 1fr;
    }
  }

  .chart-card {
    margin-bottom: 0;
    border-radius: $radius-lg;

    &--full {
      grid-column: 1 / -1;
    }
  }

  .chart-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .chart-title {
    font-size: $font-size-md;
    font-weight: 600;
    color: $text;
  }

  .chart-subtitle {
    font-size: $font-size-sm;
    font-weight: 400;
    color: $text-muted;
    margin-left: 6px;
  }

  .range-tabs {
    display: flex;
    background-color: $bg;
    border-radius: $radius-sm;
    padding: 2px;
  }

  .range-tab {
    padding: 4px 14px;
    font-size: $font-size-sm;
    color: $text-muted;
    border-radius: $radius-sm;
    cursor: pointer;
    transition: all 0.2s;

    &--active {
      background-color: #FF6B35;
      color: #fff;
      font-weight: 500;
      box-shadow: 0 2px 6px rgba(255, 107, 53, 0.3);
    }

    &:not(.range-tab--active):hover {
      color: #FF6B35;
    }
  }

  .chart {
    width: 100%;
    height: 300px;

    &--tall {
      height: 320px;
    }

    &--medium {
      height: 260px;
    }
  }
}
</style>
