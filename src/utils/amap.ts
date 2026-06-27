/**
 * 高德地图工具类（商家端）
 *
 * 功能：
 * 1. 加载高德地图 JS API（H5端）
 * 2. POI 搜索 / 反向地理编码
 * 3. 计算两点距离（用于骑手到商家的距离）
 * 4. 打开导航
 *
 * 重要说明：
 * 1. 2021年12月之后创建的高德key必须配合安全密钥(securityJsCode)使用
 * 2. 或在高德开放平台控制台为该key配置"域名白名单"（如 localhost、127.0.0.1）
 * 3. 否则会报 INVALID_USER_SCODE 错误
 */

// 高德Web端JS API key（与manifest.json中sdkConfigs.maps.amap.key保持一致）
const AMAP_KEY = '8a7944b39971ba616fe55a9f85dffffa'
// 高德地图 Web端 JS API 安全密钥
const AMAP_SECURITY_CODE = '7ace682b77e4a3e373591681eee518aa'
const AMAP_PLUGINS = 'AMap.Geolocation,AMap.Driving,AMap.PlaceSearch,AMap.Geocoder,AMap.GeometryUtil'

let amapLoadPromise: any = null

/**
 * 动态加载高德地图 JS API
 * 多次调用只会加载一次，返回同一个 Promise
 */
export function loadAMap(): Promise<any> {
  if (amapLoadPromise) {
    return amapLoadPromise
  }

  amapLoadPromise = new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && (window as any).AMap) {
      resolve((window as any).AMap)
      return
    }

    // 设置安全密钥（必须在加载AMap脚本之前设置）
    if (AMAP_SECURITY_CODE) {
      (window as any)._AMapSecurityConfig = {
        securityJsCode: AMAP_SECURITY_CODE,
      }
    }

    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.async = true
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}&plugin=${AMAP_PLUGINS}`

    script.onload = () => {
      if ((window as any).AMap) {
        resolve((window as any).AMap)
      } else {
        reject(new Error('高德地图加载失败'))
      }
    }
    script.onerror = () => {
      amapLoadPromise = null
      reject(new Error('高德地图脚本加载失败'))
    }

    document.head.appendChild(script)
  })

  return amapLoadPromise
}

/**
 * 计算两点之间的距离（米）
 * 优先使用 AMap.GeometryUtil，兜底使用 Haversine 公式
 */
export function calculateDistance(
  lng1: number,
  lat1: number,
  lng2: number,
  lat2: number
): number {
  if (
    typeof lng1 !== 'number' ||
    typeof lat1 !== 'number' ||
    typeof lng2 !== 'number' ||
    typeof lat2 !== 'number'
  ) {
    return 0
  }

  try {
    const AMap = (window as any).AMap
    if (AMap && AMap.GeometryUtil && typeof AMap.GeometryUtil.distance === 'function') {
      const d = AMap.GeometryUtil.distance([lng1, lat1], [lng2, lat2])
      if (typeof d === 'number' && !isNaN(d) && d >= 0) {
        return Math.round(d)
      }
    }
  } catch (e) {
    // 兜底用 Haversine
  }

  return haversineDistance(lng1, lat1, lng2, lat2)
}

/**
 * Haversine 公式计算两点间距离（米）
 */
function haversineDistance(
  lng1: number,
  lat1: number,
  lng2: number,
  lat2: number
): number {
  const EARTH_RADIUS = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(EARTH_RADIUS * c)
}

/**
 * 格式化距离显示
 */
export function formatDistance(meters: number): string {
  if (!meters || meters <= 0) return '未知'
  if (meters < 1000) {
    return `${meters}米`
  }
  return `${(meters / 1000).toFixed(1)}公里`
}

/**
 * 打开导航（跳转到高德地图）
 */
export function openNavigation(
  lng: number,
  lat: number,
  name?: string,
  address?: string
): void {
  if (typeof window !== 'undefined') {
    const url = `https://uri.amap.com/navigation?to=${lng},${lat},${encodeURIComponent(name || '目的地')}&mode=car&policy=1&src=weizhenzu-merchant&coordinate=gaode&callnative=1`
    window.open(url, '_blank')
    return
  }
}

/**
 * 反向地理编码：经纬度 -> 地址
 */
export async function reverseGeocode(lng: number, lat: number): Promise<{
  address: string
  province?: string
  city?: string
  district?: string
}> {
  try {
    const AMap = await loadAMap()
    return new Promise((resolve) => {
      AMap.plugin('AMap.Geocoder', () => {
        const geocoder = new AMap.Geocoder()
        geocoder.getAddress([lng, lat], (status: string, result: any) => {
          if (status === 'complete' && result.info === 'OK') {
            const addr = result.regeocode
            resolve({
              address: addr.formattedAddress || '',
              province: addr.addressComponent?.province || '',
              city: addr.addressComponent?.city || '',
              district: addr.addressComponent?.district || '',
            })
          } else {
            resolve({ address: '' })
          }
        })
      })
    })
  } catch (e) {
    return { address: '' }
  }
}

/**
 * POI 搜索：关键词 -> POI列表
 */
export async function searchPOI(keyword: string, city?: string): Promise<Array<{
  name: string
  address: string
  longitude: number
  latitude: number
}>> {
  if (!keyword.trim()) return []
  try {
    const AMap = await loadAMap()
    return new Promise((resolve) => {
      AMap.plugin('AMap.PlaceSearch', () => {
        const placeSearch = new AMap.PlaceSearch({
          pageSize: 20,
          pageIndex: 1,
          city: city || '全国',
        })
        placeSearch.search(keyword, (status: string, result: any) => {
          if (status === 'complete' && result.info === 'OK' && result.poiList) {
            const list = result.poiList.pois.map((poi: any) => ({
              name: poi.name,
              address: poi.address || poi.cityname + poi.adname,
              longitude: poi.location.getLng(),
              latitude: poi.location.getLat(),
            }))
            resolve(list)
          } else {
            resolve([])
          }
        })
      })
    })
  } catch (e) {
    return []
  }
}
