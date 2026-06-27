import { createApp } from 'vue'
import { createPinia } from 'pinia'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import NProgress from 'nprogress'
import 'nprogress/nprogress.css'

import App from './App.vue'
import router from './router'
import { setRouter } from './utils/request'

// 全局样式
import './styles/index.scss'

const app = createApp(App)

// 注册 Element Plus 图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

// NProgress 配置
NProgress.configure({ showSpinner: false })

// 将 router 注入 request 模块，避免循环依赖
setRouter(router)

app.use(createPinia())
app.use(router)

app.mount('#app')
