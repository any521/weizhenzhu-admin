<script setup lang="ts">
import { onBeforeMount } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store'

const router = useRouter()
const userStore = useUserStore()

onBeforeMount(() => {
  const userType = userStore.currentUserType
  if (userType === 'admin') {
    router.replace('/admin/login')
  } else {
    router.replace('/merchant/login')
  }
})
</script>

<template>
  <div />
</template>
