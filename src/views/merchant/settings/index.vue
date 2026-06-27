<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Camera, MapLocation, InfoFilled } from '@element-plus/icons-vue'
import MapPicker from '@/components/MapPicker.vue'
import { formatDistance } from '@/utils/amap'
import { api } from '@/api'
import type { Merchant } from '@/api/types'

// 地图选点对话框
const mapPickerVisible = ref(false)

// 加载状态
const loading = ref(false)
const submitLoading = ref(false)
const uploadLoading = ref(false)

// 店铺设置表单
const form = reactive({
  name: '',
  logo: '',
  contactPerson: '',
  address: '',
  longitude: undefined as number | undefined,
  latitude: undefined as number | undefined,
  phone: '',
  openTime: '',
  description: '',
  deliveryRadius: 3000,
  notice: '',
  minOrderAmount: 0,
  deliveryFee: 0,
  packingFee: 0,
  isOpen: 1,
  supportDelivery: 1,
  supportPickup: 0,
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
    form.logo = data.logo || ''
    form.contactPerson = data.contactPerson || ''
    // 地址拼接：省市区 + 详细地址
    const regionParts = [data.province, data.city, data.district].filter(Boolean).join(' ')
    form.address = data.address || ''
    if (regionParts && !form.address.startsWith(regionParts)) {
      form.address = regionParts + (form.address ? ' ' + form.address : '')
    }
    form.longitude = data.longitude != null ? Number(data.longitude) : undefined
    form.latitude = data.latitude != null ? Number(data.latitude) : undefined
    form.phone = data.phone || ''
    form.openTime = data.openTime || '09:00 - 22:00'
    form.description = data.description || ''
    form.deliveryRadius = data.deliveryRadius || 3000
    form.notice = data.notice || ''
    form.minOrderAmount = Number(data.minOrderAmount) || 0
    form.deliveryFee = Number(data.deliveryFee) || 0
    form.packingFee = Number(data.packingFee) || 0
    form.isOpen = data.isOpen ?? 1
    form.supportDelivery = data.supportDelivery ?? 1
    form.supportPickup = data.supportPickup ?? 0
  } finally {
    loading.value = false
  }
}

// 处理Logo上传
async function handleLogoUpload(file: File) {
  const isImage = file.type.startsWith('image/')
  if (!isImage) {
    ElMessage.error('请选择图片文件')
    return false
  }
  const isLt10M = file.size / 1024 / 1024 < 10
  if (!isLt10M) {
    ElMessage.error('图片大小不能超过 10MB')
    return false
  }

  uploadLoading.value = true
  try {
    const res = await api.file.upload(file)
    if (res.code === 200 && res.data?.url) {
      form.logo = res.data.url
      ElMessage.success('Logo上传成功')
    } else {
      ElMessage.error(res.message || '上传失败')
    }
  } catch (e) {
    console.error('上传失败', e)
    ElMessage.error('上传失败')
  } finally {
    uploadLoading.value = false
  }
  return false
}

// 打开地图选点
function openMapPicker() {
  mapPickerVisible.value = true
}

// 确认地图选点
function onMapSelect(poi: { name: string; address: string; longitude: number; latitude: number }) {
  form.longitude = Number(poi.longitude.toFixed(6))
  form.latitude = Number(poi.latitude.toFixed(6))
  // 如果地址为空或与原地址不同，自动填充
  if (!form.address || form.address.length < 5) {
    form.address = poi.address || poi.name
  }
  mapPickerVisible.value = false
  ElMessage.success('已选择位置：' + poi.name)
}

