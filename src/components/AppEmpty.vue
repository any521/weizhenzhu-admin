<script setup lang="ts">
interface Props {
  description?: string
  image?: string
}

withDefaults(defineProps<Props>(), {
  description: '暂无数据',
})
</script>

<template>
  <el-empty class="app-empty" :description="description" :image="image">
    <template v-if="$slots.default" #default>
      <slot />
    </template>
  </el-empty>
</template>

<style scoped lang="scss">
.app-empty {
  padding: $spacing-xl 0;
}
</style>
