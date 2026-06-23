<script setup lang="ts">
import { reactive, ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { User, Lock, Key, Message } from '@element-plus/icons-vue'
import { useUserStore, useAppStore } from '@/store'
import type { UserType } from '@/utils/constants'
import { isPhone } from '@/utils/validator'

interface Props {
  userType: UserType
  title?: string
  subtitle?: string
  redirect?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: '欢迎登录',
  subtitle: '请输入账号密码登录系统',
  redirect: undefined,
})

const router = useRouter()
const userStore = useUserStore()
const appStore = useAppStore()

const loading = ref(false)
const sendingCode = ref(false)
const countdown = ref(0)
const captchaText = ref('')
const loginType = ref<'password' | 'sms'>('password')

const isAdmin = computed(() => props.userType === 'admin')
const accountPlaceholder = computed(() => {
  if (loginType.value === 'sms') return '请输入手机号'
  return isAdmin.value ? '请输入用户名或手机号' : '请输入手机号'
})

const form = reactive({
  account: '',
  password: '',
  code: '',
  captcha: '',
})

const accountRule = {
  validator: (_rule: unknown, value: string, callback: (error?: Error) => void) => {
    if (!value) {
      callback(new Error(loginType.value === 'sms' ? '请输入手机号' : '请输入账号'))
      return
    }
    if (loginType.value === 'sms' && !isPhone(value)) {
      callback(new Error('手机号格式不正确'))
      return
    }
    callback()
  },
  trigger: 'blur',
}

const rules = computed(() => ({
  account: [{ required: true, validator: accountRule.validator, trigger: 'blur' }],
  password: loginType.value === 'password'
    ? [
        { required: true, message: '请输入密码', trigger: 'blur' },
        { min: 6, message: '密码长度不能少于 6 位', trigger: 'blur' },
      ]
    : [],
  code: loginType.value === 'sms'
    ? [{ required: true, message: '请输入短信验证码', trigger: 'blur' }]
    : [],
  captcha: [{ required: true, message: '请输入验证码', trigger: 'blur' }],
}))

const formRef = ref<InstanceType<typeof ElForm>>()

function refreshCaptcha() {
  captchaText.value = Math.random().toString(36).slice(2, 6).toUpperCase()
  form.captcha = ''
}

async function sendSmsCode() {
  const valid = await formRef.value?.validateField('account').catch(() => false)
  if (!valid) return
  if (!isPhone(form.account)) {
    ElMessage.error('请输入正确的手机号')
    return
  }
  sendingCode.value = true
  try {
    await useAppStore().$api?.auth?.sendSmsCode?.(form.account, props.userType)
    // 发送成功后启动倒计时
    countdown.value = 60
    const timer = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0) clearInterval(timer)
    }, 1000)
    ElMessage.success('验证码已发送')
  } catch (e: any) {
    ElMessage.error(e?.message || '发送失败')
  } finally {
    sendingCode.value = false
  }
}

async function handleLogin() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  if (form.captcha.toUpperCase() !== captchaText.value) {
    ElMessage.error('验证码错误')
    refreshCaptcha()
    return
  }

  loading.value = true
  try {
    const type = props.userType
    if (loginType.value === 'sms') {
      await userStore.smsLogin(form.account, form.code, type)
    } else {
      await userStore.login(form.account, form.password, type)
    }
    appStore.setCurrentApp(type)
    appStore.setAppName(type === 'admin' ? '味真族管理平台' : '味真族商家后台')

    ElMessage.success('登录成功')
    const target = props.redirect || (type === 'admin' ? '/admin/dashboard' : '/merchant/dashboard')
    router.push(target)
  } catch (e: any) {
    ElMessage.error(e?.message || '登录失败，请重试')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  refreshCaptcha()
})
</script>

