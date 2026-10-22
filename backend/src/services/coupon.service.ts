import { Prisma, DiscountType } from '@prisma/client';
import prisma from '../config/prisma';

export interface CreateCouponDto {
  code: string;
  title: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderValue?: number;
  maxDiscountAmount?: number;
  usageLimit?: number;
  userUsageLimit?: number;
  startDate: string | Date;
  endDate: string | Date;
  isActive?: boolean;
}

export interface UpdateCouponDto {
  title?: string;
  description?: string;
  discountType?: DiscountType;
  discountValue?: number;
  minOrderValue?: number;
  maxDiscountAmount?: number;
  usageLimit?: number;
  userUsageLimit?: number;
  startDate?: string | Date;
  endDate?: string | Date;
  isActive?: boolean;
}

export interface CouponFilterQuery {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}

export interface ValidatedCouponResult {
  coupon: {
    id: string;
    code: string;
    title: string;
    discountType: DiscountType;
    discountValue: number;
    minOrderValue: number | null;
    maxDiscountAmount: number | null;
  };
  discountAmount: number;
  subtotal: number;
  finalTotal: number;
}

export class CouponService {
  /**
   * Tạo mã giảm giá mới (Admin)
   */
  async createCoupon(data: CreateCouponDto) {
    const code = data.code.trim().toUpperCase();

    // Kiểm tra trùng mã
    const existing = await prisma.coupon.findUnique({
      where: { code },
    });
    if (existing) {
      throw { statusCode: 400, message: `Mã giảm giá '${code}' đã tồn tại.` };
    }

    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw { statusCode: 400, message: 'Thời gian bắt đầu hoặc kết thúc không hợp lệ.' };
    }

    if (endDate <= startDate) {
      throw { statusCode: 400, message: 'Thời gian kết thúc phải lớn hơn thời gian bắt đầu.' };
    }

    if (data.discountValue <= 0) {
      throw { statusCode: 400, message: 'Giá trị giảm phải lớn hơn 0.' };
    }

    if (data.discountType === DiscountType.PERCENTAGE && data.discountValue > 100) {
      throw { statusCode: 400, message: 'Giảm giá theo phần trăm không được vượt quá 100%.' };
    }

