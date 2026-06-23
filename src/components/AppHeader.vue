<script setup lang="ts">
interface Props {
  title: string
  subtitle?: string
}

defineProps<Props>()
</script>

<template>
  <div class="app-header">
    <div class="app-header__left">
      <h2 class="app-header__title">{{ title }}</h2>
      <p v-if="subtitle" class="app-header__subtitle">{{ subtitle }}</p>
    </div>
    <div class="app-header__right">
      <slot />
    </div>
  </div>
</template>

<style scoped lang="scss">
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: $spacing-md;

  &__title {
    font-size: $font-size-xl;
    font-weight: 600;
    color: $text;
  }

  &__subtitle {
    font-size: $font-size-sm;
    color: $text-muted;
    margin-top: $spacing-xs;
  }

  &__right {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
  }
}
</style>
