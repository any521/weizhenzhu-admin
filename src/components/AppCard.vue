<script setup lang="ts">
interface Props {
  title?: string
  padding?: boolean
  shadow?: 'always' | 'hover' | 'never'
}

withDefaults(defineProps<Props>(), {
  padding: true,
  shadow: 'hover',
})
</script>

<template>
  <el-card class="app-card" :shadow="shadow" :body-style="{ padding: padding ? '16px' : '0' }">
    <template v-if="title" #header>
      <div class="app-card__header">
        <span class="app-card__title">{{ title }}</span>
        <slot name="extra" />
      </div>
    </template>
    <slot />
  </el-card>
</template>

<style scoped lang="scss">
.app-card {
  border-radius: $radius-md;
  margin-bottom: $spacing-md;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__title {
    font-size: $font-size-md;
    font-weight: 600;
    color: $text;
  }
}
</style>