    return prisma.coupon.create({
      data: {
        code,
        title: data.title.trim(),
        description: data.description?.trim(),
        discountType: data.discountType,
        discountValue: new Prisma.Decimal(data.discountValue),
        minOrderValue: data.minOrderValue != null ? new Prisma.Decimal(data.minOrderValue) : null,
        maxDiscountAmount: data.maxDiscountAmount != null ? new Prisma.Decimal(data.maxDiscountAmount) : null,
        usageLimit: data.usageLimit != null ? Number(data.usageLimit) : null,
        userUsageLimit: data.userUsageLimit != null ? Number(data.userUsageLimit) : 1,
        startDate,
        endDate,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
      },
    });
  }

  /**
   * Danh sách coupon cho Admin (có phân trang, search)
   */
  async getCoupons(query: CouponFilterQuery) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.CouponWhereInput = {};

    if (query.search) {
      where.OR = [
        { code: { contains: query.search.trim(), mode: 'insensitive' } },
        { title: { contains: query.search.trim(), mode: 'insensitive' } },
      ];
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    const [coupons, total] = await Promise.all([
      prisma.coupon.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.coupon.count({ where }),
    ]);

    return {
      data: coupons,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Danh sách mã giảm giá khả dụng cho khách hàng (Public)
   */
  async getActiveCoupons() {
    const now = new Date();
    return prisma.coupon.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
        OR: [
          { usageLimit: null },
          {
            usageLimit: {
              gt: prisma.coupon.fields.usedCount,
            },
          },
        ],
      },
      select: {
        id: true,
        code: true,
        title: true,
        description: true,
        discountType: true,
        discountValue: true,
        minOrderValue: true,
        maxDiscountAmount: true,
        startDate: true,
        endDate: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Kiểm tra và tính toán giảm giá của Coupon cho đơn hàng
   * @param code Mã giảm giá
   * @param subtotal Tổng tiền hàng hiện tại (chưa tính ship)
   * @param userId ID người dùng mua hàng
   */
  async validateCoupon(code: string, subtotal: number, userId?: string): Promise<ValidatedCouponResult> {
    if (!code) {
      throw { statusCode: 400, message: 'Vui lòng cung cấp mã giảm giá.' };
    }

    const cleanCode = code.trim().toUpperCase();
    const coupon = await prisma.coupon.findUnique({
      where: { code: cleanCode },
    });

    if (!coupon || !coupon.isActive) {
      throw { statusCode: 400, message: `Mã giảm giá '${cleanCode}' không tồn tại hoặc đã ngừng áp dụng.` };
    }

    const now = new Date();
    if (now < coupon.startDate) {
      throw { statusCode: 400, message: `Chương trình áp dụng mã '${cleanCode}' chưa bắt đầu.` };
    }

    if (now > coupon.endDate) {
      throw { statusCode: 400, message: `Mã giảm giá '${cleanCode}' đã hết hạn sử dụng.` };
    }

    // Kiểm tra giới hạn tổng lượt dùng
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      throw { statusCode: 400, message: `Mã giảm giá '${cleanCode}' đã hết lượt sử dụng.` };
    }

    // Kiểm tra đơn hàng tối thiểu
    const minOrder = coupon.minOrderValue ? Number(coupon.minOrderValue) : 0;
    if (subtotal < minOrder) {
      throw {
        statusCode: 400,
        message: `Mã giảm giá yêu cầu đơn hàng tối thiểu từ ${minOrder.toLocaleString('vi-VN')} đ (Hiện tại: ${subtotal.toLocaleString('vi-VN')} đ).`,
      };
    }

    // Kiểm tra số lần người dùng đã sử dụng mã này
    if (userId && coupon.userUsageLimit) {
      const userUsageCount = await prisma.couponUsage.count({
        where: {
          couponId: coupon.id,
          userId,
        },
      });

      if (userUsageCount >= coupon.userUsageLimit) {
        throw {
          statusCode: 400,
          message: `Bạn đã sử dụng hết lượt cho phép (${coupon.userUsageLimit} lần) của mã '${cleanCode}'.`,
        };
      }
    }

    // Tính số tiền giảm
    let discountAmount = 0;
    const discountVal = Number(coupon.discountValue);

    if (coupon.discountType === DiscountType.PERCENTAGE) {
      discountAmount = (subtotal * discountVal) / 100;
      if (coupon.maxDiscountAmount) {
        const maxDiscount = Number(coupon.maxDiscountAmount);
        if (discountAmount > maxDiscount) {
          discountAmount = maxDiscount;
        }
      }
    } else {
      // FIXED_AMOUNT
      discountAmount = Math.min(discountVal, subtotal);
    }

    // Làm tròn tiền VNĐ
    discountAmount = Math.round(discountAmount);
    const finalTotal = Math.max(0, subtotal - discountAmount);

    return {
      coupon: {
        id: coupon.id,
        code: coupon.code,
        title: coupon.title,
        discountType: coupon.discountType,
        discountValue: discountVal,
        minOrderValue: coupon.minOrderValue ? Number(coupon.minOrderValue) : null,
        maxDiscountAmount: coupon.maxDiscountAmount ? Number(coupon.maxDiscountAmount) : null,
      },
      discountAmount,
      subtotal,
      finalTotal,
    };
  }

  /**
   * Cập nhật mã giảm giá (Admin)
   */
  async updateCoupon(id: string, data: UpdateCouponDto) {
    const existing = await prisma.coupon.findUnique({ where: { id } });
    if (!existing) {
      throw { statusCode: 404, message: 'Mã giảm giá không tồn tại.' };
    }

    const updateData: Prisma.CouponUpdateInput = {};

    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.description !== undefined) updateData.description = data.description.trim();
    if (data.discountType !== undefined) updateData.discountType = data.discountType;
    if (data.discountValue !== undefined) {
      if (data.discountValue <= 0) throw { statusCode: 400, message: 'Giá trị giảm phải > 0' };
      if (
        (data.discountType || existing.discountType) === DiscountType.PERCENTAGE &&
        data.discountValue > 100
      ) {
        throw { statusCode: 400, message: 'Giảm giá theo % không được vượt quá 100%' };
      }
      updateData.discountValue = new Prisma.Decimal(data.discountValue);
    }
    if (data.minOrderValue !== undefined) {
      updateData.minOrderValue = data.minOrderValue != null ? new Prisma.Decimal(data.minOrderValue) : null;
    }
    if (data.maxDiscountAmount !== undefined) {
      updateData.maxDiscountAmount =
        data.maxDiscountAmount != null ? new Prisma.Decimal(data.maxDiscountAmount) : null;
    }
    if (data.usageLimit !== undefined) {
      updateData.usageLimit = data.usageLimit != null ? Number(data.usageLimit) : null;
    }
    if (data.userUsageLimit !== undefined) {
      updateData.userUsageLimit = data.userUsageLimit != null ? Number(data.userUsageLimit) : 1;
    }
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);
    if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive);

    return prisma.coupon.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Xoá mã giảm giá (Admin)
   */
  async deleteCoupon(id: string) {
    const existing = await prisma.coupon.findUnique({
      where: { id },
      include: { _count: { select: { orders: true } } },
    });

    if (!existing) {
      throw { statusCode: 404, message: 'Mã giảm giá không tồn tại.' };
    }

    if (existing._count.orders > 0) {
      // Đã có đơn hàng sử dụng mã này thì chỉ nên huỷ kích hoạt
      return prisma.coupon.update({
        where: { id },
        data: { isActive: false },
      });
    }

    return prisma.coupon.delete({ where: { id } });
  }
}

export const couponService = new CouponService();
