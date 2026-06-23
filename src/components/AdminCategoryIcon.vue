<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <component :is="node" v-for="(node, i) in nodes" :key="i" />
  </svg>
</template>

<script setup lang="ts">
import { computed, h } from 'vue'

const props = defineProps<{
  name: string
  size?: number | string
  color?: string
}>()

const size = computed(() => props.size || 28)
const strokeColor = computed(() => props.color || '#fff')

const OLD_ICON_MAP: Record<string, string> = {
  Food: 'meishi', IceCream: 'dessert', Coffee: 'coffee', Apple: 'fruit',
  Burger: 'burger', Sugar: 'dessert', ForkSpoon: 'meishi', KnifeFork: 'meishi',
  Dessert: 'dessert', IceDrink: 'dessert', HotWater: 'breakfast', Shop: 'store',
  FirstAidKit: 'pharmacy', Basketball: 'brand', Van: 'errand', Service: 'brand',
  Present: 'brand', Star: 'brand', More: 'more',
}

const icons: Record<string, (c: string) => string> = {
  meishi: (c) => `<path d="M14 8v32" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/><path d="M34 8v32" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/><path d="M8 40h32" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/><path d="M11 8h6M31 8h6" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`,
  breakfast: (c) => `<path d="M10 20h28v14a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V20Z" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/><path d="M14 20V14a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v6" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/><path d="M18 28h12" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`,
  errand: (c) => `<circle cx="32" cy="16" r="5" stroke="${c}" stroke-width="2.5"/><path d="M14 40c0-6 4-10 10-10h6" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/><path d="M24 34l6 6-6 6" stroke="${c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 20h16" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/><path d="M14 14v12" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`,
  dessert: (c) => `<path d="M16 18h16v12a8 8 0 0 1-16 0V18Z" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/><path d="M14 18h20" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/><path d="M20 10c0-2 1.5-4 4-4s4 2 4 4H20Z" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/><path d="M24 38v6" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`,
  fruit: (c) => `<path d="M24 8c6 0 10 4 10 10 0 6-4 10-10 18-6-8-10-12-10-18 0-6 4-10 10-10Z" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/><path d="M24 8v-4" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/><path d="M28 6c2 0 4 1 5 3" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`,
  burger: (c) => `<path d="M8 22h32a4 4 0 0 1 4 4v2H4v-2a4 4 0 0 1 4-4Z" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/><path d="M6 32h36a4 4 0 0 1 4 4v2H2v-2a4 4 0 0 1 4-4Z" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/><path d="M10 22c2-8 8-12 14-12s12 4 14 12" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`,
  coffee: (c) => `<path d="M8 14h28v16a6 6 0 0 1-6 6H14a6 6 0 0 1-6-6V14Z" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/><path d="M36 18h4a4 4 0 0 1 0 8h-4" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/><path d="M14 22h4" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/><path d="M14 28h12" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`,
  brand: (c) => `<path d="M24 6l4.5 9h9l-7.5 6 3 9-9-6-9 6 3-9-7.5-6h9l4.5-9Z" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>`,
  noodles: (c) => `<path d="M8 40h32" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/><path d="M12 32c4-10 10-16 20-16" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/><path d="M16 32c3-7 8-12 15-12" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/><path d="M20 32c2-4 6-7 10-7" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`,
  bbq: (c) => `<path d="M12 12h24l-4 24H16L12 12Z" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/><path d="M18 8h12v4H18V8Z" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/><path d="M16 20h16" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/><path d="M15 28h18" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`,
  hotpot: (c) => `<path d="M10 16h28v16a8 8 0 0 1-8 8H18a8 8 0 0 1-8-8V16Z" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/><path d="M14 16V10a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v6" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/><path d="M24 24v8" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/><path d="M20 28h8" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`,
  sushi: (c) => `<path d="M8 24h32v10a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V24Z" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/><path d="M12 24c4-8 10-12 16-12s12 4 16 12" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/><path d="M18 30h12" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`,
  salad: (c) => `<path d="M24 6l-4 14h8L24 6Z" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/><path d="M12 24h24l-4 18H16L12 24Z" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/><path d="M16 24c2-6 6-10 12-10" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`,
  pharmacy: (c) => `<path d="M24 8v32" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/><path d="M8 24h32" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`,
  flower: (c) => `<path d="M24 8c5 0 8 3 8 8s-3 8-8 14c-5-6-8-9-8-14s3-8 8-8Z" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/><path d="M24 30v10" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/><path d="M28 10c3-1 6 1 7 4" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`,
  store: (c) => `<path d="M8 12h32v28a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V12Z" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/><path d="M12 6h24v6H12V6Z" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/><path d="M10 18h4v4h-4v-4Zm12 0h4v4h-4v-4Zm12 0h4v4h-4v-4Z" fill="${c}"/>`,
  cake: (c) => `<path d="M8 34h32v6a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4v-6Z" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/><path d="M10 34V26a4 4 0 0 1 4-4h20a4 4 0 0 1 4 4v8" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/><path d="M20 14c0-2 1.5-4 4-4s4 2 4 4H20Z" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>`,
  more: (c) => `<rect x="6" y="6" width="14" height="14" rx="3" stroke="${c}" stroke-width="2.5"/><rect x="28" y="6" width="14" height="14" rx="3" stroke="${c}" stroke-width="2.5"/><rect x="6" y="28" width="14" height="14" rx="3" stroke="${c}" stroke-width="2.5"/><rect x="28" y="28" width="14" height="14" rx="3" stroke="${c}" stroke-width="2.5"/>`,
}

const path = computed(() => {
  const resolved = OLD_ICON_MAP[props.name] || props.name
  const fn = icons[resolved] || icons.more
  return fn(strokeColor.value)
})

function parseAttrs(attrStr: string): Record<string, string | number> {
  const attrs: Record<string, string | number> = {}
  const regex = /(\w+[-:\w]*)="([^"]*)"/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(attrStr)) !== null) {
    const key = match[1]
    let value: string | number = match[2]
    if (!isNaN(Number(value)) && value !== '') value = Number(value)
    attrs[key] = value
  }
  return attrs
}

const nodes = computed(() => {
  const svg = path.value
  const tagRegex = /<\s*(\w+)\s*([^>]*?)\s*\/>/g
  const result: any[] = []
  let match: RegExpExecArray | null
  while ((match = tagRegex.exec(svg)) !== null) {
    result.push(h(match[1], parseAttrs(match[2])))
  }
  return result
})
</script>
