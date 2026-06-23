<script setup lang="ts">
import { Check } from '@element-plus/icons-vue'
import LoginForm from '@/views/login/LoginForm.vue'
</script>

<template>
  <div class="login-page">
    <div class="login-box">
      <!-- 左侧品牌区 -->
      <div class="login-brand">
        <div class="brand-content">
          <div class="brand-logo">味</div>
          <h1 class="brand-title">味真族</h1>
          <p class="brand-subtitle">商家管理后台</p>
          <div class="brand-features">
            <div class="feature-item">
              <el-icon><Check /></el-icon>
              <span>订单实时处理</span>
            </div>
            <div class="feature-item">
              <el-icon><Check /></el-icon>
              <span>菜品灵活管理</span>
            </div>
            <div class="feature-item">
              <el-icon><Check /></el-icon>
              <span>经营数据可视化</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧表单区 -->
      <div class="login-form-wrap">
        <LoginForm
          user-type="merchant"
          title="商家登录"
          subtitle="登录味真族商家后台"
          redirect="/merchant/dashboard"
        />
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
  min-height: 520px;
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
  align-items: center;
  justify-content: center;
  padding: $spacing-xl;
}

@media screen and (max-width: 768px) {
  .login-box {
    flex-direction: column;
  }

  .login-brand {
    width: 100%;
    min-height: 200px;
  }
}
</style>
