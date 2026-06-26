<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Camera } from '@element-plus/icons-vue'
import { api } from '@/api'
import { useUserStore } from '@/store'
import type { UserType } from '@/utils/constants'

const userStore = useUserStore()
const userType = computed<UserType>(() => userStore.currentUserType || 'merchant')
const isMerchant = computed(() => userType.value === 'merchant')

// 表单数据
const form = reactive({
  nickname: '',
  realName: '',
  avatar: '',
  phone: '',
  email: '',
})

const loading = ref(false)
const saveLoading = ref(false)
const uploadLoading = ref(false)

// 密码表单
const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})
const passwordDialogVisible = ref(false)
const passwordLoading = ref(false)

// 加载用户信息
async function loadProfile() {
  loading.value = true
  try {
    const res = await api.profile.get()
    const data = res.data
    if (isMerchant.value) {
      // 商家信息
      form.nickname = data.name || ''
      form.realName = data.contactPerson || data.contactName || ''
      form.avatar = data.logo || ''
      form.phone = data.phone || data.contactPhone || ''
      form.email = ''
    } else {
      // 管理员信息
      form.nickname = data.nickname || data.realName || ''
      form.realName = data.realName || ''
      form.avatar = data.avatar || ''
      form.phone = data.phone || ''
      form.email = data.email || ''
    }
  } catch (e) {
    console.error('加载个人信息失败', e)
  } finally {
    loading.value = false
  }
}

// 处理头像上传
async function handleAvatarUpload(file: File) {
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
      form.avatar = res.data.url
      ElMessage.success('头像上传成功')
    } else {
      ElMessage.error(res.message || '上传失败')
    }
  } catch (e) {
    console.error('上传失败', e)
    ElMessage.error('上传失败')
  } finally {
    uploadLoading.value = false
  }
  return false // 阻止组件默认上传行为
}

// 保存个人信息
async function handleSave() {
  if (!form.nickname && isMerchant.value) {
    ElMessage.warning('请输入店铺名称')
    return
  }

  saveLoading.value = true
  try {
    await api.profile.update({
      nickname: form.nickname,
      realName: form.realName,
      avatar: form.avatar,
      phone: form.phone,
      email: form.email,
    })

    // 更新本地 store
    userStore.updateUserInfo({
      nickname: form.nickname || form.realName,
      avatar: form.avatar,
    })

    ElMessage.success('保存成功')
  } catch (e) {
    console.error('保存失败', e)
  } finally {
    saveLoading.value = false
  }
}

// 修改密码
function showPasswordDialog() {
  passwordForm.oldPassword = ''
  passwordForm.newPassword = ''
  passwordForm.confirmPassword = ''
  passwordDialogVisible.value = true
}

async function handleUpdatePassword() {
  if (!passwordForm.oldPassword) {
    ElMessage.warning('请输入原密码')
    return
  }
  if (!passwordForm.newPassword || passwordForm.newPassword.length < 6) {
    ElMessage.warning('新密码至少6位')
    return
  }
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    ElMessage.warning('两次密码输入不一致')
    return
  }

  passwordLoading.value = true
  try {
    await api.profile.updatePassword(passwordForm.oldPassword, passwordForm.newPassword)
    ElMessage.success('密码修改成功，请重新登录')
    passwordDialogVisible.value = false
    setTimeout(() => {
      userStore.logout()
      window.location.href = '/login'
    }, 1000)
  } catch (e) {
    console.error('修改密码失败', e)
  } finally {
    passwordLoading.value = false
  }
}

onMounted(() => {
  loadProfile()
})
</script>

