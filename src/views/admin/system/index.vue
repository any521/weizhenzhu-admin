<script setup lang="ts">
import { reactive, ref, computed, onMounted } from 'vue'
import { Plus, Delete, Edit, RefreshRight } from '@element-plus/icons-vue'
import { api } from '@/api'
import AppCard from '@/components/AppCard.vue'
import AppHeader from '@/components/AppHeader.vue'
import type { SystemSettings, CustomConfigItem } from '@/api/types'
import type { FormInstance, FormRules } from 'element-plus'

// ============ 系统设置（平台信息 / 财务 / 协议） ============
const loading = ref(false)
const saving = ref(false)
const formRef = ref<FormInstance>()
const activeTab = ref('basic')

const form = reactive<SystemSettings>({
  siteName: '',
  servicePhone: '',
  logo: '',
  icp: '',
  commissionRate: 0,
  minDeliveryFee: 0,
  riderShareRate: 0,
  userAgreement: '',
  privacyPolicy: '',
})

const rules = computed<FormRules>(() => ({
  siteName: [{ required: true, message: '请输入平台名称', trigger: 'blur' }],
  servicePhone: [{ required: true, message: '请输入客服电话', trigger: 'blur' }],
  commissionRate: [{ required: true, message: '请输入佣金比例', trigger: 'blur' }],
  minDeliveryFee: [{ required: true, message: '请输入最低配送费', trigger: 'blur' }],
  riderShareRate: [{ required: true, message: '请输入骑手分成比例', trigger: 'blur' }],
}))

async function loadSettings() {
  loading.value = true
  try {
    const res = await api.system.getSettings()
    if (res.data) {
      Object.assign(form, res.data)
    }
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    await api.system.saveSettings(form)
    ElMessage.success('保存成功')
  } catch (e) {
    // request 已统一处理错误提示
  } finally {
    saving.value = false
  }
}

// ============ 自定义配置项管理（后端持久化） ============
const configItems = ref<CustomConfigItem[]>([])
const configLoading = ref(false)
const configSaving = ref(false)
const configSearchKey = ref('')
const configSearchCategory = ref('')

// 配置分类
const configCategories = computed(() => {
  const set = new Set<string>(['基础', '财务', '运营', '安全', '其他'])
  configItems.value.forEach((item) => {
    if (item.category) set.add(item.category)
  })
  return Array.from(set)
})

// 过滤后的配置项（前端二次过滤，后端也支持参数过滤）
const filteredConfigItems = computed(() => {
  return configItems.value.filter((item) => {
    const matchKey =
      !configSearchKey.value ||
      item.key.toLowerCase().includes(configSearchKey.value.toLowerCase()) ||
      item.label.toLowerCase().includes(configSearchKey.value.toLowerCase())
    const matchCategory = !configSearchCategory.value || item.category === configSearchCategory.value
    return matchKey && matchCategory
  })
})

// 加载配置项列表
async function loadConfigItems() {
  configLoading.value = true
  try {
    const res = await api.system.listCustomConfig()
    configItems.value = res.data || []
  } catch (e) {
    // ignore
  } finally {
    configLoading.value = false
  }
}

// 配置项编辑弹窗
const configVisible = ref(false)
const configFormRef = ref<FormInstance>()
const configForm = reactive<CustomConfigItem>({
  key: '',
  label: '',
  value: '',
  category: '基础',
  remark: '',
})
const isEditConfig = ref(false)
const editingKey = ref('')

const configRules: FormRules = {
  key: [
    { required: true, message: '请输入配置键', trigger: 'blur' },
    { pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/, message: '只能包含字母、数字和下划线，且以字母开头', trigger: 'blur' },
  ],
  label: [{ required: true, message: '请输入配置名称', trigger: 'blur' }],
  value: [{ required: true, message: '请输入配置值', trigger: 'blur' }],
  category: [{ required: true, message: '请选择配置分类', trigger: 'change' }],
}

function handleAddConfig() {
  isEditConfig.value = false
  editingKey.value = ''
  Object.assign(configForm, {
    key: '',
    label: '',
    value: '',
    category: '基础',
    remark: '',
  })
  configVisible.value = true
}

function handleEditConfig(row: CustomConfigItem) {
  isEditConfig.value = true
  editingKey.value = row.key
  Object.assign(configForm, {
    key: row.key,
    label: row.label,
    value: row.value,
    category: row.category,
    remark: row.remark || '',
  })
  configVisible.value = true
}

