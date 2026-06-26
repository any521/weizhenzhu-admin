// 通用分页响应（前端统一格式）
export interface PaginationResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

// 后端原始分页响应
export interface PageResultBackend<T> {
  records: T[]
  total: number
  current: number
  size: number
  pages: number
}

// 通用接口响应
export interface ApiResult<T = unknown> {
  code: number
  data: T
  message: string
}

// 用户
export interface User {
  id: number
  username: string
  nickname: string
  phone: string
  email?: string
  avatar?: string
  status: number
  type: 'merchant' | 'admin' | 'user'
  gender?: number
  birthday?: string
  balance?: number
  points?: number
  createTime: string
}

// 商家
export interface Merchant {
  id: number
  name: string
  logo?: string
  contactPerson: string
  address: string
  phone: string
  status: number
  auditStatus: number
  operateStatus: number
  rating: number
  monthSales?: number
  monthlySales?: number
  createTime: string
  qualification?: string
  /** 是否支持外卖配送：1支持 0不支持 */
  supportDelivery?: number
  /** 是否支持到店自取：1支持 0不支持 */
  supportPickup?: number
}

// 骑手
export interface Rider {
  id: number
  name: string
  phone: string
  phoneRaw?: string
  avatar?: string
  idCard?: string
  gender?: number
  level?: number
  realNameStatus?: number
  status: number
  onDuty?: number
  longitude?: number
  latitude?: number
  locationTime?: string
  totalOrders: number
  monthOrders: number
  rating: number
  balance?: number
  lastLoginAt?: string
  createdAt: string
}

// 订单
export interface Order {
  id: number
  orderNo: string
  userId?: number
  userName?: string
  userNickname?: string
  userPhone?: string
  merchantId?: number
  merchantName?: string
  riderId?: number
  riderName?: string
  status: number
  statusDesc?: string
  payStatus?: number
  payStatusDesc?: string
  totalAmount: number
  payAmount: number
  deliveryFee?: number
  packingFee?: number
  discountAmount?: number
  merchantDiscount?: number
  platformDiscount?: number
  couponAmount?: number
  remark?: string
  payType?: number
  createdAt?: string
  createTime: string
  payTime?: string
  receiveTime?: string
  completeTime?: string
  cancelTime?: string
  merchantAcceptTime?: string
  riderTakeTime?: string
  deliverTime?: string
  expectedTime?: string
  items?: OrderItem[]
}

export interface OrderItem {
  id?: number
  dishId?: number
  dishName?: string
  dishImage?: string
  specId?: number
  specName?: string
  unitPrice?: number
  quantity?: number
  subtotal?: number
}

// 菜品
export interface Dish {
  id: number
  name: string
  price: number
  originalPrice?: number
  image?: string
  images?: string[]
  categoryId: number
  categoryName?: string
  platformCategoryId?: number
  platformCategoryName?: string
  description?: string
  stock?: number
  monthSales?: number
  totalSales?: number
  sales?: number
  rating?: number
  spicy?: number
  tags?: string[]
  sort?: number
  status: number
  createTime?: string
}

// 分类
export interface Category {
  id: number
  name: string
  /** 分类描述 */
  description?: string
  icon: string
  /** 颜色（用于客户端展示分类背景色） */
  color?: string
  sort: number
  status: number
  createTime: string
}

// 评价
export interface Review {
  id: number
  orderId?: number
  orderNo?: string
  userName?: string
  userNickname?: string
  userAvatar?: string
  merchantName?: string
  rating: number
  tasteScore?: number
  packingScore?: number
  deliveryScore?: number
  content: string
  reply?: string
  merchantReply?: string
  images?: string[]
  tags?: string[]
  status?: number
  createTime: string
}

// 财务统计
export interface FinanceStats {
  todayIncome: number
  todayOrderCount: number
  weekIncome: number
  monthIncome: number
  totalIncome: number
  refundAmount: number
}

// 图表数据
export interface ChartData {
  dates: string[]
  values: number[]
  legend: string[]
  series: { name: string; data: number[] }[]
}

// B端仪表盘统计
export interface MerchantDashboardStats {
  merchantName?: string
  rating?: number
  monthSales?: number
  isOpen?: number
  todayOrders: number
  todayRevenue: number
  pendingOrders: number
  totalOrders: number
  dishCount: number
  reviewCount: number
}

