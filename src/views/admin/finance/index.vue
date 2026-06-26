<script setup lang="ts">
import { reactive, ref, onMounted, nextTick, computed, onBeforeUnmount } from 'vue'
import { Search, RefreshRight, Download, Star } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import { api } from '@/api'
import AppCard from '@/components/AppCard.vue'
import AppHeader from '@/components/AppHeader.vue'
import AppTable, { type TableColumn } from '@/components/AppTable.vue'
import { formatAmount, formatNumber, formatDate } from '@/utils/format'
import { exportToExcel, exportToCsv, type ExportColumn } from '@/utils/export'
import { downloadBlob } from '@/utils/download'
import { useSavedQueries, type SavedQuery } from '@/composables/useSavedQueries'
import type { FinanceStats, FinanceReport } from '@/api/types'

const loading = ref(false)
const exporting = ref(false)
const stats = ref<FinanceStats>({
  todayIncome: 0,
  todayOrderCount: 0,
  weekIncome: 0,
  monthIncome: 0,
  totalIncome: 0,
  refundAmount: 0,
})
const reportList = ref<FinanceReport[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const chartRef = ref<HTMLDivElement>()
let chartInstance: echarts.ECharts | null = null
const chartType = ref(1) // 1=7天 2=14天 3=30天

// 搜索表单
interface SearchForm {
  dateRange: string[]
}

const searchForm = reactive<SearchForm>({
  dateRange: [],
})

// 查询条件保存
const { savedQueries, saveQuery, deleteQuery, applyQuery } = useSavedQueries('admin_finance')

// 保存查询弹窗
const saveQueryVisible = ref(false)
const saveQueryName = ref('')

// 列定义
const columns: TableColumn[] = [
  { prop: 'date', label: '日期', minWidth: 140, sortable: true },
  { prop: 'orderCount', label: '订单数', minWidth: 120, sortable: true },
  { prop: 'income', label: '流水', minWidth: 140, sortable: true },
  { prop: 'commission', label: '抽成', minWidth: 140, sortable: true },
  { prop: 'settlement', label: '结算', minWidth: 140, sortable: true },
]

// 汇总卡片数据
const summaryCards = computed(() => [
  { title: '今日收入', value: stats.value.todayIncome, color: '#FF4B33' },
  { title: '本周收入', value: stats.value.weekIncome, color: '#FF9800' },
  { title: '本月收入', value: stats.value.monthIncome, color: '#00C853' },
  { title: '平台总流水', value: stats.value.totalIncome, color: '#2196F3' },
  { title: '今日订单', value: stats.value.todayOrderCount, color: '#9C27B0' },
  { title: '退款总额', value: stats.value.refundAmount, color: '#E53935' },
])

// 汇总数值（底部表格总计）
const summary = computed(() => {
  return reportList.value.reduce(
    (acc, item) => {
      acc.orderCount += item.orderCount
      acc.income += item.income
      acc.commission += item.commission
      acc.settlement += item.settlement
      return acc
    },
    { orderCount: 0, income: 0, commission: 0, settlement: 0 }
  )
})

// 构造查询参数
function buildQueryParams() {
  return {
    page: page.value,
    pageSize: pageSize.value,
    startDate: searchForm.dateRange?.[0],
    endDate: searchForm.dateRange?.[1],
  }
}

function initChart(chartData?: { dates?: string[]; series?: { name: string; data: number[] }[] }) {
  if (!chartRef.value) return
  if (chartInstance) {
    chartInstance.dispose()
  }
  chartInstance = echarts.init(chartRef.value)
  const dates = chartData?.dates || []
  const seriesData = chartData?.series || []
  const colors = ['#FF4B33', '#FF9800', '#00C853']
  const option: echarts.EChartsOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['流水', '抽成', '结算'], bottom: 0 },
    grid: { left: '3%', right: '4%', bottom: '12%', top: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      data: dates.length > 0 ? dates : ['暂无数据'],
      axisLine: { lineStyle: { color: '#E8E8E8' } },
      axisLabel: { color: '#666' },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#666' },
      splitLine: { lineStyle: { color: '#F0F0F0' } },
    },
    series: seriesData.length > 0 ? seriesData.map((s, i) => ({
      name: s.name,
      type: 'line',
      data: s.data,
      smooth: true,
      itemStyle: { color: colors[i] || '#FF4B33' },
      lineStyle: { width: i === 0 ? 3 : 2 },
    })) : [
      { name: '流水', type: 'line', data: [], smooth: true, itemStyle: { color: '#FF4B33' }, lineStyle: { width: 3 } },
      { name: '抽成', type: 'line', data: [], smooth: true, itemStyle: { color: '#FF9800' } },
      { name: '结算', type: 'line', data: [], smooth: true, itemStyle: { color: '#00C853' } },
    ],
    graphic: dates.length === 0 ? [{
      type: 'text',
      left: 'center',
      top: 'middle',
      style: { text: '暂无数据', fill: '#999', fontSize: 14 }
    }] : undefined,
  }
  chartInstance.setOption(option)
}