async function handleSaveConfig() {
  const valid = await configFormRef.value?.validate().catch(() => false)
  if (!valid) return

  configSaving.value = true
  try {
    if (isEditConfig.value) {
      await api.system.updateCustomConfig(editingKey.value, configForm)
      ElMessage.success('更新成功')
    } else {
      // 新增前前端二次校验 key 唯一性（后端也会校验）
      const duplicate = configItems.value.find((item) => item.key === configForm.key)
      if (duplicate) {
        ElMessage.error('配置键已存在')
        configSaving.value = false
        return
      }
      await api.system.addCustomConfig(configForm)
      ElMessage.success('添加成功')
    }
    configVisible.value = false
    await loadConfigItems()
  } catch (e) {
    // ignore
  } finally {
    configSaving.value = false
  }
}

async function handleDeleteConfig(row: CustomConfigItem) {
  try {
    await ElMessageBox.confirm(`确定要删除配置项「${row.label}」吗？`, '提示', {
      type: 'warning',
      confirmButtonText: '确认',
      cancelButtonText: '取消',
    })
    await api.system.deleteCustomConfig(row.key)
    ElMessage.success('删除成功')
    await loadConfigItems()
  } catch {
    // 取消或失败
  }
}

// 重置搜索
function handleResetConfigSearch() {
  configSearchKey.value = ''
  configSearchCategory.value = ''
}

onMounted(() => {
  loadSettings()
  loadConfigItems()
})
</script>

