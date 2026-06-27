<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Check } from '@element-plus/icons-vue'
import LoginForm from '@/views/login/LoginForm.vue'
import { resetRedirectFlag } from '@/utils/request'
import type { UserType } from '@/utils/constants'

const route = useRoute()
const router = useRouter()

// 从 query 读取初始类型，默认 admin
const currentType = ref<UserType>(
  (route.query.type as UserType) === 'merchant' ? 'merchant' : 'admin'
)

// 品牌区文案根据类型变化
const brandConfig = computed(() => {
  if (currentType.value === 'admin') {
    return {
      subtitle: '管理后台',
      features: [
        { icon: Check, text: '平台统一管控' },
        { icon: Check, text: '商家/骑手/订单管理' },
        { icon: Check, text: '风控与数据洞察' },
      ],
    }
  }
  return {
    subtitle: '商家管理后台',
    features: [
      { icon: Check, text: '订单实时处理' },
      { icon: Check, text: '菜品灵活管理' },
      { icon: Check, text: '经营数据可视化' },
    ],
  }
})

const formTitle = computed(() => (currentType.value === 'admin' ? '管理员登录' : '商家登录'))
const formSubtitle = computed(() =>
  currentType.value === 'admin' ? '登录味真族管理平台' : '登录味真族商家后台'
)
const formRedirect = computed(() => {
  // 如果路由守卫传了 redirect 参数，登录后回到原页面
  const redirect = route.query.redirect as string | undefined
  if (redirect) return redirect
  return currentType.value === 'admin' ? '/admin/dashboard' : '/merchant/dashboard'
})

// 切换端：不弹提示，只更新状态；同步更新 URL query（不触发导航），保留 redirect 参数
function switchType(type: UserType) {
  if (type === currentType.value) return
  currentType.value = type
  const query: Record<string, string> = { type }
  const redirect = route.query.redirect as string | undefined
  if (redirect) query.redirect = redirect
  router.replace({ path: '/login', query })
}

// 页面挂载时重置全局跳转标记，避免从过期页面返回后无法再次跳转
onMounted(() => {
  resetRedirectFlag()
})

// 如果路由 query 变化（如浏览器前进/后退），同步类型
watch(
  () => route.query.type,
  (t) => {
    if (t === 'merchant' || t === 'admin') {
      currentType.value = t
    }
  }
)
</script>

<template>
  <div class="login-page">
    <div class="login-box">
      <!-- 左侧品牌区 -->
      <div class="login-brand">
        <div class="brand-content">
          <div class="brand-logo">味</div>
          <h1 class="brand-title">味真族</h1>
          <p class="brand-subtitle">{{ brandConfig.subtitle }}</p>
          <div class="brand-features">
            <div v-for="(f, i) in brandConfig.features" :key="i" class="feature-item">
              <el-icon><component :is="f.icon" /></el-icon>
              <span>{{ f.text }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧表单区 -->
      <div class="login-form-wrap">
        <LoginForm
          :key="currentType"
          :user-type="currentType"
          :title="formTitle"
          :subtitle="formSubtitle"
          :redirect="formRedirect"
        />

        <!-- 端切换卡片 -->
        <div class="role-switcher">
          <div
            :class="['role-card', currentType === 'admin' && 'active']"
            @click="switchType('admin')"
          >
            <div class="role-card-icon">
              <el-icon :size="22"><Monitor /></el-icon>
            </div>
            <div class="role-card-text">
              <div class="role-card-title">管理员端</div>
              <div class="role-card-desc">平台运营管理</div>
            </div>
            <div v-if="currentType === 'admin'" class="role-card-check">
              <el-icon><Check /></el-icon>
            </div>
          </div>
          <div
            :class="['role-card', currentType === 'merchant' && 'active']"
            @click="switchType('merchant')"
          >
            <div class="role-card-icon">
              <el-icon :size="22"><Shop /></el-icon>
            </div>
            <div class="role-card-text">
              <div class="role-card-title">商家端</div>
              <div class="role-card-desc">店铺经营管理</div>
            </div>
            <div v-if="currentType === 'merchant'" class="role-card-check">
              <el-icon><Check /></el-icon>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #fff5f5 0%, #ffffff 100%);
  padding: $spacing-lg;
}

.login-box {
  width: 900px;
  max-width: 100%;
  min-height: 560px;
  background-color: #fff;
  border-radius: $radius-xl;
  box-shadow: $shadow-lg;
  display: flex;
  overflow: hidden;
}

.login-brand {
  width: 360px;
  background: linear-gradient(135deg, $primary-light, $primary);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $spacing-xl;
  flex-shrink: 0;

  .brand-content {
    text-align: center;
  }

  .brand-logo {
    width: 80px;
    height: 80px;
    margin: 0 auto $spacing-lg;
    background-color: rgba(255, 255, 255, 0.2);
    border-radius: $radius-round;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 40px;
    font-weight: bold;
  }

  .brand-title {
    font-size: 32px;
    font-weight: bold;
    margin-bottom: $spacing-sm;
  }

  .brand-subtitle {
    font-size: $font-size-lg;
    opacity: 0.9;
    margin-bottom: $spacing-xl;
  }

  .brand-features {
    text-align: left;
    display: inline-flex;
    flex-direction: column;
    gap: $spacing-md;

    .feature-item {
      display: flex;
      align-items: center;
      gap: $spacing-sm;
      font-size: $font-size-md;

      .el-icon {
        font-size: 18px;
      }
    }
  }
}

.login-form-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: $spacing-xl;
  gap: $spacing-lg;
}

// ===== 端切换卡片（分段控制器风格） =====
.role-switcher {
  display: flex;
  gap: $spacing-md;
  width: 360px;
  max-width: 100%;

  .role-card {
    flex: 1;
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    padding: $spacing-md;
    border: 2px solid $border-light;
    border-radius: $radius-lg;
    cursor: pointer;
    transition: all $transition-fast;
    background-color: #fff;
    position: relative;

    &:hover {
      border-color: $primary-light;
      background-color: #fffafa;
    }

    &.active {
      border-color: $primary;
      background-color: #fff5f5;
      box-shadow: $shadow-red;
    }

    .role-card-icon {
      width: 40px;
      height: 40px;
      border-radius: $radius-md;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: $border-light;
      color: $text-muted;
      flex-shrink: 0;
      transition: all $transition-fast;
    }

    &.active .role-card-icon {
      background: linear-gradient(135deg, $primary-light, $primary);
      color: #fff;
    }

    .role-card-text {
      flex: 1;
      min-width: 0;

      .role-card-title {
        font-size: $font-size-md;
        font-weight: 600;
        color: $text;
        line-height: 1.3;
      }

      .role-card-desc {
        font-size: $font-size-xs;
        color: $text-muted;
        margin-top: 2px;
      }
    }

    .role-card-check {
      width: 20px;
      height: 20px;
      border-radius: $radius-round;
      background-color: $primary;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      flex-shrink: 0;
    }
  }
}

@media screen and (max-width: 768px) {
  .login-box {
    flex-direction: column;
    min-height: auto;
  }

  .login-brand {
    width: 100%;
    min-height: 180px;
    padding: $spacing-lg;
  }

  .role-switcher {
    width: 100%;
  }
}
</style>