<template>
  <div class="login-form-box">
    <h2 class="form-title">{{ props.title }}</h2>
    <p class="form-subtitle">{{ props.subtitle }}</p>

    <div class="login-type-tabs">
      <div
        :class="['login-type-tab', loginType === 'password' && 'active']"
        @click="loginType = 'password'"
      >
        密码登录
      </div>
      <div
        :class="['login-type-tab', loginType === 'sms' && 'active']"
        @click="loginType = 'sms'"
      >
        验证码登录
      </div>
    </div>

    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      size="large"
      class="login-form"
    >
      <el-form-item prop="account">
        <el-input
          v-model="form.account"
          :placeholder="accountPlaceholder"
          :prefix-icon="User"
          clearable
        />
      </el-form-item>

      <el-form-item v-if="loginType === 'password'" prop="password">
        <el-input
          v-model="form.password"
          type="password"
          placeholder="请输入密码"
          :prefix-icon="Lock"
          show-password
          @keyup.enter="handleLogin"
        />
      </el-form-item>

      <el-form-item v-else prop="code">
        <div class="code-row">
          <el-input
            v-model="form.code"
            placeholder="请输入短信验证码"
            :prefix-icon="Message"
            @keyup.enter="handleLogin"
          />
          <el-button
            :disabled="countdown > 0 || sendingCode"
            class="send-code-btn"
            @click="sendSmsCode"
          >
            {{ countdown > 0 ? `${countdown}s 后重试` : '获取验证码' }}
          </el-button>
        </div>
      </el-form-item>

      <el-form-item prop="captcha">
        <div class="captcha-row">
          <el-input
            v-model="form.captcha"
            placeholder="请输入验证码"
            :prefix-icon="Key"
            @keyup.enter="handleLogin"
          />
          <div class="captcha-code" @click="refreshCaptcha">
            {{ captchaText }}
          </div>
        </div>
      </el-form-item>

      <el-form-item>
        <el-button
          type="primary"
          size="large"
          class="login-btn"
          :loading="loading"
          @click="handleLogin"
        >
          立即登录
        </el-button>
      </el-form-item>
    </el-form>

    <div class="login-tips">
      <p>提示：{{ isAdmin ? '支持用户名+密码、手机号+密码、手机号+验证码三种登录方式' : '支持手机号+密码、手机号+验证码两种登录方式' }}。</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.login-form-box {
  width: 360px;
  max-width: 100%;
}

.form-title {
  font-size: 24px;
  font-weight: bold;
  color: $text;
  margin-bottom: $spacing-sm;
}

.form-subtitle {
  font-size: $font-size-md;
  color: $text-muted;
  margin-bottom: $spacing-lg;
}

.login-type-tabs {
  display: flex;
  gap: $spacing-md;
  margin-bottom: $spacing-lg;
  border-bottom: 1px solid #e4e7ed;

  .login-type-tab {
    padding-bottom: $spacing-sm;
    font-size: $font-size-md;
    color: $text-muted;
    cursor: pointer;
    position: relative;

    &.active {
      color: $primary;
      font-weight: 600;

      &::after {
        content: '';
        position: absolute;
        bottom: -1px;
        left: 0;
        width: 100%;
        height: 2px;
        background: $primary;
      }
    }
  }
}

.login-form {
  .el-input {
    :deep(.el-input__wrapper) {
      border-radius: $radius-md;
    }
  }
}

.code-row {
  display: flex;
  gap: $spacing-sm;
  width: 100%;

  .el-input {
    flex: 1;
  }

  .send-code-btn {
    width: 120px;
    height: 40px;
    border-radius: $radius-md;
  }
}

.captcha-row {
  display: flex;
  gap: $spacing-sm;
  width: 100%;

  .el-input {
    flex: 1;
  }

  .captcha-code {
    width: 100px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, $primary-light, $primary);
    color: #fff;
    border-radius: $radius-md;
    font-weight: bold;
    letter-spacing: 4px;
    cursor: pointer;
    user-select: none;
    font-size: 18px;
  }
}

.login-btn {
  width: 100%;
  border-radius: $radius-md;
  height: 44px;
  font-size: $font-size-lg;
}

.login-tips {
  margin-top: $spacing-lg;
  padding: $spacing-md;
  background-color: #fff5f5;
  border-radius: $radius-md;
  color: $primary-dark;
  font-size: $font-size-sm;
  line-height: 1.6;
}
</style>
