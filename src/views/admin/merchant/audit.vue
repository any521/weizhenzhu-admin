<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '@/api'
import AppCard from '@/components/AppCard.vue'
import AppHeader from '@/components/AppHeader.vue'
import AppTable from '@/components/AppTable.vue'
import { mapStatus, maskPhone } from '@/utils/format'
import { AuditStatusMap, AuditStatus } from '@/utils/constants'
import type { Merchant } from '@/api/types'

const loading = ref(false)
const tableData = ref<Merchant[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const rejectVisible = ref(false)
const rejectReason = ref('')
const currentRow = ref<Merchant | null>(null)

// 加载待审核商家列表
async function loadList() {
  loading.value = true
  try {
    const res = await api.merchant.getList({ page: page.value, pageSize: pageSize.value })
    // 仅展示待审核数据做演示
    const pending = res.data.list.filter((item) => item.auditStatus === AuditStatus.PENDING)
    tableData.value = pending.length ? pending : res.data.list
    total.value = res.data.total
  } finally {
    loading.value = false
  }
}

// 通过
async function handleApprove(row: Merchant) {
  try {
    await ElMessageBox.confirm('确定通过该商家的入驻申请吗？', '审核确认', { type: 'warning' })
    await api.merchant.audit(row.id, AuditStatus.APPROVED)
    row.auditStatus = AuditStatus.APPROVED
    ElMessage.success('审核通过')
  } catch {
    // 取消
  }
}

// 拒绝弹窗
function handleReject(row: Merchant) {
  currentRow.value = row
  rejectReason.value = ''
  rejectVisible.value = true
}

// 确认拒绝
async function confirmReject() {
  if (!rejectReason.value.trim()) {
    ElMessage.warning('请输入拒绝原因')
    return
  }
  if (!currentRow.value) return
  await api.merchant.audit(currentRow.value.id, AuditStatus.REJECTED, rejectReason.value)
  currentRow.value.auditStatus = AuditStatus.REJECTED
  rejectVisible.value = false
  ElMessage.success('已拒绝')
}

onMounted(loadList)
</script>

<template>
  <div class="merchant-audit">
    <AppHeader title="商家入驻审核" subtitle="审核商家入驻资质" />

    <AppCard>
      <AppTable
        v-model:page="page"
        v-model:page-size="pageSize"
        :data="tableData"
        :loading="loading"
        :total="total"
        @page-change="loadList"
        @size-change="loadList"
      >
        <el-table-column prop="id" label="商家ID" width="90" />
        <el-table-column prop="name" label="商家名称" min-width="150">
          <template #default="{ row }">{{ row.name || '未命名' }}</template>
        </el-table-column>
        <el-table-column prop="contactPerson" label="负责人" min-width="120" />
        <el-table-column prop="phone" label="联系电话" min-width="130">
          <template #default="{ row }">{{ maskPhone(row.phone) }}</template>
        </el-table-column>
        <el-table-column prop="address" label="地址" min-width="180" show-overflow-tooltip />
        <el-table-column prop="qualification" label="资质信息" min-width="240" show-overflow-tooltip>
          <template #default="{ row }">{{ row.qualification || '-' }}</template>
        </el-table-column>
        <el-table-column prop="auditStatus" label="审核状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.auditStatus === AuditStatus.APPROVED ? 'success' : row.auditStatus === AuditStatus.REJECTED ? 'danger' : 'warning'">
              {{ mapStatus(row.auditStatus, AuditStatusMap) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="success" @click="handleApprove(row)">通过</el-button>
            <el-button link type="danger" @click="handleReject(row)">拒绝</el-button>
          </template>
        </el-table-column>
      </AppTable>
    </AppCard>

    <!-- 拒绝原因弹窗 -->
    <el-dialog v-model="rejectVisible" title="拒绝原因" width="460px">
      <el-input
        v-model="rejectReason"
        type="textarea"
        :rows="4"
        placeholder="请输入拒绝原因"
        maxlength="200"
        show-word-limit
      />
      <template #footer>
        <el-button @click="rejectVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmReject">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.merchant-audit {
  // 页面样式
}
</style>
