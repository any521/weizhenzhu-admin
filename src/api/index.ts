import request from '@/utils/request'
import { getStorage } from '@/utils/storage'
import type {
  User,
  Merchant,
  Rider,
  Order,
  Dish,
  Category,
  Review,
  FinanceStats,
  ChartData,
  LoginResult,
  PaginationResult,
  PageResultBackend,
  ApiResult,
  Coupon,
  Refund,
  RiskWarning,
  OperationLog,
  Announcement,
  TodoItem,
  FinanceReport,
  SystemSettings,
  MerchantDashboardStats,
  Promotion,
  UploadResult,
  UserCreateDTO,
  UserUpdateDTO,
  MerchantCreateDTO,
  MerchantUpdateDTO,
  RiderCreateDTO,
  RiderUpdateDTO,
  DishUpdateDTO,
  CouponCreateDTO,
  CouponUpdateDTO,
  CategoryCreateDTO,
  CategoryUpdateDTO,
  MessageCreateDTO,
  ExportParams,
  Address,
  Payment,
  Message,
  RecycleBinItem,
  RecycleBinTypes,
} from './types'
import type { UserType } from '@/utils/constants'

function currentUserType(): UserType {
  return getStorage<UserType>('user_type') || 'admin'
}

function prefix(): string {
  return currentUserType() === 'admin' ? 'admin' : 'merchant'
}

/**
 * 将后端分页响应转换为前端统一分页格式
 */
function normalizePage<T>(data: PageResultBackend<T> | PaginationResult<T>): PaginationResult<T> {
  if (Array.isArray((data as PageResultBackend<T>).records)) {
    const backend = data as PageResultBackend<T>
    return {
      list: backend.records,
      total: backend.total,
      page: backend.current,
      pageSize: backend.size,
    }
  }
  return data as PaginationResult<T>
}