<template>
  <div v-loading="loading" class="profile-page">
    <app-header :title="isMerchant ? '商家设置' : '个人设置'">
      <template #right>
        <el-button type="primary" :loading="saveLoading" @click="handleSave">保存修改</el-button>
      </template>
    </app-header>

    <div class="profile-content">
      <!-- 头像设置卡片 -->
      <app-card title="头像设置" class="profile-card">
        <div class="avatar-section">
          <el-upload
            class="avatar-uploader"
            :show-file-list="false"
            :before-upload="handleAvatarUpload"
            accept="image/*"
          >
            <div class="avatar-wrapper">
              <el-avatar v-if="form.avatar" :size="100" :src="form.avatar" class="avatar-img" />
              <div v-else class="avatar-placeholder">
                <span class="avatar-text">{{ (form.nickname || 'U').charAt(0) }}</span>
              </div>
              <div class="avatar-overlay" v-if="!uploadLoading">
                <el-icon :size="20"><Camera /></el-icon>
                <span class="upload-text">点击更换</span>
              </div>
              <div v-if="uploadLoading" class="avatar-uploading">
                <el-icon :size="20" class="is-loading"><Loading /></el-icon>
              </div>
            </div>
          </el-upload>
          <div class="avatar-tip">
            <p class="tip-title">{{ isMerchant ? '店铺Logo' : '个人头像' }}</p>
            <p class="tip-desc">支持 JPG/PNG 格式，文件大小不超过 10MB</p>
          </div>
        </div>
      </app-card>

      <!-- 基本信息卡片 -->
      <app-card title="基本信息" class="profile-card">
        <el-form :model="form" label-width="100px" style="max-width: 600px">
          <el-form-item :label="isMerchant ? '店铺名称' : '昵称'">
            <el-input v-model="form.nickname" :placeholder="isMerchant ? '请输入店铺名称' : '请输入昵称'" maxlength="50" show-word-limit />
          </el-form-item>

          <el-form-item :label="isMerchant ? '联系人' : '真实姓名'">
            <el-input v-model="form.realName" :placeholder="isMerchant ? '请输入联系人姓名' : '请输入真实姓名'" maxlength="20" />
          </el-form-item>

          <el-form-item label="联系电话">
            <el-input v-model="form.phone" placeholder="请输入联系电话" maxlength="11" />
          </el-form-item>

          <el-form-item v-if="!isMerchant" label="邮箱">
            <el-input v-model="form.email" placeholder="请输入邮箱地址" />
          </el-form-item>
        </el-form>
      </app-card>

      <!-- 安全设置卡片 -->
      <app-card title="安全设置" class="profile-card">
        <div class="security-item" @click="showPasswordDialog">
          <div class="security-info">
            <p class="security-title">登录密码</p>
            <p class="security-desc">建议定期更换密码，保障账号安全</p>
          </div>
          <el-button type="primary" link>修改密码</el-button>
        </div>
      </app-card>
    </div>

    <!-- 修改密码弹窗 -->
    <el-dialog v-model="passwordDialogVisible" title="修改密码" width="420px">
      <el-form :model="passwordForm" label-width="80px">
        <el-form-item label="原密码">
          <el-input v-model="passwordForm.oldPassword" type="password" placeholder="请输入原密码" show-password />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="passwordForm.newPassword" type="password" placeholder="请输入新密码（至少6位）" show-password />
        </el-form-item>
        <el-form-item label="确认密码">
          <el-input v-model="passwordForm.confirmPassword" type="password" placeholder="请再次输入新密码" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="passwordDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="passwordLoading" @click="handleUpdatePassword">确认修改</el-button>
      </template>
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
.profile-page {
  padding-bottom: 40px;
}

.profile-content {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.profile-card {
  margin-bottom: 0;
}

.avatar-section {
  display: flex;
  align-items: center;
  gap: $spacing-xl;
}

.avatar-uploader {
  :deep(.el-upload) {
    border: none;
    background: transparent;
    cursor: pointer;
  }
}

.avatar-wrapper {
  position: relative;
  width: 100px;
  height: 100px;
  border-radius: 50%;
  overflow: hidden;

  .avatar-img {
    width: 100%;
    height: 100%;
    display: block;
  }

  .avatar-placeholder {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, $primary-light, $primary);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;

    .avatar-text {
      font-size: 36px;
      font-weight: bold;
      color: #fff;
    }
  }

  .avatar-overlay {
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
    border-radius: 50%;

    .upload-text {
      font-size: 12px;
      margin-top: 4px;
    }
  }

  .avatar-uploading {
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
    border-radius: 50%;
  }

  &:hover .avatar-overlay {
    opacity: 1;
  }
}

.avatar-tip {
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

.security-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-md 0;

  &:not(:last-child) {
    border-bottom: 1px solid $border-light;
  }

  .security-title {
    font-size: $font-size-md;
    font-weight: 500;
    color: $text;
    margin-bottom: 4px;
  }

  .security-desc {
    font-size: $font-size-sm;
    color: $text-muted;
  }
}
</style>