// 登录信息（与后端 LoginVO 保持一致）
export interface LoginResult {
  token: string
  refreshToken: string
  userId: number
  nickname: string
  avatar?: string
  userType: number
}

// 优惠券类型：1满减 2折扣 3无门槛/代金券
export type CouponType = 1 | 2 | 3

// 优惠券
export interface Coupon {
  id?: number
  merchantId?: number
  merchantName?: string
  name: string
  type: CouponType
  amount?: number
  threshold?: number
  discount?: number
  maxDiscount?: number
  totalCount: number
  receivedCount?: number
  usedCount?: number
  perLimit?: number
  validType: 1 | 2
  validStart?: string
  validEnd?: string
  validDays?: number
  scope?: number
  scopeIds?: string
  status?: number
  createdAt?: string
  typeDesc?: string
  canReceive?: boolean
}

// 退款申请
export interface Refund {
  id: number
  orderNo: string
  userName: string
  merchantName: string
  amount: number
  reason: string
  status: number
  applyTime: string
  auditTime?: string
  auditor?: string
}

// 风控预警
export interface RiskWarning {
  id: number
  type: string
  target: string
  level: 'high' | 'medium' | 'low'
  description: string
  createTime: string
  status: number
}

// 操作日志
export interface OperationLog {
  id: number
  operator: string
  module: string
  action: string
  ip: string
  createTime: string
  result: number
  detail?: string
}

// 平台公告
export interface Announcement {
  id: number
  title: string
  content: string
  createTime: string
}

// 待处理事项
export interface TodoItem {
  id: number
  title: string
  type: string
  count: number
}

// 财务报表
export interface FinanceReport {
  date: string
  orderCount: number
  income: number
  commission: number
  settlement: number
}

// 系统设置
export interface SystemSettings {
  siteName: string
  servicePhone: string
  commissionRate: number
  minDeliveryFee: number
  riderShareRate: number
  userAgreement: string
  privacyPolicy: string
}

// 促销活动
export interface Promotion {
  id?: number
  name: string
  type: 'fullReduction' | 'discount' | 'coupon'
  typeText?: string
  startTime: string
  endTime: string
  status: number
  content: string
}

// 文件上传响应
export interface UploadResult {
  url: string
  fileName?: string
  originalName?: string
  size?: number
}

// ============ DTO 类型 ============

/** 通用导出参数 */
export interface ExportParams {
  /** 导出格式：xlsx / csv */
  format?: 'xlsx' | 'csv'
  /** 筛选参数 */
  [key: string]: any
}

/** 用户创建 DTO */
export interface UserCreateDTO {
  username: string
  phone: string
  password: string
  nickname?: string
  avatar?: string
  gender?: number
  birthday?: string
  status?: number
  email?: string
}

/** 用户更新 DTO */
export interface UserUpdateDTO {
  username?: string
  nickname?: string
  avatar?: string
  gender?: number
  birthday?: string
  status?: number
  email?: string
  phone?: string
  password?: string
}

/** 商家创建 DTO */
export interface MerchantCreateDTO {
  name: string
  phone: string
  password: string
  categoryId?: number
  contactPerson?: string
  contactPhone?: string
  province?: string
  city?: string
  district?: string
  address?: string
  longitude?: number
  latitude?: number
  description?: string
  announcement?: string
  logo?: string
  qualification?: string
}

/** 商家更新 DTO */
export interface MerchantUpdateDTO {
  name?: string
  phone?: string
  password?: string
  categoryId?: number
  contactPerson?: string
  contactPhone?: string
  province?: string
  city?: string
  district?: string
  address?: string
  longitude?: number
  latitude?: number
  description?: string
  announcement?: string
  logo?: string
  status?: number
}

/** 骑手创建 DTO */
export interface RiderCreateDTO {
  name: string
  phone: string
  password: string
  idCard?: string
  gender?: number
  status?: number
}

/** 骑手更新 DTO */
export interface RiderUpdateDTO {
  name?: string
  phone?: string
  password?: string
  idCard?: string
  gender?: number
  status?: number
}

/** 菜品更新 DTO */
export interface DishUpdateDTO {
  name?: string
  price?: number
  originalPrice?: number
  image?: string
  images?: string[]
  categoryId?: number
  platformCategoryId?: number
  description?: string
  stock?: number
  spicy?: number
  tags?: string[]
  sort?: number
  status?: number
}

