// 通用接口响应
export interface ApiResult<T = unknown> {
  code: number
  data: T
  message: string
}

// 通用分页响应
export interface PageResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

// 用户类型（前端路由/菜单维度）
export type UserType = 'merchant' | 'admin'

// 后端用户类型数值映射
export const UserTypeValue: Record<UserType, number> = {
  merchant: 2,
  admin: 4,
}

// 登录返回（与后端 LoginVO 保持一致）
export interface LoginVO {
  token: string
  refreshToken: string
  userId: number
  nickname: string
  avatar?: string
  userType: number
}

// 当前登录用户信息（前端存储用）
export interface UserInfoVO {
  id: number
  username?: string
  nickname?: string
  avatar?: string
  phone?: string
  email?: string
  type: UserType
  status?: number
  createTime?: string
}

// 商家信息
export interface MerchantVO {
  id: number
  name: string
  logo?: string
  contactPerson: string
  address: string
  phone: string
  status: number
  auditStatus: number
  rating: number
  monthlySales: number
  createTime: string
  qualification?: string
}

// 订单信息
export interface OrderVO {
  id: number
  orderNo: string
  userId: number
  userName: string
  merchantId: number
  merchantName: string
  riderId?: number
  riderName?: string
  status: number
  totalAmount: number
  payAmount: number
  deliveryFee: number
  discountAmount: number
  createTime: string
  payTime?: string
  receiveTime?: string
  completeTime?: string
}

// 刷新 Token 响应
export interface RefreshTokenResult {
  token: string
  refreshToken: string
}

// 错误码枚举
export enum ApiErrorCode {
  SUCCESS = 200,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  INTERNAL_ERROR = 500,
  BUSINESS_ERROR = 1000,
}