function handleResize() {
  chartInstance?.resize()
}

async function loadChartData() {
  try {
    const chartRes = await api.finance.getChartData(chartType.value)
    await nextTick()
    initChart(chartRes.data)
  } catch (e) {
    console.error('加载图表数据失败', e)
    initChart()
  }
}

async function loadData() {
  loading.value = true
  try {
    const [statsRes, reportRes] = await Promise.all([
      api.finance.getStats(),
      api.finance.getReport(buildQueryParams()),
    ])
    stats.value = statsRes.data
    reportList.value = reportRes.data.list || []
    total.value = reportRes.data.total || 0
    loadChartData()
  } catch (e: any) {
    console.error('加载财务数据失败', e)
    ElMessage.error(e?.message || '加载财务数据失败')
    stats.value = { todayIncome: 0, todayOrderCount: 0, weekIncome: 0, monthIncome: 0, totalIncome: 0, refundAmount: 0 }
    reportList.value = []
    total.value = 0
    await nextTick()
    initChart() // 即使失败也初始化空图表
  } finally {
    loading.value = false
  }
}

function switchChartType(type: number) {
  chartType.value = type
  loadChartData()
}

// 搜索
function handleSearch() {
  page.value = 1
  loadData()
}

// 重置
function handleReset() {
  searchForm.dateRange = []
  handleSearch()
}

// 排序变化（前端排序，因为报表数据通常不大）
function handleSortChange({ prop, order }: { prop: string; order: 'ascending' | 'descending' | null }) {
  if (!order) {
    loadData()
    return
  }
  const sorted = [...reportList.value].sort((a, b) => {
    const va = (a as any)[prop]
    const vb = (b as any)[prop]
    if (typeof va === 'number' && typeof vb === 'number') {
      return order === 'ascending' ? va - vb : vb - va
    }
    return order === 'ascending'
      ? String(va).localeCompare(String(vb))
      : String(vb).localeCompare(String(va))
  })
  reportList.value = sorted
}

// 导出
const exportColumns: ExportColumn[] = [
  { prop: 'date', label: '日期' },
  { prop: 'orderCount', label: '订单数', formatter: (_row, v) => formatNumber(v) },
  { prop: 'income', label: '流水', formatter: (_row, v) => formatAmount(v) },
  { prop: 'commission', label: '抽成', formatter: (_row, v) => formatAmount(v) },
  { prop: 'settlement', label: '结算', formatter: (_row, v) => formatAmount(v) },
]