/** 优惠券创建 DTO */
export interface CouponCreateDTO {
  merchantId?: number
  name: string
  type: CouponType
  amount?: number
  threshold?: number
  discount?: number
  maxDiscount?: number
  totalCount: number
  perLimit?: number
  validType: 1 | 2
  validStart?: string
  validEnd?: string
  validDays?: number
  scope?: number
  scopeIds?: string
  status?: number
}

/** 优惠券更新 DTO */
export interface CouponUpdateDTO {
  merchantId?: number
  name?: string
  type?: CouponType
  amount?: number
  threshold?: number
  discount?: number
  maxDiscount?: number
  totalCount?: number
  perLimit?: number
  validType?: 1 | 2
  validStart?: string
  validEnd?: string
  validDays?: number
  scope?: number
  scopeIds?: string
  status?: number
}

/** 分类创建 DTO（含颜色和图标） */
export interface CategoryCreateDTO {
  id?: number
  name: string
  icon: string
  /** 颜色（用于客户端展示分类背景色） */
  color?: string
  sort?: number
  status?: number
}

/** 分类更新 DTO（含颜色和图标） */
export interface CategoryUpdateDTO {
  name?: string
  icon?: string
  /** 颜色（用于客户端展示分类背景色） */
  color?: string
  sort?: number
  status?: number
}

/** 消息创建 DTO */
export interface MessageCreateDTO {
  /** 接收用户 ID */
  userId?: number
  /** 标题 */
  title: string
  /** 内容 */
  content: string
  /** 消息类型：1系统 2订单 3优惠 */
  type?: number
  /** 关联业务 ID */
  bizId?: number
}

// ============ 扩展实体类型 ============

/** 用户扩展（含更多字段） */
export interface UserDetail extends User {
  gender?: number
  birthday?: string
  balance?: number
  points?: number
}

/** 商家扩展（含更多字段） */
export interface MerchantDetail extends Merchant {
  categoryId?: number
  categoryName?: string
  contactPhone?: string
  province?: string
  city?: string
  district?: string
  longitude?: number
  latitude?: number
  description?: string
  announcement?: string
  openTime?: string
  deliveryRadius?: number
  minOrderAmount?: number
  deliveryFee?: number
  packingFee?: number
  isOpen?: number
  notice?: string
}

/** 骑手扩展（含更多字段） */
export interface RiderDetail extends Rider {
  onDuty?: number
  monthOrderCount?: number
  balance?: number
}

/** 菜品扩展（含商家信息） */
export interface DishDetail extends Dish {
  merchantId?: number
  merchantName?: string
}

/** 分类扩展（含颜色和图标） */
export interface CategoryDetail extends Category {
  color?: string
}

/** 评价扩展 */
export interface ReviewDetail extends Review {
  merchantId?: number
}

/** 退款扩展（含退款单号） */
export interface RefundDetail extends Refund {
  refundNo?: string
}

/** 操作日志扩展 */
export interface OperationLogDetail extends OperationLog {
  method?: string
  costTime?: number
  errorMsg?: string
}

/** 地址 */
export interface Address {
  id: number
  userId: number
  userName?: string
  userPhone?: string
  province?: string
  city?: string
  district?: string
  detail?: string
  fullAddress?: string
  longitude?: number
  latitude?: number
  isDefault?: number
  createTime?: string
}

/** 支付记录 */
export interface Payment {
  id: number
  paymentNo?: string
  orderNo?: string
  orderId?: number
  userId?: number
  userName?: string
  amount: number
  payType?: number
  payTypeDesc?: string
  status: number
  statusDesc?: string
  tradeNo?: string
  createTime?: string
  payTime?: string
}

/** 消息 */
export interface Message {
  id: number
  userId?: number
  title: string
  content: string
  type?: number
  typeDesc?: string
  isRead?: number
  bizId?: number
  createTime: string
}

/** 回收站条目 */
export interface RecycleBinItem {
  id: string
  type: string
  typeLabel: string
  title: string
  subtitle?: string
  deletedTime: string
}

/** 回收站支持类型 */
export interface RecycleBinTypes {
  types: string[]
  labels: Record<string, string>
}
