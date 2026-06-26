import type { RouteRecordRaw } from 'vue-router'
import AdminLayout from '@/layouts/AdminLayout.vue'
import Login from '@/views/login/index.vue'
import MerchantLogin from '@/views/merchant/login/index.vue'
import AdminLogin from '@/views/admin/login/index.vue'
import PlaceholderPage from '@/components/PlaceholderPage.vue'

// 商家端页面
import MerchantDashboard from '@/views/merchant/dashboard/index.vue'
import MerchantOrderList from '@/views/merchant/order/list.vue'
import MerchantOrderRealtime from '@/views/merchant/order/realtime.vue'
import MerchantDishList from '@/views/merchant/dish/list.vue'
import MerchantDishEdit from '@/views/merchant/dish/edit.vue'
import MerchantCategory from '@/views/merchant/category/index.vue'
import MerchantReview from '@/views/merchant/review/index.vue'
import MerchantPromotion from '@/views/merchant/promotion/index.vue'
import MerchantCoupon from '@/views/merchant/coupon/index.vue'
import MerchantSettings from '@/views/merchant/settings/index.vue'
import MerchantFinance from '@/views/merchant/finance/index.vue'
import MerchantStats from '@/views/merchant/stats/index.vue'
import MerchantRecycleBin from '@/views/merchant/recycle-bin/index.vue'
import Profile from '@/views/profile/index.vue'

// 管理员端页面
import AdminDashboard from '@/views/admin/dashboard/index.vue'
import AdminUser from '@/views/admin/user/index.vue'
import AdminMerchantIndex from '@/views/admin/merchant/index.vue'
import AdminMerchantAudit from '@/views/admin/merchant/audit.vue'
import AdminRider from '@/views/admin/rider/index.vue'
import AdminOrder from '@/views/admin/order/index.vue'
import AdminRefund from '@/views/admin/refund/index.vue'
import AdminReview from '@/views/admin/review/index.vue'
import AdminCoupon from '@/views/admin/coupon/index.vue'
import AdminCategory from '@/views/admin/category/index.vue'
import AdminDish from '@/views/admin/dish/index.vue'
import AdminFinance from '@/views/admin/finance/index.vue'
import AdminRisk from '@/views/admin/risk/index.vue'
import AdminLog from '@/views/admin/log/index.vue'
import AdminSystem from '@/views/admin/system/index.vue'
import AdminRecycleBin from '@/views/admin/recycle-bin/index.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { title: '登录', public: true },
  },
  {
    path: '/merchant/login',
    name: 'MerchantLogin',
    component: MerchantLogin,
    meta: { title: '商家登录', public: true },
  },
  {
    path: '/admin/login',
    name: 'AdminLogin',
    component: AdminLogin,
    meta: { title: '管理员登录', public: true },
  },
  {
    path: '/merchant',
    component: AdminLayout,
    redirect: '/merchant/dashboard',
    meta: { type: 'merchant' },
    children: [
      { path: 'dashboard', name: 'MerchantDashboard', component: MerchantDashboard, meta: { title: '商家工作台' } },
      { path: 'orders', name: 'MerchantOrderList', component: MerchantOrderList, meta: { title: '订单列表' } },
      { path: 'orders/realtime', name: 'MerchantOrderRealtime', component: MerchantOrderRealtime, meta: { title: '实时订单' } },
      { path: 'dishes', name: 'MerchantDishList', component: MerchantDishList, meta: { title: '菜品管理' } },
      { path: 'dishes/edit/:id?', name: 'MerchantDishEdit', component: MerchantDishEdit, meta: { title: '编辑菜品' } },
      { path: 'categories', name: 'MerchantCategory', component: MerchantCategory, meta: { title: '分类管理' } },
      { path: 'reviews', name: 'MerchantReview', component: MerchantReview, meta: { title: '评价管理' } },
      { path: 'promotions', name: 'MerchantPromotion', component: MerchantPromotion, meta: { title: '营销活动' } },
      { path: 'coupons', name: 'MerchantCoupon', component: MerchantCoupon, meta: { title: '优惠券管理' } },
      { path: 'settings', name: 'MerchantSettings', component: MerchantSettings, meta: { title: '店铺设置' } },
      { path: 'finance', name: 'MerchantFinance', component: MerchantFinance, meta: { title: '财务中心' } },
      { path: 'stats', name: 'MerchantStats', component: MerchantStats, meta: { title: '数据统计' } },
      { path: 'recycle-bin', name: 'MerchantRecycleBin', component: MerchantRecycleBin, meta: { title: '回收站' } },
      { path: 'profile', name: 'MerchantProfile', component: Profile, meta: { title: '个人设置' } },
    ],
  },
  {
    path: '/admin',
    component: AdminLayout,
    redirect: '/admin/dashboard',
    meta: { type: 'admin' },
    children: [
      { path: 'dashboard', name: 'AdminDashboard', component: AdminDashboard, meta: { title: '管理控制台' } },
      { path: 'users', name: 'AdminUser', component: AdminUser, meta: { title: '用户管理' } },
      { path: 'merchants', name: 'AdminMerchantIndex', component: AdminMerchantIndex, meta: { title: '商家列表' } },
      { path: 'merchants/audit', name: 'AdminMerchantAudit', component: AdminMerchantAudit, meta: { title: '商家审核' } },
      { path: 'riders', name: 'AdminRider', component: AdminRider, meta: { title: '骑手管理' } },
      { path: 'orders', name: 'AdminOrder', component: AdminOrder, meta: { title: '订单管理' } },
      { path: 'refunds', name: 'AdminRefund', component: AdminRefund, meta: { title: '退款管理' } },
      { path: 'reviews', name: 'AdminReview', component: AdminReview, meta: { title: '评价管理' } },
      { path: 'coupons', name: 'AdminCoupon', component: AdminCoupon, meta: { title: '优惠券管理' } },
      { path: 'categories', name: 'AdminCategory', component: AdminCategory, meta: { title: '品类管理' } },
      { path: 'dishes', name: 'AdminDish', component: AdminDish, meta: { title: '菜品管理' } },
      { path: 'finance', name: 'AdminFinance', component: AdminFinance, meta: { title: '财务管理' } },
      { path: 'risk', name: 'AdminRisk', component: AdminRisk, meta: { title: '风控管理' } },
      { path: 'logs', name: 'AdminLog', component: AdminLog, meta: { title: '操作日志' } },
      { path: 'recycle-bin', name: 'AdminRecycleBin', component: AdminRecycleBin, meta: { title: '回收站' } },
      { path: 'system', name: 'AdminSystem', component: AdminSystem, meta: { title: '系统设置' } },
      { path: 'profile', name: 'AdminProfile', component: Profile, meta: { title: '个人设置' } },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: PlaceholderPage,
    meta: { title: '页面不存在' },
  },
]

export default routes