// 保存店铺设置
async function handleSave() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitLoading.value = true
  try {
    const payload: Partial<Merchant> = {
      name: form.name,
      logo: form.logo,
      contactPerson: form.contactPerson,
      address: form.address,
      longitude: form.longitude,
      latitude: form.latitude,
      phone: form.phone,
      openTime: form.openTime,
      description: form.description,
      notice: form.notice,
      deliveryRadius: Number(form.deliveryRadius),
      minOrderAmount: Number(form.minOrderAmount),
      deliveryFee: Number(form.deliveryFee),
      packingFee: Number(form.packingFee),
      isOpen: Number(form.isOpen),
      supportDelivery: Number(form.supportDelivery),
      supportPickup: Number(form.supportPickup),
    }
    await api.merchantSettings.save(payload)
    ElMessage.success('保存成功')
    // 重新加载设置以确认数据持久化
    await fetchSettings()
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

    <app-card title="店铺Logo">
      <div class="logo-section">
        <el-upload
          class="logo-uploader"
          :show-file-list="false"
          :before-upload="handleLogoUpload"
          accept="image/*"
        >
          <div class="logo-wrapper">
            <el-avatar v-if="form.logo" :size="80" :src="form.logo" shape="square" class="logo-img" />
            <div v-else class="logo-placeholder">
              <span class="logo-text">{{ (form.name || '店').charAt(0) }}</span>
            </div>
            <div class="logo-overlay" v-if="!uploadLoading">
              <el-icon :size="20"><Camera /></el-icon>
              <span class="upload-text">点击上传</span>
            </div>
            <div v-if="uploadLoading" class="logo-uploading">
              <el-icon :size="20" class="is-loading"><Loading /></el-icon>
            </div>
          </div>
        </el-upload>
        <div class="logo-tip">
          <p class="tip-title">店铺Logo</p>
          <p class="tip-desc">建议上传 1:1 比例的图片，用于店铺展示</p>
        </div>
      </div>
    </app-card>

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
            <el-form-item label="联系人">
              <el-input v-model="form.contactPerson" placeholder="请输入联系人姓名" maxlength="20" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="联系电话" prop="phone">
              <el-input v-model="form.phone" placeholder="请输入联系电话" maxlength="20" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="营业时间" prop="openTime">
              <el-input v-model="form.openTime" placeholder="例如：09:00 - 22:00" maxlength="50" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="店铺地址" prop="address">
          <el-input v-model="form.address" placeholder="请输入店铺详细地址" maxlength="100" show-word-limit />
        </el-form-item>

        <el-form-item label="店铺定位">
          <div class="location-section">
            <div class="location-coords">
              <el-input-number v-model="form.longitude" :precision="6" :step="0.000001" placeholder="经度" style="width: 180px" :controls="false">
                <template #prefix>经度</template>
              </el-input-number>
              <el-input-number v-model="form.latitude" :precision="6" :step="0.000001" placeholder="纬度" style="width: 180px" :controls="false">
                <template #prefix>纬度</template>
              </el-input-number>
            </div>
            <el-button type="primary" plain :icon="MapLocation" @click="openMapPicker">
              地图选点
            </el-button>
          </div>
          <div class="location-tip">
            <el-icon color="#909399"><InfoFilled /></el-icon>
            <span>点击"地图选点"在地图上选择店铺位置，用于骑手导航和配送费计算</span>
          </div>
        </el-form-item>

        <el-form-item label="是否营业">
          <el-radio-group v-model="form.isOpen">
            <el-radio :label="1">营业中</el-radio>
            <el-radio :label="0">休息中</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="配送设置">
          <div class="delivery-settings">
            <div class="switch-item">
              <el-switch
                v-model="form.supportDelivery"
                :active-value="1"
                :inactive-value="0"
                active-text="支持外卖配送"
                inactive-text="不支持外卖"
              />
            </div>
            <div class="switch-item">
              <el-switch
                v-model="form.supportPickup"
                :active-value="1"
                :inactive-value="0"
                active-text="支持到店自取"
                inactive-text="不支持自取"
              />
            </div>
          </div>
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

    <!-- 底部保存按钮 -->
    <div class="form-footer">
      <el-button type="primary" size="large" :loading="submitLoading" @click="handleSave">保存设置</el-button>
    </div>

    <!-- 地图选点对话框 -->
    <el-dialog
      v-model="mapPickerVisible"
      title="地图选点"
      width="700px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <MapPicker
        :initial-longitude="form.longitude"
        :initial-latitude="form.latitude"
        @select="onMapSelect"
      />
    </el-dialog>
  </div>
</template>

<script lang="ts">
import { Loading } from '@element-plus/icons-vue'
export default {
  components: { Loading },
}
</script>

<style scoped lang="scss">
.merchant-settings {
  padding-bottom: 40px;
}

.logo-section {
  display: flex;
  align-items: center;
  gap: $spacing-xl;
}

.logo-uploader {
  :deep(.el-upload) {
    border: none;
    background: transparent;
    cursor: pointer;
  }
}

.logo-wrapper {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: $radius-md;
  overflow: hidden;

  .logo-img {
    width: 100%;
    height: 100%;
    display: block;
    border-radius: $radius-md;
  }

  .logo-placeholder {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, $primary-light, $primary);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: $radius-md;

    .logo-text {
      font-size: 28px;
      font-weight: bold;
      color: #fff;
    }
  }

  .logo-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #fff;
    opacity: 0;
    transition: opacity 0.3s;
    border-radius: $radius-md;

    .upload-text {
      font-size: 12px;
      margin-top: 2px;
    }
  }

  .logo-uploading {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    border-radius: $radius-md;
  }

  &:hover .logo-overlay {
    opacity: 1;
  }
}

.logo-tip {
  .tip-title {
    font-size: $font-size-md;
    font-weight: 600;
    color: $text;
    margin-bottom: 4px;
  }

  .tip-desc {
    font-size: $font-size-sm;
    color: $text-muted;
  }
}

.delivery-settings {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;

  .switch-item {
    display: flex;
    align-items: center;
  }
}

.form-footer {
  display: flex;
  justify-content: center;
  padding: $spacing-lg 0;
  margin-top: $spacing-md;
  background-color: #fff;
  border-radius: $radius-md;
  box-shadow: $shadow;

  .el-button {
    min-width: 200px;
  }
}
.location-section {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.location-coords {
  display: flex;
  gap: 8px;
}

.location-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
}
</style>