export const api = {
  // 认证相关
  auth: {
    async login(username: string, password: string, type: UserType): Promise<ApiResult<LoginResult>> {
      return request<ApiResult<LoginResult>>({
        method: 'post',
        url: `/api/${type}/auth/login/password`,
        data: type === 'admin' ? { username, password } : { phone: username, password },
      })
    },

    async smsLogin(phone: string, code: string, type: UserType): Promise<ApiResult<LoginResult>> {
      return request<ApiResult<LoginResult>>({
        method: 'post',
        url: `/api/${type}/auth/login/sms`,
        data: { phone, code, userType: type === 'admin' ? 4 : type === 'merchant' ? 2 : 3 },
      })
    },

    async sendSmsCode(phone: string, type: UserType): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'post',
        url: `/api/${type}/auth/sms-code`,
        data: { phone, scene: 'LOGIN' },
      })
    },

    async logout(): Promise<ApiResult<null>> {
      const type = currentUserType()
      return request<ApiResult<null>>({
        method: 'post',
        url: `/api/${type}/auth/logout`,
      })
    },

    async getUserInfo(): Promise<ApiResult<User>> {
      const type = currentUserType()
      const url = type === 'merchant' ? '/api/merchant/auth/me' : '/api/admin/auth/info'
      return request<ApiResult<User>>({
        method: 'get',
        url,
      })
    },

    async getMerchantInfo(): Promise<ApiResult<Merchant>> {
      return request<ApiResult<Merchant>>({
        method: 'get',
        url: '/api/merchant/auth/me',
      })
    },
  },

  // 用户相关
  user: {
    async getList(params: {
      page?: number
      pageSize?: number
      keyword?: string
      phone?: string
      status?: number
      startDate?: string
      endDate?: string
      sortField?: string
      sortOrder?: 'asc' | 'desc'
    } = {}): Promise<ApiResult<PaginationResult<User>>> {
      const {
        page = 1,
        pageSize = 10,
        keyword,
        phone,
        status,
        startDate,
        endDate,
        sortField,
        sortOrder,
      } = params
      const res = await request<ApiResult<PageResultBackend<User>>>({
        method: 'get',
        url: '/api/admin/users',
        params: { page, pageSize, keyword, phone, status, startDate, endDate, sortField, sortOrder },
      })
      return { ...res, data: normalizePage(res.data) }
    },

    async getDetail(id: number): Promise<ApiResult<User>> {
      return request<ApiResult<User>>({
        method: 'get',
        url: `/api/admin/users/${id}`,
      })
    },

    /** 用户详情（别名，等价于 getDetail） */
    async detail(id: number): Promise<ApiResult<User>> {
      return this.getDetail(id)
    },

    async add(data: UserCreateDTO): Promise<ApiResult<number>> {
      return request<ApiResult<number>>({
        method: 'post',
        url: '/api/admin/users',
        data,
      })
    },

    /** 创建用户（别名，等价于 add） */
    async create(data: UserCreateDTO): Promise<ApiResult<number>> {
      return this.add(data)
    },

    async update(id: number, data: UserUpdateDTO): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'put',
        url: `/api/admin/users/${id}`,
        data,
      })
    },

    async delete(id: number): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'delete',
        url: `/api/admin/users/${id}`,
      })
    },

    /** 批量删除用户 */
    async batchDelete(ids: number[]): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'delete',
        url: '/api/admin/users/batch',
        data: { ids },
      })
    },

    async updateStatus(id: number, status: number): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'put',
        url: `/api/admin/users/${id}/status/${status}`,
      })
    },

    async export(params: ExportParams = {}): Promise<Blob> {
      const res = await request<Blob>({
        method: 'get',
        url: '/api/admin/users/export',
        params,
        responseType: 'blob',
      })
      return res as unknown as Blob
    },

    /** 导出 CSV（等价于 export，指定 format=csv） */
    async exportCsv(params: ExportParams = {}): Promise<Blob> {
      return this.export({ ...params, format: 'csv' })
    },
  },

  // 商家相关
  merchant: {
    async getList(params: {
      page?: number
      pageSize?: number
      keyword?: string
      phone?: string
      categoryId?: number
      status?: number
      auditStatus?: number
      startDate?: string
      endDate?: string
      sortField?: string
      sortOrder?: 'asc' | 'desc'
    } = {}): Promise<ApiResult<PaginationResult<Merchant>>> {
      const {
        page = 1,
        pageSize = 10,
        keyword,
        phone,
        categoryId,
        status,
        auditStatus,
        startDate,
        endDate,
        sortField,
        sortOrder,
      } = params
      const res = await request<ApiResult<PageResultBackend<Merchant>>>({
        method: 'get',
        url: '/api/admin/merchants',
        params: { page, pageSize, keyword, phone, categoryId, status, auditStatus, startDate, endDate, sortField, sortOrder },
      })
      return { ...res, data: normalizePage(res.data) }
    },

    async getDetail(id: number): Promise<ApiResult<Merchant>> {
      return request<ApiResult<Merchant>>({
        method: 'get',
        url: `/api/admin/merchants/${id}`,
      })
    },

    /** 商家详情（别名，等价于 getDetail） */
    async detail(id: number): Promise<ApiResult<Merchant>> {
      return this.getDetail(id)
    },

    async add(data: MerchantCreateDTO): Promise<ApiResult<number>> {
      return request<ApiResult<number>>({
        method: 'post',
        url: '/api/admin/merchants',
        data,
      })
    },

    /** 创建商家（别名，等价于 add） */
    async create(data: MerchantCreateDTO): Promise<ApiResult<number>> {
      return this.add(data)
    },

    async update(id: number, data: MerchantUpdateDTO): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'put',
        url: `/api/admin/merchants/${id}`,
        data,
      })
    },

    async delete(id: number): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'delete',
        url: `/api/admin/merchants/${id}`,
      })
    },

    /** 批量删除商家 */
    async batchDelete(ids: number[]): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'delete',
        url: '/api/admin/merchants/batch',
        data: { ids },
      })
    },

    async audit(id: number, status: number, reason?: string): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'put',
        url: `/api/admin/merchants/${id}/audit`,
        data: { status, reason },
      })
    },

    async updateStatus(id: number, status: number): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'put',
        url: `/api/admin/merchants/${id}/status/${status}`,
      })
    },

    async export(params: ExportParams = {}): Promise<Blob> {
      const res = await request<Blob>({
        method: 'get',
        url: '/api/admin/merchants/export',
        params,
        responseType: 'blob',
      })
      return res as unknown as Blob
    },

    /** 导出 CSV（等价于 export，指定 format=csv） */
    async exportCsv(params: ExportParams = {}): Promise<Blob> {
      return this.export({ ...params, format: 'csv' })
    },
  },

  // 骑手相关
  rider: {
    async getList(params: {
      page?: number
      pageSize?: number
      keyword?: string
      phone?: string
      status?: number
      onDuty?: number
      sortField?: string
      sortOrder?: 'asc' | 'desc'
    } = {}): Promise<ApiResult<PaginationResult<Rider>>> {
      const {
        page = 1,
        pageSize = 10,
        keyword,
        phone,
        status,
        onDuty,
        sortField,
        sortOrder,
      } = params
      const res = await request<ApiResult<PageResultBackend<Rider>>>({
        method: 'get',
        url: '/api/admin/riders',
        params: { page, pageSize, keyword, phone, status, onDuty, sortField, sortOrder },
      })
      return { ...res, data: normalizePage(res.data) }
    },

    async getDetail(id: number): Promise<ApiResult<Rider>> {
      return request<ApiResult<Rider>>({
        method: 'get',
        url: `/api/admin/riders/${id}`,
      })
    },

    /** 骑手详情（别名，等价于 getDetail） */
    async detail(id: number): Promise<ApiResult<Rider>> {
      return this.getDetail(id)
    },

    async add(data: RiderCreateDTO): Promise<ApiResult<number>> {
      return request<ApiResult<number>>({
        method: 'post',
        url: '/api/admin/riders',
        data,
      })
    },

    /** 创建骑手（别名，等价于 add） */
    async create(data: RiderCreateDTO): Promise<ApiResult<number>> {
      return this.add(data)
    },

    async update(id: number, data: RiderUpdateDTO): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'put',
        url: `/api/admin/riders/${id}`,
        data,
      })
    },

    async delete(id: number): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'delete',
        url: `/api/admin/riders/${id}`,
      })
    },

    /** 批量删除骑手 */
    async batchDelete(ids: number[]): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'delete',
        url: '/api/admin/riders/batch',
        data: { ids },
      })
    },

    async updateStatus(id: number, status: number): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'put',
        url: `/api/admin/riders/${id}/status/${status}`,
      })
    },

    async export(params: ExportParams = {}): Promise<Blob> {
      const res = await request<Blob>({
        method: 'get',
        url: '/api/admin/riders/export',
        params,
        responseType: 'blob',
      })
      return res as unknown as Blob
    },

    /** 导出 CSV（等价于 export，指定 format=csv） */
    async exportCsv(params: ExportParams = {}): Promise<Blob> {
      return this.export({ ...params, format: 'csv' })
    },
  },

  // 订单相关
  order: {
    async getList(params: {
      current?: number
      size?: number
      status?: number
      payStatus?: number
      orderNo?: string
      merchantName?: string
      userName?: string
      startDate?: string
      endDate?: string
      sortField?: string
      sortOrder?: 'asc' | 'desc'
    } = {}): Promise<ApiResult<PaginationResult<Order>>> {
      const {
        current = 1,
        size = 10,
        status,
        payStatus,
        orderNo,
        merchantName,
        userName,
        startDate,
        endDate,
        sortField,
        sortOrder,
      } = params
      const res = await request<ApiResult<PageResultBackend<Order> | PaginationResult<Order>>>({
        method: 'get',
        url: `/api/${prefix()}/orders`,
        params: {
          current,
          size,
          status,
          payStatus,
          orderNo,
          merchantName,
          userName,
          startDate,
          endDate,
          sortField,
          sortOrder,
        },
      })
      return { ...res, data: normalizePage(res.data) }
    },

    async getDetail(id: number | string): Promise<ApiResult<Order>> {
      return request<ApiResult<Order>>({
        method: 'get',
        url: `/api/${prefix()}/orders/${id}`,
      })
    },

    async accept(id: number | string): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'post',
        url: `/api/${prefix()}/orders/${id}/accept`,
      })
    },

    async reject(id: number | string, reason: string): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'post',
        url: `/api/${prefix()}/orders/${id}/reject`,
        data: { reason },
      })
    },

    async ready(id: number | string): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'post',
        url: `/api/${prefix()}/orders/${id}/ready`,
      })
    },

    /** @deprecated 后端未提供通用状态更新，建议使用 accept/reject/ready */
    async updateStatus(id: number | string, status: number): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'put',
        url: `/api/${prefix()}/orders/${id}/status/${status}`,
      })
    },

    async export(params: ExportParams = {}): Promise<Blob> {
      const res = await request<Blob>({
        method: 'get',
        url: `/api/${prefix()}/orders/export`,
        params,
        responseType: 'blob',
      })
      return res as unknown as Blob
    },

    /** 导出 CSV（等价于 export，指定 format=csv） */
    async exportCsv(params: ExportParams = {}): Promise<Blob> {
      return this.export({ ...params, format: 'csv' })
    },
  },

  // 菜品相关
  dish: {
    async getList(params: {
      current?: number
      size?: number
      categoryId?: number
      platformCategoryId?: number
      keyword?: string
      merchantId?: number
      status?: number
      sortField?: string
      sortOrder?: 'asc' | 'desc'
    } = {}): Promise<ApiResult<PaginationResult<Dish>>> {
      const {
        current = 1,
        size = 10,
        categoryId,
        platformCategoryId,
        keyword,
        merchantId,
        status,
        sortField,
        sortOrder,
      } = params
      const baseUrl = currentUserType() === 'admin' ? '/api/admin/dishes' : '/api/merchant/dishes'
      const res = await request<ApiResult<PageResultBackend<Dish> | PaginationResult<Dish>>>({
        method: 'get',
        url: baseUrl,
        params: { current, size, categoryId, platformCategoryId, keyword, merchantId, status, sortField, sortOrder },
      })
      return { ...res, data: normalizePage(res.data) }
    },

    async getDetail(id: number | string): Promise<ApiResult<Dish>> {
      const baseUrl = currentUserType() === 'admin' ? '/api/admin/dishes' : '/api/merchant/dishes'
      return request<ApiResult<Dish>>({
        method: 'get',
        url: `${baseUrl}/${id}`,
      })
    },

    async add(data: Partial<Dish>): Promise<ApiResult<number | string>> {
      return request<ApiResult<number | string>>({
        method: 'post',
        url: '/api/merchant/dishes',
        data,
      })
    },

    async update(id: number | string, data: DishUpdateDTO | Partial<Dish>): Promise<ApiResult<null>> {
      const baseUrl = currentUserType() === 'admin' ? '/api/admin/dishes' : '/api/merchant/dishes'
      return request<ApiResult<null>>({
        method: 'put',
        url: `${baseUrl}/${id}`,
        data,
      })
    },

    async save(data: Partial<Dish>): Promise<ApiResult<unknown>> {
      if (data.id) {
        return api.dish.update(data.id, data)
      }
      return api.dish.add(data)
    },

    async updateStatus(id: number | string, status: number): Promise<ApiResult<null>> {
      const baseUrl = currentUserType() === 'admin' ? '/api/admin/dishes' : '/api/merchant/dishes'
      return request<ApiResult<null>>({
        method: 'put',
        url: `${baseUrl}/${id}/status/${status}`,
      })
    },

    async delete(id: number | string): Promise<ApiResult<null>> {
      const baseUrl = currentUserType() === 'admin' ? '/api/admin/dishes' : '/api/merchant/dishes'
      return request<ApiResult<null>>({
        method: 'delete',
        url: `${baseUrl}/${id}`,
      })
    },

    async export(params: ExportParams = {}): Promise<Blob> {
      const baseUrl = currentUserType() === 'admin' ? '/api/admin/dishes/export' : '/api/merchant/dishes/export'
      const res = await request<Blob>({
        method: 'get',
        url: baseUrl,
        params,
        responseType: 'blob',
      })
      return res as unknown as Blob
    },
  },

  // 分类相关
  category: {
    async getList(): Promise<ApiResult<Category[]>> {
      return request<ApiResult<Category[]>>({
        method: 'get',
        url: `/api/${prefix()}/categories`,
      })
    },

    /** 分类列表（list 别名，等价于 getList） */
    async list(): Promise<ApiResult<Category[]>> {
      return this.getList()
    },

    async getDetail(id: number): Promise<ApiResult<Category>> {
      return request<ApiResult<Category>>({
        method: 'get',
        url: `/api/${prefix()}/categories/${id}`,
      })
    },

    /** 分类详情（别名，等价于 getDetail） */
    async detail(id: number): Promise<ApiResult<Category>> {
      return this.getDetail(id)
    },

    async save(data: CategoryCreateDTO | Partial<Category>): Promise<ApiResult<Category>> {
      if (data.id) {
        return request<ApiResult<Category>>({
          method: 'put',
          url: `/api/${prefix()}/categories/${data.id}`,
          data,
        })
      }
      return request<ApiResult<Category>>({
        method: 'post',
        url: `/api/${prefix()}/categories`,
        data,
      })
    },

    /** 创建分类 */
    async create(data: CategoryCreateDTO): Promise<ApiResult<Category>> {
      return request<ApiResult<Category>>({
        method: 'post',
        url: `/api/${prefix()}/categories`,
        data,
      })
    },

    /** 更新分类 */
    async update(id: number, data: CategoryUpdateDTO | Partial<Category>): Promise<ApiResult<Category>> {
      return request<ApiResult<Category>>({
        method: 'put',
        url: `/api/${prefix()}/categories/${id}`,
        data,
      })
    },

    async delete(id: number): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'delete',
        url: `/api/${prefix()}/categories/${id}`,
      })
    },

    /** 批量删除分类 */
    async batchDelete(ids: number[]): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'delete',
        url: `/api/${prefix()}/categories/batch`,
        data: { ids },
      })
    },

    async updateStatus(id: number, status: number): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'put',
        url: `/api/${prefix()}/categories/${id}/status/${status}`,
      })
    },

    /** 拖拽排序（传入排序后的分类 ID 数组） */
    async reorder(ids: number[]): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'put',
        url: `/api/${prefix()}/categories/reorder`,
        data: ids,
      })
    },

    /** 获取平台分类列表（商家端用于关联大分类） */
    async getPlatformList(): Promise<ApiResult<Category[]>> {
      return request<ApiResult<Category[]>>({
        method: 'get',
        url: '/api/merchant/categories/platform',
      })
    },

    /** 导出分类 */
    async export(params: ExportParams = {}): Promise<Blob> {
      const res = await request<Blob>({
        method: 'get',
        url: `/api/${prefix()}/categories/export`,
        params,
        responseType: 'blob',
      })
      return res as unknown as Blob
    },

    /** 导出 CSV（等价于 export，指定 format=csv） */
    async exportCsv(params: ExportParams = {}): Promise<Blob> {
      return this.export({ ...params, format: 'csv' })
    },
  },

  // 评价相关
  review: {
    async getList(params: {
      current?: number
      size?: number
      rating?: number
      merchantName?: string
      status?: number
      startDate?: string
      endDate?: string
      sortField?: string
      sortOrder?: 'asc' | 'desc'
    } = {}): Promise<ApiResult<PaginationResult<Review>>> {
      const {
        current = 1,
        size = 10,
        rating,
        merchantName,
        status,
        startDate,
        endDate,
        sortField,
        sortOrder,
      } = params
      const res = await request<ApiResult<PageResultBackend<Review> | PaginationResult<Review>>>({
        method: 'get',
        url: `/api/${prefix()}/reviews`,
        params: { current, size, rating, merchantName, status, startDate, endDate, sortField, sortOrder },
      })
      return { ...res, data: normalizePage(res.data) }
    },

    async getDetail(id: number | string): Promise<ApiResult<Review>> {
      return request<ApiResult<Review>>({
        method: 'get',
        url: `/api/${prefix()}/reviews/${id}`,
      })
    },

    async reply(id: number | string, content: string): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'post',
        url: `/api/${prefix()}/reviews/${id}/reply`,
        data: { content },
      })
    },

    async updateStatus(id: number | string, status: number): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'put',
        url: `/api/${prefix()}/reviews/${id}/status/${status}`,
      })
    },

    async delete(id: number | string): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'delete',
        url: `/api/${prefix()}/reviews/${id}`,
      })
    },

    async export(params: ExportParams = {}): Promise<Blob> {
      const res = await request<Blob>({
        method: 'get',
        url: `/api/${prefix()}/reviews/export`,
        params,
        responseType: 'blob',
      })
      return res as unknown as Blob
    },
  },

  // 统计相关
  stats: {
    async getDashboard(): Promise<ApiResult<MerchantDashboardStats & {
      userCount?: number
      merchantCount?: number
      riderCount?: number
      todayOrderCount?: number
      todayIncome?: number
      orderCount?: number
      income?: number
      chartData?: ChartData
      todos?: TodoItem[]
      announcements?: Announcement[]
    }>> {
      return request<ApiResult<MerchantDashboardStats & {
        userCount?: number
        merchantCount?: number
        riderCount?: number
        todayOrderCount?: number
        todayIncome?: number
        orderCount?: number
        income?: number
        chartData?: ChartData
        todos?: TodoItem[]
        announcements?: Announcement[]
      }>>({
        method: 'get',
        url: `/api/${prefix()}/dashboard`,
      })
    },

    async getTopDishes(): Promise<ApiResult<{ name: string; value: number }[]>> {
      return request<ApiResult<{ name: string; value: number }[]>>({
        method: 'get',
        url: `/api/${prefix()}/stats/top-dishes`,
      })
    },

    async getUserSources(): Promise<ApiResult<{ name: string; value: number }[]>> {
      return request<ApiResult<{ name: string; value: number }[]>>({
        method: 'get',
        url: `/api/${prefix()}/stats/user-sources`,
      })
    },

    async getHourlyDistribution(): Promise<ApiResult<{ hours: string[]; values: number[] }>> {
      return request<ApiResult<{ hours: string[]; values: number[] }>>({
        method: 'get',
        url: `/api/${prefix()}/stats/hourly`,
      })
    },
  },

  // 管理员多维度统计（仅admin可用）
  adminStats: {
    async dashboard(days = 7): Promise<ApiResult<any>> {
      return request<ApiResult<any>>({
        method: 'get',
        url: '/api/admin/stats/dashboard',
        params: { days },
      })
    },
    async user(days = 7): Promise<ApiResult<any>> {
      return request<ApiResult<any>>({
        method: 'get',
        url: '/api/admin/stats/user',
        params: { days },
      })
    },
    async merchant(days = 7): Promise<ApiResult<any>> {
      return request<ApiResult<any>>({
        method: 'get',
        url: '/api/admin/stats/merchant',
        params: { days },
      })
    },
    async order(days = 7): Promise<ApiResult<any>> {
      return request<ApiResult<any>>({
        method: 'get',
        url: '/api/admin/stats/order',
        params: { days },
      })
    },
    async rider(days = 7): Promise<ApiResult<any>> {
      return request<ApiResult<any>>({
        method: 'get',
        url: '/api/admin/stats/rider',
        params: { days },
      })
    },
    async finance(days = 7): Promise<ApiResult<any>> {
      return request<ApiResult<any>>({
        method: 'get',
        url: '/api/admin/stats/finance',
        params: { days },
      })
    },
  },

  // 优惠券相关
  coupon: {
    async getList(params: {
      page?: number
      pageSize?: number
      keyword?: string
      type?: number
      status?: number
      merchantId?: number
      sortField?: string
      sortOrder?: 'asc' | 'desc'
    } = {}): Promise<ApiResult<PaginationResult<Coupon>>> {
      const { page = 1, pageSize = 10, keyword, type, status, merchantId, sortField, sortOrder } = params
      const res = await request<ApiResult<PageResultBackend<Coupon>>>({
        method: 'get',
        url: '/api/admin/coupons',
        params: { page, pageSize, keyword, type, status, merchantId, sortField, sortOrder },
      })
      return { ...res, data: normalizePage(res.data) }
    },

    async getDetail(id: number): Promise<ApiResult<Coupon>> {
      return request<ApiResult<Coupon>>({
        method: 'get',
        url: `/api/admin/coupons/${id}`,
      })
    },

    /** 优惠券详情（别名，等价于 getDetail） */
    async detail(id: number): Promise<ApiResult<Coupon>> {
      return this.getDetail(id)
    },

    async add(data: CouponCreateDTO | Partial<Coupon>): Promise<ApiResult<Coupon>> {
      return request<ApiResult<Coupon>>({
        method: 'post',
        url: '/api/admin/coupons',
        data,
      })
    },

    /** 创建优惠券（别名，等价于 add） */
    async create(data: CouponCreateDTO | Partial<Coupon>): Promise<ApiResult<Coupon>> {
      return this.add(data)
    },

    async update(id: number, data: CouponUpdateDTO | Partial<Coupon>): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'put',
        url: `/api/admin/coupons/${id}`,
        data,
      })
    },

    async save(data: Partial<Coupon>): Promise<ApiResult<unknown>> {
      if (data.id) {
        return api.coupon.update(data.id, data)
      }
      return api.coupon.add(data)
    },

    async updateStatus(id: number, status: number): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'put',
        url: `/api/admin/coupons/${id}/status/${status}`,
      })
    },

    async delete(id: number): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'delete',
        url: `/api/admin/coupons/${id}`,
      })
    },

    /** 批量删除优惠券 */
    async batchDelete(ids: number[]): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'delete',
        url: '/api/admin/coupons/batch',
        data: { ids },
      })
    },

    async export(params: ExportParams = {}): Promise<Blob> {
      const res = await request<Blob>({
        method: 'get',
        url: '/api/admin/coupons/export',
        params,
        responseType: 'blob',
      })
      return res as unknown as Blob
    },

    /** 导出 CSV（等价于 export，指定 format=csv） */
    async exportCsv(params: ExportParams = {}): Promise<Blob> {
      return this.export({ ...params, format: 'csv' })
    },
  },

  // 商家优惠券相关
  merchantCoupon: {
    async getList(params: {
      page?: number
      pageSize?: number
      keyword?: string
      type?: number
      status?: number
      sortField?: string
      sortOrder?: 'asc' | 'desc'
    } = {}): Promise<ApiResult<PaginationResult<Coupon>>> {
      const { page = 1, pageSize = 10, keyword, type, status, sortField, sortOrder } = params
      const res = await request<ApiResult<PageResultBackend<Coupon>>>({
        method: 'get',
        url: '/api/merchant/coupons',
        params: { page, pageSize, keyword, type, status, sortField, sortOrder },
      })
      return { ...res, data: normalizePage(res.data) }
    },

    async getDetail(id: number): Promise<ApiResult<Coupon>> {
      return request<ApiResult<Coupon>>({
        method: 'get',
        url: `/api/merchant/coupons/${id}`,
      })
    },

    async add(data: CouponCreateDTO): Promise<ApiResult<number>> {
      return request<ApiResult<number>>({
        method: 'post',
        url: '/api/merchant/coupons',
        data,
      })
    },

    async update(id: number, data: CouponUpdateDTO): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'put',
        url: `/api/merchant/coupons/${id}`,
        data,
      })
    },

    async delete(id: number): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'delete',
        url: `/api/merchant/coupons/${id}`,
      })
    },

    async updateStatus(id: number, status: number): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'put',
        url: `/api/merchant/coupons/${id}/status/${status}`,
      })
    },

    async stats(): Promise<ApiResult<Record<string, number>>> {
      return request<ApiResult<Record<string, number>>>({
        method: 'get',
        url: '/api/merchant/coupons/stats',
      })
    },
  },

  // 退款相关
  refund: {
    async getList(params: {
      page?: number
      pageSize?: number
      refundNo?: string
      orderNo?: string
      status?: number
      startDate?: string
      endDate?: string
      sortField?: string
      sortOrder?: 'asc' | 'desc'
    } = {}): Promise<ApiResult<PaginationResult<Refund>>> {
      const { page = 1, pageSize = 10, refundNo, orderNo, status, startDate, endDate, sortField, sortOrder } = params
      return request<ApiResult<PaginationResult<Refund>>>({
        method: 'get',
        url: '/api/admin/refunds',
        params: { page, pageSize, refundNo, orderNo, status, startDate, endDate, sortField, sortOrder },
      })
    },

    async audit(id: number, status: number, reason?: string): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'put',
        url: `/api/admin/refunds/${id}/audit`,
        data: { status, reason },
      })
    },

    async export(params: ExportParams = {}): Promise<Blob> {
      const res = await request<Blob>({
        method: 'get',
        url: '/api/admin/refunds/export',
        params,
        responseType: 'blob',
      })
      return res as unknown as Blob
    },
  },

  // 风控相关
  risk: {
    async getList(params: {
      page?: number
      pageSize?: number
      type?: string
      level?: string
      status?: number
      startDate?: string
      endDate?: string
      sortField?: string
      sortOrder?: 'asc' | 'desc'
    } = {}): Promise<ApiResult<PaginationResult<RiskWarning>>> {
      const { page = 1, pageSize = 10, type, level, status, startDate, endDate, sortField, sortOrder } = params
      return request<ApiResult<PaginationResult<RiskWarning>>>({
        method: 'get',
        url: '/api/admin/risks',
        params: { page, pageSize, type, level, status, startDate, endDate, sortField, sortOrder },
      })
    },

    async handle(id: number, status: number): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'put',
        url: `/api/admin/risks/${id}/handle`,
        data: { status },
      })
    },

    async export(params: ExportParams = {}): Promise<Blob> {
      const res = await request<Blob>({
        method: 'get',
        url: '/api/admin/risks/export',
        params,
        responseType: 'blob',
      })
      return res as unknown as Blob
    },
  },

  // 日志相关
  log: {
    async getList(params: {
      page?: number
      pageSize?: number
      operator?: string
      module?: string
      action?: string
      result?: number
      startDate?: string
      endDate?: string
      sortField?: string
      sortOrder?: 'asc' | 'desc'
    } = {}): Promise<ApiResult<PaginationResult<OperationLog>>> {
      const { page = 1, pageSize = 10, operator, module, action, result, startDate, endDate, sortField, sortOrder } = params
      const res = await request<ApiResult<PageResultBackend<OperationLog> | PaginationResult<OperationLog>>>({
        method: 'get',
        url: '/api/admin/logs',
        params: { page, pageSize, operator, module, action, result, startDate, endDate, sortField, sortOrder },
      })
      return { ...res, data: normalizePage(res.data) }
    },

    async export(params: ExportParams = {}): Promise<Blob> {
      const res = await request<Blob>({
        method: 'get',
        url: '/api/admin/logs/export',
        params,
        responseType: 'blob',
      })
      return res as unknown as Blob
    },
  },

  // 财务相关
  finance: {
    async getStats(): Promise<ApiResult<FinanceStats>> {
      return request<ApiResult<FinanceStats>>({
        method: 'get',
        url: `/api/${prefix()}/finance/stats`,
      })
    },

    async getChartData(type: number = 1): Promise<ApiResult<ChartData>> {
      return request<ApiResult<ChartData>>({
        method: 'get',
        url: `/api/${prefix()}/finance/chart`,
        params: { type },
      })
    },

    async getReport(params: {
      page?: number
      pageSize?: number
      startDate?: string
      endDate?: string
    } = {}): Promise<ApiResult<PaginationResult<FinanceReport>>> {
      const { page = 1, pageSize = 10, startDate, endDate } = params
      const res = await request<ApiResult<PageResultBackend<FinanceReport> | PaginationResult<FinanceReport>>>({
        method: 'get',
        url: `/api/${prefix()}/finance/reports`,
        params: { page, pageSize, startDate, endDate },
      })
      return { ...res, data: normalizePage(res.data) }
    },

    async export(params: ExportParams = {}): Promise<Blob> {
      const res = await request<Blob>({
        method: 'get',
        url: `/api/${prefix()}/finance/export`,
        params,
        responseType: 'blob',
      })
      return res as unknown as Blob
    },
  },

  // 系统相关
  system: {
    async getSettings(): Promise<ApiResult<SystemSettings>> {
      return request<ApiResult<SystemSettings>>({
        method: 'get',
        url: '/api/admin/system/settings',
      })
    },

    async saveSettings(data: SystemSettings): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'put',
        url: '/api/admin/system/settings',
        data,
      })
    },
  },

  // B端店铺设置（商家信息）
  merchantSettings: {
    async get(): Promise<ApiResult<Merchant>> {
      return request<ApiResult<Merchant>>({
        method: 'get',
        url: '/api/merchant/auth/me',
      })
    },

    async save(data: Partial<Merchant>): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'put',
        url: '/api/merchant/settings',
        data,
      })
    },
  },

  // 个人资料
  profile: {
    // 获取个人资料
    async get(): Promise<ApiResult<any>> {
      const type = currentUserType()
      let url = '/api/admin/profile'
      if (type === 'merchant') {
        url = '/api/merchant/auth/me'
      }
      return request<ApiResult<any>>({
        method: 'get',
        url,
      })
    },

    // 更新个人资料
    async update(data: { nickname?: string; realName?: string; avatar?: string; phone?: string; email?: string; contactPerson?: string }): Promise<ApiResult<null>> {
      const type = currentUserType()
      let url = '/api/admin/profile'
      if (type === 'merchant') {
        // 商家端通过 settings 更新 logo/name/contactPerson/phone
        return api.merchantSettings.save({
          name: data.nickname,
          logo: data.avatar,
          contactPerson: data.realName || data.contactPerson,
          phone: data.phone,
        })
      }
      return request<ApiResult<null>>({
        method: 'put',
        url,
        data,
      })
    },

    // 修改密码
    async updatePassword(oldPassword: string, newPassword: string): Promise<ApiResult<null>> {
      const type = currentUserType()
      let url = '/api/admin/profile/password'
      // TODO: 如果商家/骑手也有修改密码接口可以在这里添加
      return request<ApiResult<null>>({
        method: 'put',
        url,
        data: { oldPassword, newPassword },
      })
    },
  },

  // 促销活动相关
  promotion: {
    async getList(page = 1, pageSize = 10): Promise<ApiResult<PaginationResult<Promotion>>> {
      const res = await request<ApiResult<PageResultBackend<Promotion> | PaginationResult<Promotion>>>({
        method: 'get',
        url: '/api/merchant/promotions',
        params: { page, pageSize },
      })
      return { ...res, data: normalizePage(res.data) }
    },

    async add(data: Partial<Promotion>): Promise<ApiResult<Promotion>> {
      return request<ApiResult<Promotion>>({
        method: 'post',
        url: '/api/merchant/promotions',
        data,
      })
    },

    async update(id: number, data: Partial<Promotion>): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'put',
        url: `/api/merchant/promotions/${id}`,
        data,
      })
    },

    async save(data: Partial<Promotion>): Promise<ApiResult<unknown>> {
      if (data.id) {
        return api.promotion.update(data.id, data)
      }
      return api.promotion.add(data)
    },

    async delete(id: number): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'delete',
        url: `/api/merchant/promotions/${id}`,
      })
    },
  },

  // 文件上传
  file: {
    async upload(file: File): Promise<ApiResult<UploadResult>> {
      const formData = new FormData()
      formData.append('file', file)
      return request<ApiResult<UploadResult>>({
        method: 'post',
        url: '/api/public/files/upload',
        data: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
  },

  // 地址管理（admin 端）
  address: {
    async getList(params: {
      page?: number
      pageSize?: number
      userId?: number
      keyword?: string
    } = {}): Promise<ApiResult<PaginationResult<Address>>> {
      const { page = 1, pageSize = 10, userId, keyword } = params
      return request<ApiResult<PaginationResult<Address>>>({
        method: 'get',
        url: '/api/admin/addresses',
        params: { page, pageSize, userId, keyword },
      })
    },

    async delete(id: number): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'delete',
        url: `/api/admin/addresses/${id}`,
      })
    },

    async export(params: ExportParams = {}): Promise<Blob> {
      const res = await request<Blob>({
        method: 'get',
        url: '/api/admin/addresses/export',
        params,
        responseType: 'blob',
      })
      return res as unknown as Blob
    },
  },

  // 支付记录（admin 端）
  payment: {
    async getList(params: {
      page?: number
      pageSize?: number
      orderNo?: string
      payType?: number
      status?: number
      startDate?: string
      endDate?: string
    } = {}): Promise<ApiResult<PaginationResult<Payment>>> {
      const { page = 1, pageSize = 10, orderNo, payType, status, startDate, endDate } = params
      return request<ApiResult<PaginationResult<Payment>>>({
        method: 'get',
        url: '/api/admin/payments',
        params: { page, pageSize, orderNo, payType, status, startDate, endDate },
      })
    },

    async getDetail(id: number): Promise<ApiResult<Payment>> {
      return request<ApiResult<Payment>>({
        method: 'get',
        url: `/api/admin/payments/${id}`,
      })
    },

    async export(params: ExportParams = {}): Promise<Blob> {
      const res = await request<Blob>({
        method: 'get',
        url: '/api/admin/payments/export',
        params,
        responseType: 'blob',
      })
      return res as unknown as Blob
    },
  },

  // 消息管理（admin 端）
  message: {
    async getList(params: {
      page?: number
      pageSize?: number
      userId?: number
      type?: number
      isRead?: number
    } = {}): Promise<ApiResult<PaginationResult<Message>>> {
      const { page = 1, pageSize = 10, userId, type, isRead } = params
      return request<ApiResult<PaginationResult<Message>>>({
        method: 'get',
        url: '/api/admin/messages',
        params: { page, pageSize, userId, type, isRead },
      })
    },

    async add(data: MessageCreateDTO): Promise<ApiResult<number>> {
      return request<ApiResult<number>>({
        method: 'post',
        url: '/api/admin/messages',
        data,
      })
    },

    async delete(id: number): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'delete',
        url: `/api/admin/messages/${id}`,
      })
    },

    async export(params: ExportParams = {}): Promise<Blob> {
      const res = await request<Blob>({
        method: 'get',
        url: '/api/admin/messages/export',
        params,
        responseType: 'blob',
      })
      return res as unknown as Blob
    },
  },

  // 回收站
  recycleBin: {
    async getTypes(): Promise<ApiResult<RecycleBinTypes>> {
      return request<ApiResult<RecycleBinTypes>>({
        method: 'get',
        url: '/api/admin/recycle-bin/types',
      })
    },

    async getList(type: string, params: { page?: number; pageSize?: number; keyword?: string } = {}): Promise<ApiResult<PaginationResult<RecycleBinItem>>> {
      const { page = 1, pageSize = 10, keyword } = params
      const res = await request<ApiResult<PageResultBackend<RecycleBinItem>>>({
        method: 'get',
        url: `/api/admin/recycle-bin/${type}`,
        params: { page, pageSize, keyword },
      })
      return { ...res, data: normalizePage(res.data) }
    },

    async restore(type: string, id: string): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'put',
        url: `/api/admin/recycle-bin/${type}/${id}/restore`,
      })
    },

    async physicalDelete(type: string, id: string): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'delete',
        url: `/api/admin/recycle-bin/${type}/${id}`,
      })
    },

    async batchRestore(type: string, ids: string[]): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'put',
        url: `/api/admin/recycle-bin/${type}/batch-restore`,
        data: ids,
      })
    },

    async batchPhysicalDelete(type: string, ids: string[]): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'delete',
        url: `/api/admin/recycle-bin/${type}/batch`,
        data: ids,
      })
    },
  },

  // 商家端回收站
  merchantRecycleBin: {
    async getTypes(): Promise<ApiResult<RecycleBinTypes>> {
      return request<ApiResult<RecycleBinTypes>>({
        method: 'get',
        url: '/api/merchant/recycle-bin/types',
      })
    },

    async getList(type: string, params: { page?: number; pageSize?: number; keyword?: string } = {}): Promise<ApiResult<PaginationResult<RecycleBinItem>>> {
      const { page = 1, pageSize = 10, keyword } = params
      const res = await request<ApiResult<PageResultBackend<RecycleBinItem>>>({
        method: 'get',
        url: `/api/merchant/recycle-bin/${type}`,
        params: { page, pageSize, keyword },
      })
      return { ...res, data: normalizePage(res.data) }
    },

    async restore(type: string, id: string): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'put',
        url: `/api/merchant/recycle-bin/${type}/${id}/restore`,
      })
    },

    async physicalDelete(type: string, id: string): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'delete',
        url: `/api/merchant/recycle-bin/${type}/${id}`,
      })
    },

    async batchRestore(type: string, ids: string[]): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'put',
        url: `/api/merchant/recycle-bin/${type}/batch-restore`,
        data: ids,
      })
    },

    async batchPhysicalDelete(type: string, ids: string[]): Promise<ApiResult<null>> {
      return request<ApiResult<null>>({
        method: 'delete',
        url: `/api/merchant/recycle-bin/${type}/batch`,
        data: ids,
      })
    },
  },
}

export default api