<template>
  <div class="admin-system">
    <AppHeader title="系统设置" subtitle="配置平台基础参数与自定义配置项" />

    <el-tabs v-model="activeTab" class="system-tabs">
      <!-- 平台信息（原"基础设置"） -->
      <el-tab-pane label="平台信息" name="basic">
        <AppCard v-loading="loading">
          <el-form ref="formRef" :model="form" :rules="rules" label-width="140px" class="settings-form">
            <el-form-item label="平台名称" prop="siteName">
              <el-input v-model="form.siteName" placeholder="请输入平台名称" maxlength="30" show-word-limit />
            </el-form-item>
            <el-form-item label="客服电话" prop="servicePhone">
              <el-input v-model="form.servicePhone" placeholder="如 400-000-0000" />
            </el-form-item>
            <el-form-item label="平台LOGO" prop="logo">
              <el-input v-model="form.logo" placeholder="LOGO图片URL（可选）" />
            </el-form-item>
            <el-form-item label="ICP备案号" prop="icp">
              <el-input v-model="form.icp" placeholder="如 京ICP备XXXXXXXX号（可选）" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="saving" @click="handleSave">保存设置</el-button>
              <el-button @click="loadSettings">重置</el-button>
            </el-form-item>
          </el-form>
        </AppCard>
      </el-tab-pane>

      <!-- 财务设置 -->
      <el-tab-pane label="财务设置" name="finance">
        <AppCard v-loading="loading">
          <el-form ref="formRef" :model="form" :rules="rules" label-width="140px" class="settings-form">
            <el-form-item label="平台佣金比例" prop="commissionRate">
              <el-input-number v-model="form.commissionRate" :min="0" :max="100" :precision="2" :step="1" />
              <span class="form-unit">%</span>
              <span class="form-hint">商家每笔订单需向平台支付的佣金比例</span>
            </el-form-item>
            <el-form-item label="最低配送费" prop="minDeliveryFee">
              <el-input-number v-model="form.minDeliveryFee" :min="0" :step="1" :precision="2" />
              <span class="form-unit">元</span>
              <span class="form-hint">用户支付的最低配送费用</span>
            </el-form-item>
            <el-form-item label="骑手分成比例" prop="riderShareRate">
              <el-input-number v-model="form.riderShareRate" :min="0" :max="100" :precision="2" :step="1" />
              <span class="form-unit">%</span>
              <span class="form-hint">每单配送费中骑手所得比例</span>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="saving" @click="handleSave">保存设置</el-button>
              <el-button @click="loadSettings">重置</el-button>
            </el-form-item>
          </el-form>
        </AppCard>
      </el-tab-pane>

      <!-- 协议管理 -->
      <el-tab-pane label="协议管理" name="agreement">
        <AppCard v-loading="loading">
          <el-form ref="formRef" :model="form" :rules="rules" label-width="140px" class="settings-form">
            <el-form-item label="用户协议" prop="userAgreement">
              <el-input
                v-model="form.userAgreement"
                type="textarea"
                :rows="10"
                placeholder="请输入用户协议内容"
                maxlength="5000"
                show-word-limit
              />
            </el-form-item>
            <el-form-item label="隐私政策" prop="privacyPolicy">
              <el-input
                v-model="form.privacyPolicy"
                type="textarea"
                :rows="10"
                placeholder="请输入隐私政策内容"
                maxlength="5000"
                show-word-limit
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="saving" @click="handleSave">保存设置</el-button>
              <el-button @click="loadSettings">重置</el-button>
            </el-form-item>
          </el-form>
        </AppCard>
      </el-tab-pane>

      <!-- 自定义配置项 -->
      <el-tab-pane :label="`自定义配置 (${configItems.length})`" name="custom">
        <!-- 搜索区域 -->
        <AppCard class="search-card">
          <el-form inline>
            <el-form-item label="配置键/名称">
              <el-input v-model="configSearchKey" placeholder="请输入配置键或名称" clearable />
            </el-form-item>
            <el-form-item label="分类">
              <el-select v-model="configSearchCategory" placeholder="全部分类" clearable style="width: 140px">
                <el-option
                  v-for="cat in configCategories"
                  :key="cat"
                  :label="cat"
                  :value="cat"
                />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button :icon="RefreshRight" @click="handleResetConfigSearch">重置</el-button>
              <el-button type="primary" :icon="Plus" @click="handleAddConfig">新增配置</el-button>
            </el-form-item>
          </el-form>
        </AppCard>

        <!-- 配置项列表 -->
        <AppCard v-loading="configLoading">
          <el-table :data="filteredConfigItems" stripe border>
            <el-table-column prop="key" label="配置键" min-width="160" />
            <el-table-column prop="label" label="配置名称" min-width="140" />
            <el-table-column prop="value" label="配置值" min-width="180" show-overflow-tooltip />
            <el-table-column prop="category" label="分类" width="100">
              <template #default="{ row }">
                <el-tag size="small">{{ row.category }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip />
            <el-table-column prop="updatedAt" label="更新时间" min-width="170" />
            <el-table-column label="操作" width="160" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" :icon="Edit" @click="handleEditConfig(row)">编辑</el-button>
                <el-button link type="danger" :icon="Delete" @click="handleDeleteConfig(row)">删除</el-button>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无自定义配置项" />
            </template>
          </el-table>
        </AppCard>
      </el-tab-pane>
    </el-tabs>

    <!-- 配置项编辑弹窗 -->
    <el-dialog v-model="configVisible" :title="isEditConfig ? '编辑配置项' : '新增配置项'" width="520px">
      <el-form ref="configFormRef" :model="configForm" :rules="configRules" label-width="100px">
        <el-form-item label="配置键" prop="key">
          <el-input
            v-model="configForm.key"
            placeholder="如：app_notice_switch"
            :disabled="isEditConfig"
          />
        </el-form-item>
        <el-form-item label="配置名称" prop="label">
          <el-input v-model="configForm.label" placeholder="如：APP公告开关" />
        </el-form-item>
        <el-form-item label="配置值" prop="value">
          <el-input v-model="configForm.value" type="textarea" :rows="3" placeholder="请输入配置值" />
        </el-form-item>
        <el-form-item label="分类" prop="category">
          <el-select v-model="configForm.category" placeholder="请选择分类" allow-create filterable style="width: 100%">
            <el-option
              v-for="cat in configCategories"
              :key="cat"
              :label="cat"
              :value="cat"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="configForm.remark" type="textarea" :rows="2" placeholder="请输入备注说明" maxlength="200" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="configVisible = false">取消</el-button>
        <el-button type="primary" :loading="configSaving" @click="handleSaveConfig">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.admin-system {
  .system-tabs {
    :deep(.el-tabs__header) {
      margin-bottom: $spacing-md;
    }
  }

  .search-card {
    margin-bottom: $spacing-md;
  }

  .settings-form {
    padding: $spacing-md 0;
    max-width: 800px;

    .form-unit {
      margin-left: $spacing-sm;
      color: $text-muted;
    }

    .form-hint {
      display: block;
      margin-top: 4px;
      color: $text-muted;
      font-size: 12px;
      line-height: 1.4;
    }
  }
}
</style>
