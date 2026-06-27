<template>
  <div class="map-picker">
    <!-- 搜索框 -->
    <div class="search-bar">
      <el-input
        v-model="keyword"
        placeholder="搜索小区、写字楼、商户"
        clearable
        @keyup.enter="onSearch"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
        <template #append>
          <el-button :loading="searching" @click="onSearch">搜索</el-button>
        </template>
      </el-input>
    </div>

    <!-- 地图容器 -->
    <div class="map-container">
      <div ref="mapMountRef" class="map-mount"></div>
      <!-- 中心标记 -->
      <div class="center-marker">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="#FF6B35" stroke="#fff" stroke-width="1.5">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
          <circle cx="12" cy="9" r="2.5" fill="#fff" stroke="none"/>
        </svg>
      </div>
      <!-- 定位按钮 -->
      <div class="locate-btn" @click="moveToCurrent">
        <el-icon :size="20"><Aim /></el-icon>
      </div>
    </div>

    <!-- POI 列表 -->
    <div class="poi-list">
      <div v-if="searching" class="poi-empty">搜索中...</div>
      <div v-else-if="!poiList.length" class="poi-empty">
        {{ keyword ? '未找到相关地点' : '请搜索或拖动地图选择地址' }}
      </div>
      <div
        v-for="(poi, idx) in poiList"
        :key="idx"
        :class="['poi-item', selectedIndex === idx && 'active']"
        @click="selectPoi(idx)"
      >
        <div class="poi-body">
          <div class="poi-name">{{ poi.name }}</div>
          <div class="poi-address">{{ poi.address }}</div>
        </div>
        <el-icon v-if="selectedIndex === idx" color="#FF6B35"><Check /></el-icon>
      </div>
    </div>

    <!-- 底部操作 -->
    <div class="footer">
      <div class="footer-info">
        <div class="footer-name">{{ selected.name || '请选择地址' }}</div>
        <div class="footer-address">{{ selected.address || '' }}</div>
      </div>
      <el-button type="primary" @click="confirm">确认选点</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { Search, Aim, Check } from '@element-plus/icons-vue'
import { loadAMap, reverseGeocode, searchPOI } from '@/utils/amap'
import { ElMessage } from 'element-plus'

const props = defineProps<{
  initialLongitude?: number
  initialLatitude?: number
}>()

const emit = defineEmits<{
  (e: 'select', poi: {
    name: string
    address: string
    longitude: number
    latitude: number
  }): void
}>()

const keyword = ref('')
const searching = ref(false)
const selectedIndex = ref(0)
const poiList = ref<any[]>([])
const mapMountRef = ref<HTMLElement | null>(null)

const center = ref({
  longitude: props.initialLongitude || 112.424380,
  latitude: props.initialLatitude || 34.657050,
})

const selected = computed(() => poiList.value[selectedIndex.value] || {})

let AMapInstance: any = null
let mapInstance: any = null

onMounted(() => {
  initMap()
})

async function initMap() {
  try {
    AMapInstance = await loadAMap()
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 100))

    const mountEl = mapMountRef.value as any
    if (!mountEl) return

    let mountDom: HTMLElement = mountEl
    // 如果是自定义元素，创建内部真实div
    if (mountDom.tagName && !mountDom.tagName.toLowerCase().startsWith('div')) {
      let innerDiv = mountDom.querySelector('.amap-inner-div') as HTMLElement
      if (!innerDiv) {
        innerDiv = document.createElement('div')
        innerDiv.className = 'amap-inner-div'
        innerDiv.style.width = '100%'
        innerDiv.style.height = '100%'
        mountDom.appendChild(innerDiv)
      }
      mountDom = innerDiv
    }

    if (!mountDom || mountDom.offsetWidth === 0) {
      ElMessage.error('地图容器未渲染')
      return
    }

    mapInstance = new AMapInstance.Map(mountDom, {
      zoom: 16,
      center: [center.value.longitude, center.value.latitude],
      resizeEnable: true,
    })

    // 地图拖动结束后反向地理编码
    mapInstance.on('moveend', () => {
      const c = mapInstance.getCenter()
      center.value = { longitude: c.getLng(), latitude: c.getLat() }
      doReverseGeocode(c.getLng(), c.getLat())
    })
  } catch (e: any) {
    console.error('地图初始化失败', e)
    ElMessage.error('地图加载失败：' + (e?.message || '未知错误'))
  }
}

async function doReverseGeocode(lng: number, lat: number) {
  const result = await reverseGeocode(lng, lat)
  if (result.address) {
    poiList.value = [{
      name: result.address,
      address: result.address,
      longitude: lng,
      latitude: lat,
    }]
    selectedIndex.value = 0
  }
}

async function onSearch() {
  if (!keyword.value.trim()) return
  searching.value = true
  try {
    const list = await searchPOI(keyword.value)
    poiList.value = list
    if (list.length) {
      selectedIndex.value = 0
      selectPoi(0)
    } else {
      ElMessage.info('未找到相关地点')
    }
  } finally {
    searching.value = false
  }
}

function selectPoi(idx: number) {
  selectedIndex.value = idx
  const poi = poiList.value[idx]
  if (poi) {
    center.value = { longitude: poi.longitude, latitude: poi.latitude }
    if (mapInstance) {
      mapInstance.setCenter([poi.longitude, poi.latitude])
    }
  }
}

function moveToCurrent() {
  if (!AMapInstance) return
  AMapInstance.plugin('AMap.Geolocation', () => {
    const geolocation = new AMapInstance.Geolocation({
      enableHighAccuracy: true,
      timeout: 10000,
    })
    geolocation.getCurrentPosition((status: string, result: any) => {
      if (status === 'complete') {
        const lng = result.position.getLng()
        const lat = result.position.getLat()
        center.value = { longitude: lng, latitude: lat }
        if (mapInstance) {
          mapInstance.setCenter([lng, lat])
        }
        doReverseGeocode(lng, lat)
      } else {
        ElMessage.warning('获取定位失败，请手动选择地址')
      }
    })
  })
}

function confirm() {
  const poi = selected.value
  if (!poi.name) {
    ElMessage.warning('请选择地址')
    return
  }
  emit('select', poi)
}
</script>

<style lang="scss" scoped>
.map-picker {
  display: flex;
  flex-direction: column;
  height: 600px;
  background: #fff;
}

.search-bar {
  padding: 12px;
  border-bottom: 1px solid #eee;
}

.map-container {
  position: relative;
  height: 350px;
  background: #e8f4f8;
}

.map-mount {
  width: 100%;
  height: 100%;
}

.center-marker {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -100%);
  pointer-events: none;
  z-index: 5;
}

.locate-btn {
  position: absolute;
  right: 12px;
  bottom: 12px;
  width: 40px;
  height: 40px;
  background: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  z-index: 5;
  color: #FF6B35;
}

.poi-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px;
}

.poi-empty {
  text-align: center;
  padding: 40px 0;
  font-size: 13px;
  color: #999;
}

.poi-item {
  display: flex;
  align-items: center;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid transparent;
  margin-bottom: 6px;
}

.poi-item:hover {
  background: #f5f5f7;
}

.poi-item.active {
  background: rgba(255, 107, 53, 0.05);
  border-color: #FF6B35;
}

.poi-body {
  flex: 1;
  min-width: 0;
}

.poi-name {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.poi-address {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.footer {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-top: 1px solid #eee;
}

.footer-info {
  flex: 1;
  min-width: 0;
}

.footer-name {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.footer-address {
  font-size: 12px;
  color: #999;
  margin-top: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
