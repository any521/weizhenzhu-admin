// 用户类型
export type UserType = 'merchant' | 'admin'

export const UserTypeMap: Record<UserType, string> = {
  merchant: '商家',
  admin: '管理员',
}

// 订单状态（统一新状态码）
export const OrderStatus = {
  PENDING_PAY: 0,       // 待支付
  PENDING_ACCEPT: 1,    // 待接单
  MERCHANT_ACCEPTED: 2, // 备餐中（商家已接单）
  RIDER_ACCEPTED: 3,    // 骑手已接单
  /** @deprecated 已废弃，旧数据code=4统一映射为PREPARING(2) */
  WAITING_RIDER: 4,     // 等待骑手（已废弃，兼容旧数据）
  DELIVERING: 5,        // 配送中
  DELIVERED: 6,         // 已送达
  COMPLETED: 7,         // 已完成
  CANCELLED: 8,         // 已取消
  REFUNDING: 9,         // 退款中
  REFUNDED: 10,         // 已退款
  RIDER_ARRIVED: 11,    // 骑手已到店
} as const

export type OrderStatusType = (typeof OrderStatus)[keyof typeof OrderStatus]

export const OrderStatusMap: Record<number, string> = {
  [OrderStatus.PENDING_PAY]: '待支付',
  [OrderStatus.PENDING_ACCEPT]: '待接单',
  [OrderStatus.MERCHANT_ACCEPTED]: '备餐中',
  4: '备餐中', // 旧数据兼容：WAITING_RIDER 统一显示为备餐中
  [OrderStatus.RIDER_ACCEPTED]: '骑手已接单',
  [OrderStatus.RIDER_ARRIVED]: '骑手已到店',
  [OrderStatus.DELIVERING]: '配送中',
  [OrderStatus.DELIVERED]: '已送达',
  [OrderStatus.COMPLETED]: '已完成',
  [OrderStatus.CANCELLED]: '已取消',
  [OrderStatus.REFUNDING]: '退款中',
  [OrderStatus.REFUNDED]: '已退款',
}

/** 订单状态标签类型（用于Element Plus Tag颜色） */
export const OrderStatusTagType: Record<number, '' | 'success' | 'warning' | 'info' | 'danger' | 'primary'> = {
  [OrderStatus.PENDING_PAY]: 'warning',
  [OrderStatus.PENDING_ACCEPT]: 'danger',
  [OrderStatus.MERCHANT_ACCEPTED]: 'warning',
  4: 'warning', // 旧数据兼容：与备餐中同色
  [OrderStatus.RIDER_ACCEPTED]: 'primary',
  [OrderStatus.RIDER_ARRIVED]: 'primary',
  [OrderStatus.DELIVERING]: 'danger',
  [OrderStatus.DELIVERED]: 'success',
  [OrderStatus.COMPLETED]: 'info',
  [OrderStatus.CANCELLED]: 'info',
  [OrderStatus.REFUNDING]: 'danger',
  [OrderStatus.REFUNDED]: 'info',
}

// 审核状态
export const AuditStatus = {
  PENDING: 0,
  APPROVED: 1,
  REJECTED: 2,
} as const

export type AuditStatusType = (typeof AuditStatus)[keyof typeof AuditStatus]

export const AuditStatusMap: Record<number, string> = {
  [AuditStatus.PENDING]: '待审核',
  [AuditStatus.APPROVED]: '已通过',
  [AuditStatus.REJECTED]: '已拒绝',
}

// 通用状态
export const CommonStatus = {
  DISABLED: 0,
  ENABLED: 1,
} as const

export type CommonStatusType = (typeof CommonStatus)[keyof typeof CommonStatus]

export const CommonStatusMap: Record<number, string> = {
  [CommonStatus.DISABLED]: '禁用',
  [CommonStatus.ENABLED]: '启用',
}

// 分页默认值
export const DEFAULT_PAGE_SIZE = 10
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

// 本地存储键名
export const STORAGE_KEYS = {
  TOKEN: 'token',
  USER_INFO: 'user_info',
  USER_TYPE: 'user_type',
  SIDEBAR_COLLAPSED: 'sidebar_collapsed',
} as const