async function handleExport(format: 'xlsx' | 'csv') {
  exporting.value = true
  try {
    // 优先调用后端导出接口
    try {
      const blob = await api.finance.export({ ...buildQueryParams(), format })
      downloadBlob(blob, `财务报表.${format}`, format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv;charset=utf-8;')
      ElMessage.success('导出成功')
      return
    } catch {
      // 后端不支持时降级为前端导出
    }
    const filename = `财务报表_${formatDate(new Date(), 'YYYYMMDD_HHmmss')}`
    if (format === 'xlsx') {
      exportToExcel(exportColumns, reportList.value, filename)
    } else {
      exportToCsv(exportColumns, reportList.value, filename)
    }
    ElMessage.success('导出成功')
  } finally {
    exporting.value = false
  }
}

// 查询条件保存
function openSaveQuery() {
  if (!searchForm.dateRange || searchForm.dateRange.length === 0) {
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

onMounted(() => {
  loadData()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  chartInstance?.dispose()
  chartInstance = null
})
</script>

<template>
  <div v-loading="loading" class="admin-finance">
    <AppHeader title="财务管理" subtitle="平台财务数据与结算">
      <el-dropdown @command="handleExport">
        <el-button :icon="Download" :loading="exporting">导出报表</el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="xlsx">导出 Excel</el-dropdown-item>
            <el-dropdown-item command="csv">导出 CSV</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </AppHeader>

    <!-- 汇总卡片 -->
    <el-row :gutter="16" class="summary-row">
      <el-col v-for="card in summaryCards" :key="card.title" :xs="24" :sm="12" :lg="4">
        <AppCard shadow="hover" class="summary-card">
          <p class="summary-card__title">{{ card.title }}</p>
          <p class="summary-card__value" :style="{ color: card.color }">
            {{ card.title.includes('订单') ? formatNumber(card.value) : formatAmount(card.value) }}
          </p>
        </AppCard>
      </el-col>
    </el-row>

    <!-- 搜索区域 -->
    <AppCard class="search-card">
      <el-form :model="searchForm" inline>
        <el-form-item label="日期范围">
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

    <!-- 趋势图 -->
    <AppCard title="财务趋势" class="chart-card">
      <template #extra>
        <el-radio-group v-model="chartType" size="small" @change="switchChartType">
          <el-radio-button :value="1">近7天</el-radio-button>
          <el-radio-button :value="2">近14天</el-radio-button>
          <el-radio-button :value="3">近30天</el-radio-button>
        </el-radio-group>
      </template>
      <div ref="chartRef" class="finance-chart" />
    </AppCard>

    <!-- 财务报表 -->
    <AppCard title="财务报表">
      <AppTable
        v-model:page="page"
        v-model:page-size="pageSize"
        :data="reportList"
        :loading="loading"
        :total="total"
        :columns="columns"
        @page-change="loadData"
        @size-change="loadData"
        @sort-change="handleSortChange"
      >
        <template #cell-orderCount="{ row }">
          {{ formatNumber(row.orderCount) }}
        </template>

        <template #cell-income="{ row }">
          <span class="amount">{{ formatAmount(row.income) }}</span>
        </template>

        <template #cell-commission="{ row }">
          {{ formatAmount(row.commission) }}
        </template>

        <template #cell-settlement="{ row }">
          {{ formatAmount(row.settlement) }}
        </template>
      </AppTable>
      <div v-if="reportList.length > 0" class="summary-bar">
        <span class="summary-bar__label">合计：</span>
        <span>订单数 {{ formatNumber(summary.orderCount) }}</span>
        <span>流水 {{ formatAmount(summary.income) }}</span>
        <span>抽成 {{ formatAmount(summary.commission) }}</span>
        <span>结算 {{ formatAmount(summary.settlement) }}</span>
      </div>
    </AppCard>

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
.admin-finance {
  .summary-row {
    margin-bottom: $spacing-md;
  }

  .summary-card {
    text-align: center;
    margin-bottom: $spacing-md;

    &__title {
      font-size: $font-size-sm;
      color: $text-muted;
      margin-bottom: $spacing-sm;
    }

    &__value {
      font-size: 24px;
      font-weight: 700;
    }
  }

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

  .chart-card {
    .finance-chart {
      width: 100%;
      height: 320px;
    }
  }

  .summary-bar {
    display: flex;
    align-items: center;
    gap: $spacing-lg;
    padding: $spacing-md;
    margin-top: $spacing-md;
    background-color: #fff5f5;
    border-radius: $radius-md;
    font-size: $font-size-md;
    color: $text;

    &__label {
      font-weight: 600;
    }
  }

  .amount {
    color: $primary;
    font-weight: 600;
  }
}
</style>
