<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { api } from '@/api'
import type { Merchant } from '@/api/types'

// 加载状态
const loading = ref(false)
const submitLoading = ref(false)

// 店铺设置表单
const form = reactive({
  name: '',
  address: '',
  phone: '',
  openTime: '',
  description: '',
  deliveryRadius: 3000,
  notice: '',
  minOrderAmount: 0,
  deliveryFee: 0,
  packingFee: 0,
  isOpen: 1,
})

// 表单引用
const formRef = ref<InstanceType<typeof ElForm>>()

// 表单校验规则
const rules = {
  name: [{ required: true, message: '请输入店铺名称', trigger: 'blur' }],
  address: [{ required: true, message: '请输入店铺地址', trigger: 'blur' }],
  phone: [{ required: true, message: '请输入联系电话', trigger: 'blur' }],
  openTime: [{ required: true, message: '请输入营业时间', trigger: 'blur' }],
}

// 获取店铺设置
async function fetchSettings() {
  loading.value = true
  try {
    const res = await api.merchantSettings.get()
    const data = res.data
    form.name = data.name || ''
    form.address = [data.province, data.city, data.district, data.address].filter(Boolean).join(' ') || data.address || ''
    form.phone = data.phone || ''
    form.openTime = data.openTime || '09:00 - 22:00'
    form.description = data.description || ''
    form.deliveryRadius = data.deliveryRadius || 3000
    form.notice = data.notice || ''
    form.minOrderAmount = Number(data.minOrderAmount) || 0
    form.deliveryFee = Number(data.deliveryFee) || 0
    form.packingFee = Number(data.packingFee) || 0
    form.isOpen = data.isOpen ?? 1
  } finally {
    loading.value = false
  }
}

// 保存店铺设置
async function handleSave() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitLoading.value = true
  try {
    const payload: Partial<Merchant> = {
      name: form.name,
      address: form.address,
      phone: form.phone,
      openTime: form.openTime,
      description: form.description,
      notice: form.notice,
      deliveryRadius: Number(form.deliveryRadius),
      minOrderAmount: Number(form.minOrderAmount),
      deliveryFee: Number(form.deliveryFee),
      packingFee: Number(form.packingFee),
      isOpen: Number(form.isOpen),
    }
    await api.merchantSettings.save(payload)
    ElMessage.success('保存成功')
  } finally {
    submitLoading.value = false
  }
}

onMounted(() => {
  fetchSettings()
})
</script>

<template>
  <div v-loading="loading" class="merchant-settings">
    <app-header title="店铺设置">
      <template #right>
        <el-button type="primary" :loading="submitLoading" @click="handleSave">保存设置</el-button>
      </template>
    </app-header>

    <app-card>
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="100px"
        style="max-width: 700px"
      >
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="店铺名称" prop="name">
              <el-input v-model="form.name" placeholder="请输入店铺名称" maxlength="50" show-word-limit />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系电话" prop="phone">
              <el-input v-model="form.phone" placeholder="请输入联系电话" maxlength="20" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="店铺地址" prop="address">
          <el-input v-model="form.address" placeholder="请输入店铺地址" maxlength="100" show-word-limit />
        </el-form-item>

        <el-form-item label="营业时间" prop="openTime">
          <el-input v-model="form.openTime" placeholder="例如：09:00 - 22:00" maxlength="50" />
        </el-form-item>

        <el-form-item label="是否营业">
          <el-radio-group v-model="form.isOpen">
            <el-radio :label="1">营业中</el-radio>
            <el-radio :label="0">休息中</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="起送价">
              <el-input-number v-model="form.minOrderAmount" :min="0" :precision="2" :step="1" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="配送费">
              <el-input-number v-model="form.deliveryFee" :min="0" :precision="2" :step="1" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="打包费">
              <el-input-number v-model="form.packingFee" :min="0" :precision="2" :step="1" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="配送半径(米)">
              <el-input-number v-model="form.deliveryRadius" :min="0" :step="100" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="店铺简介">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            placeholder="请输入店铺简介"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="店铺公告">
          <el-input
            v-model="form.notice"
            type="textarea"
            :rows="3"
            placeholder="请输入店铺公告，展示在店铺首页"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>
    </app-card>
  </div>
</template>

<style scoped lang="scss">
.merchant-settings {
  // 样式统一使用组件和变量
}
</style>
