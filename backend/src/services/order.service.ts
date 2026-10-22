import { Prisma, OrderStatus, PaymentMethod, PaymentStatus, Role, DiscountType } from '@prisma/client';
import prisma from '../config/prisma';
import { emailService } from './email.service';

export interface CheckoutItemInput {
  variantId: string;
  quantity: number;
}

export interface ShippingAddressInput {
  recipientName: string;
  recipientPhone: string;
  provinceCity: string;
  district: string;
  ward: string;
  streetAddress: string;
  shippingNotes?: string;
}

export interface CheckoutPreviewDto {
  cartItemIds?: string[];
  items?: CheckoutItemInput[];
  addressId?: string;
  shippingAddress?: ShippingAddressInput;
  couponCode?: string;
}

export interface CreateOrderDto {
  cartItemIds?: string[];
  items?: CheckoutItemInput[];
  addressId?: string;
  shippingAddress?: ShippingAddressInput;
  paymentMethod?: PaymentMethod;
  couponCode?: string;
  shippingNotes?: string;
}

export interface OrderFilterQuery {
  page?: number;
  limit?: number;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  search?: string;
  startDate?: string;
  endDate?: string;
}

export class OrderService {
  /**
   * Tính phí giao hàng (Mặc định 30.000 đ, miễn phí cho đơn từ 1.000.000 đ)
   */
  private calculateShippingFee(subtotal: number): number {
    const FREE_SHIPPING_THRESHOLD = 1000000;
    const STANDARD_SHIPPING_FEE = 30000;
    return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_FEE;
  }

  /**
   * Sinh mã đơn hàng duy nhất: ORD-YYYYMMDD-XXXXX
   */
  private generateOrderCode(): string {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const randomStr = Math.floor(10000 + Math.random() * 90000).toString();
    return `ORD-${dateStr}-${randomStr}`;
  }

  /**
   * Xem trước thông tin đơn hàng trước khi đặt (Checkout Preview)
   * Giúp khách kiểm tra tồn kho, tạm tính, phí ship, mã giảm giá và tổng thanh toán
   * Hỗ trợ:
   * 1. Tích chọn cụ thể qua cartItemIds (mảng ID item trong giỏ)
   * 2. Hoặc tự động lấy các món đang được tích chọn (isSelected === true) trong giỏ
   * 3. Hoặc Mua ngay trực tiếp (items)
   */
  async checkoutPreview(userId: string, data: CheckoutPreviewDto) {
    let orderItems: Array<{ variantId: string; quantity: number }> = [];

    // TH 1: Truyền danh sách ID các item được tích chọn trong giỏ hàng
    if (data.cartItemIds && data.cartItemIds.length > 0) {
      const cart = await prisma.cart.findUnique({
        where: { userId },
        include: {
          items: {
            where: { id: { in: data.cartItemIds } },
          },
        },
      });

      if (!cart || cart.items.length === 0) {
        throw { statusCode: 400, message: 'Không tìm thấy sản phẩm hợp lệ nào trong các món đã tích chọn.' };
      }

      orderItems = cart.items.map((i) => ({
        variantId: i.variantId,
        quantity: i.quantity,
      }));
    }
    // TH 2: Mua ngay trực tiếp từ trang chi tiết sản phẩm (không qua giỏ)
    else if (data.items && data.items.length > 0) {
      orderItems = data.items.map((i) => ({
        variantId: i.variantId,
        quantity: Math.max(1, Math.floor(Number(i.quantity) || 1)),
      }));
    }
    // TH 3: Lấy các sản phẩm đang được tích chọn (isSelected: true) trong giỏ hàng
    else {
      const cart = await prisma.cart.findUnique({
        where: { userId },
        include: {
          items: {
            where: { isSelected: true },
          },
        },
      });

      if (!cart || cart.items.length === 0) {
        throw {
          statusCode: 400,
          message:
            'Chưa có sản phẩm nào được tích chọn trong giỏ hàng. Vui lòng tích chọn ít nhất 1 sản phẩm để xem trước đơn hàng.',
        };
      }

      orderItems = cart.items.map((i) => ({
        variantId: i.variantId,
        quantity: i.quantity,
      }));
    }

    if (orderItems.length === 0) {
      throw { statusCode: 400, message: 'Vui lòng chọn ít nhất một sản phẩm để đặt hàng.' };
    }

    // Lấy thông tin các biến thể
    const variantIds = orderItems.map((i) => i.variantId);
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            thumbnail: true,
            status: true,
          },
        },
      },
    });

    const variantMap = new Map(variants.map((v) => [v.id, v]));

    let subtotal = 0;
    const previewItems = [];

    for (const item of orderItems) {
      const variant = variantMap.get(item.variantId);
      if (!variant || !variant.isActive) {
        throw { statusCode: 400, message: 'Có sản phẩm không tồn tại hoặc đã ngừng kinh doanh.' };
      }

      if (variant.product.status !== 'PUBLISHED') {
        throw { statusCode: 400, message: `Sản phẩm "${variant.product.name}" hiện không mở bán.` };
      }

      if (variant.stockQuantity < item.quantity) {
        throw {
          statusCode: 400,
          message: `Sản phẩm "${variant.product.name} (${variant.name})" chỉ còn tồn kho ${variant.stockQuantity} chiếc, không đủ đáp ứng số lượng ${item.quantity}.`,
        };
      }

      const originalPrice = Number(variant.originalPrice);
      const salePrice = variant.salePrice ? Number(variant.salePrice) : null;
      const effectivePrice = salePrice !== null ? salePrice : originalPrice;
      const itemTotal = effectivePrice * item.quantity;

      subtotal += itemTotal;

      previewItems.push({
        variantId: variant.id,
        productId: variant.product.id,
        productName: variant.product.name,
        variantName: variant.name,
        sku: variant.sku,
        thumbnail: variant.imageUrl || variant.product.thumbnail,
        price: effectivePrice,
        originalPrice,
        quantity: item.quantity,
        totalPrice: itemTotal,
      });
    }

    const shippingFee = this.calculateShippingFee(subtotal);
    let discountAmount = 0;
    let appliedCoupon = null;

    if (data.couponCode) {
      const code = data.couponCode.trim().toUpperCase();
      const coupon = await prisma.coupon.findUnique({
        where: { code },
      });

      if (!coupon || !coupon.isActive) {
        throw { statusCode: 400, message: `Mã giảm giá '${code}' không hợp lệ hoặc đã hết hạn.` };
      }

      const now = new Date();
      if (now < coupon.startDate || now > coupon.endDate) {
        throw { statusCode: 400, message: `Mã giảm giá '${code}' không nằm trong thời gian áp dụng.` };
      }

      if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
        throw { statusCode: 400, message: `Mã giảm giá '${code}' đã hết lượt sử dụng.` };
      }

      const minOrder = coupon.minOrderValue ? Number(coupon.minOrderValue) : 0;
      if (subtotal < minOrder) {
        throw {
          statusCode: 400,
          message: `Mã '${code}' yêu cầu đơn hàng tối thiểu từ ${minOrder.toLocaleString('vi-VN')} đ.`,
        };
      }

      if (coupon.userUsageLimit) {
        const userUsageCount = await prisma.couponUsage.count({
          where: { couponId: coupon.id, userId },
        });
        if (userUsageCount >= coupon.userUsageLimit) {
          throw {
            statusCode: 400,
            message: `Bạn đã sử dụng hết lượt cho phép của mã '${code}'.`,
          };
        }
      }

      const discountVal = Number(coupon.discountValue);
      if (coupon.discountType === DiscountType.PERCENTAGE) {
        discountAmount = (subtotal * discountVal) / 100;
        if (coupon.maxDiscountAmount) {
          const maxDiscount = Number(coupon.maxDiscountAmount);
          if (discountAmount > maxDiscount) discountAmount = maxDiscount;
        }
      } else {
        discountAmount = Math.min(discountVal, subtotal);
      }

      discountAmount = Math.round(discountAmount);
      appliedCoupon = {
        id: coupon.id,
        code: coupon.code,
        title: coupon.title,
        discountType: coupon.discountType,
        discountValue: discountVal,
        discountAmount,
      };
    }

    const totalAmount = Math.max(0, subtotal + shippingFee - discountAmount);

    // Lấy thông tin địa chỉ nếu có addressId
    let shippingAddress = data.shippingAddress || null;
    if (data.addressId) {
      const address = await prisma.userAddress.findFirst({
        where: { id: data.addressId, userId },
      });
      if (address) {
        shippingAddress = {
          recipientName: address.recipientName,
          recipientPhone: address.recipientPhone,
          provinceCity: address.provinceCity,
          district: address.district,
          ward: address.ward,
          streetAddress: address.streetAddress,
          shippingNotes: address.notes || undefined,
        };
      }
    }

    return {
      items: previewItems,
      subtotal,
      shippingFee,
      discountAmount,
      totalAmount,
      appliedCoupon,
      shippingAddress,
    };
  }

  /**
   * Tạo đơn hàng chính thức với Prisma Transaction
   * Trừ tồn kho, ghi nhận CouponUsage, tạo Order + OrderItem + Payment, dọn giỏ hàng
   */
  async createOrder(userId: string, data: CreateOrderDto) {
    // 1. Xác định địa chỉ giao hàng
    let shipping = data.shippingAddress;

    if (data.addressId) {
      const address = await prisma.userAddress.findFirst({
        where: { id: data.addressId, userId },
      });
      if (!address) {
        throw { statusCode: 400, message: 'Địa chỉ giao hàng đã chọn không tồn tại.' };
      }
      shipping = {
        recipientName: address.recipientName,
        recipientPhone: address.recipientPhone,
        provinceCity: address.provinceCity,
        district: address.district,
        ward: address.ward,
        streetAddress: address.streetAddress,
        shippingNotes: data.shippingNotes || address.notes || undefined,
      };
    }

    if (
      !shipping ||
      !shipping.recipientName?.trim() ||
      !shipping.recipientPhone?.trim() ||
      !shipping.provinceCity?.trim() ||
      !shipping.district?.trim() ||
      !shipping.ward?.trim() ||
      !shipping.streetAddress?.trim()
    ) {
      throw {
        statusCode: 400,
        message:
          'Vui lòng cung cấp đầy đủ thông tin giao hàng (Người nhận, SĐT, Tỉnh/Thành phố, Quận/Huyện, Phường/Xã, Địa chỉ cụ thể).',
      };
    }

    // Lấy email người dùng để gửi email xác nhận sau khi tạo đơn thành công
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, fullName: true },
    });

    if (!user) {
      throw { statusCode: 404, message: 'Người dùng không tồn tại.' };
    }

    const paymentMethod = data.paymentMethod || PaymentMethod.COD;

    // 2. Thực hiện transaction toàn vẹn
    const createdOrder = await prisma.$transaction(async (tx) => {
      // 2.1. Xác định danh sách item cần đặt và danh sách ID cần dọn khỏi giỏ hàng
      let itemsToOrder: Array<{ variantId: string; quantity: number }> = [];
      let cartItemIdsToDelete: string[] = [];

      // TH 1: Client truyền cụ thể cartItemIds (các món được tích chọn checkbox ở giỏ)
      if (data.cartItemIds && data.cartItemIds.length > 0) {
        const cart = await tx.cart.findUnique({
          where: { userId },
          include: {
            items: {
              where: { id: { in: data.cartItemIds } },
            },
          },
        });

        if (!cart || cart.items.length === 0) {
          throw { statusCode: 400, message: 'Không tìm thấy sản phẩm hợp lệ nào trong các món đã tích chọn.' };
        }

        itemsToOrder = cart.items.map((i) => ({
          variantId: i.variantId,
          quantity: i.quantity,
        }));
        cartItemIdsToDelete = cart.items.map((i) => i.id);
      }
      // TH 2: Mua ngay trực tiếp (Buy Now không thông qua giỏ)
      else if (data.items && data.items.length > 0) {
        itemsToOrder = data.items.map((i) => ({
          variantId: i.variantId,
          quantity: Math.max(1, Math.floor(Number(i.quantity) || 1)),
        }));
        cartItemIdsToDelete = [];
      }
      // TH 3: Lấy các sản phẩm đang được tích chọn (isSelected: true) trong giỏ hàng
      else {
        const cart = await tx.cart.findUnique({
          where: { userId },
          include: {
            items: {
              where: { isSelected: true },
            },
          },
        });

        if (!cart || cart.items.length === 0) {
          throw {
            statusCode: 400,
            message: 'Vui lòng tích chọn (checkbox) ít nhất một sản phẩm trong giỏ hàng để tạo đơn hàng.',
          };
        }

        itemsToOrder = cart.items.map((i) => ({
          variantId: i.variantId,
          quantity: i.quantity,
        }));
        cartItemIdsToDelete = cart.items.map((i) => i.id);
      }

      // 2.2. Kiểm tra tồn kho & lock biến thể
      let subtotal = 0;
      const orderItemsData = [];

      for (const item of itemsToOrder) {
        const variant = await tx.productVariant.findUnique({
          where: { id: item.variantId },
          include: { product: true },
        });

        if (!variant || !variant.isActive) {
          throw { statusCode: 400, message: 'Sản phẩm không tồn tại hoặc đã ngừng kinh doanh.' };
        }

        if (variant.product.status !== 'PUBLISHED') {
          throw { statusCode: 400, message: `Sản phẩm "${variant.product.name}" hiện không mở bán.` };
        }

        if (variant.stockQuantity < item.quantity) {
          throw {
            statusCode: 400,
            message: `Sản phẩm "${variant.product.name} (${variant.name})" chỉ còn tồn kho ${variant.stockQuantity} chiếc, không đủ ${item.quantity}.`,
          };
        }

        const originalPrice = Number(variant.originalPrice);
        const salePrice = variant.salePrice ? Number(variant.salePrice) : null;
        const effectivePrice = salePrice !== null ? salePrice : originalPrice;
        const itemTotal = effectivePrice * item.quantity;

        subtotal += itemTotal;

        orderItemsData.push({
          productId: variant.product.id,
          variantId: variant.id,
          productName: variant.product.name,
          variantName: variant.name,
          sku: variant.sku,
          thumbnail: variant.imageUrl || variant.product.thumbnail,
          price: new Prisma.Decimal(effectivePrice),
          originalPrice: new Prisma.Decimal(originalPrice),
          quantity: item.quantity,
          totalPrice: new Prisma.Decimal(itemTotal),
        });

        // Trừ tồn kho biến thể
        await tx.productVariant.update({
          where: { id: variant.id },
          data: {
            stockQuantity: { decrement: item.quantity },
          },
        });

        // Tăng lượt bán cho sản phẩm cha
        await tx.product.update({
          where: { id: variant.productId },
          data: {
            soldCount: { increment: item.quantity },
          },
        });
      }

      // 2.3. Tính phí giao hàng
      const shippingFee = this.calculateShippingFee(subtotal);

      // 2.4. Xử lý Coupon nếu có
      let discountAmount = 0;
      let appliedCouponId: string | null = null;
      let appliedCouponCode: string | null = null;

      if (data.couponCode) {
        const code = data.couponCode.trim().toUpperCase();
        const coupon = await tx.coupon.findUnique({
          where: { code },
        });

        if (!coupon || !coupon.isActive) {
          throw { statusCode: 400, message: `Mã giảm giá '${code}' không hợp lệ hoặc đã hết hạn.` };
        }

        const now = new Date();
        if (now < coupon.startDate || now > coupon.endDate) {
          throw { statusCode: 400, message: `Mã giảm giá '${code}' không trong thời gian áp dụng.` };
        }

        if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
          throw { statusCode: 400, message: `Mã giảm giá '${code}' đã hết lượt sử dụng.` };
        }

        const minOrder = coupon.minOrderValue ? Number(coupon.minOrderValue) : 0;
        if (subtotal < minOrder) {
          throw {
            statusCode: 400,
            message: `Mã '${code}' yêu cầu đơn hàng tối thiểu ${minOrder.toLocaleString('vi-VN')} đ.`,
          };
        }

        if (coupon.userUsageLimit) {
          const userCount = await tx.couponUsage.count({
            where: { couponId: coupon.id, userId },
          });
          if (userCount >= coupon.userUsageLimit) {
            throw {
              statusCode: 400,
              message: `Bạn đã sử dụng hết lượt cho phép của mã '${code}'.`,
            };
          }
        }

        const discountVal = Number(coupon.discountValue);
        if (coupon.discountType === DiscountType.PERCENTAGE) {
          discountAmount = (subtotal * discountVal) / 100;
          if (coupon.maxDiscountAmount) {
            const maxDiscount = Number(coupon.maxDiscountAmount);
            if (discountAmount > maxDiscount) discountAmount = maxDiscount;
          }
        } else {
          discountAmount = Math.min(discountVal, subtotal);
        }

        discountAmount = Math.round(discountAmount);
        appliedCouponId = coupon.id;
        appliedCouponCode = coupon.code;

        // Tăng số lượt dùng coupon
        await tx.coupon.update({
          where: { id: coupon.id },
          data: { usedCount: { increment: 1 } },
        });
      }

      const totalAmount = Math.max(0, subtotal + shippingFee - discountAmount);
      const orderCode = this.generateOrderCode();

      // 2.5. Tạo đơn hàng (Order)
      const order = await tx.order.create({
        data: {
          orderCode,
          userId,
          status: OrderStatus.PENDING,
          recipientName: shipping!.recipientName.trim(),
          recipientPhone: shipping!.recipientPhone.trim(),
          provinceCity: shipping!.provinceCity.trim(),
          district: shipping!.district.trim(),
          ward: shipping!.ward.trim(),
          streetAddress: shipping!.streetAddress.trim(),
          shippingNotes: shipping!.shippingNotes?.trim() || data.shippingNotes?.trim(),
          subtotal: new Prisma.Decimal(subtotal),
          shippingFee: new Prisma.Decimal(shippingFee),
          discountAmount: new Prisma.Decimal(discountAmount),
          totalAmount: new Prisma.Decimal(totalAmount),
          couponId: appliedCouponId,
          couponCode: appliedCouponCode,
          items: {
            create: orderItemsData,
          },
          payment: {
            create: {
              method: paymentMethod,
              status: PaymentStatus.PENDING,
              amount: new Prisma.Decimal(totalAmount),
            },
          },
        },
        include: {
          items: true,
          payment: true,
        },
      });

      // 2.6. Ghi nhận CouponUsage nếu áp dụng
      if (appliedCouponId) {
        await tx.couponUsage.create({
          data: {
            couponId: appliedCouponId,
            userId,
            orderId: order.id,
          },
        });
      }

      // 2.7. CHỈ xoá các sản phẩm ĐÃ ĐẶT HÀNG khỏi giỏ hàng (các món không tích chọn vẫn giữ nguyên vẹn)
      if (cartItemIdsToDelete.length > 0) {
        await tx.cartItem.deleteMany({
          where: {
            id: { in: cartItemIdsToDelete },
            cart: { userId },
          },
        });
      }

      return order;
    });

    // 3. Gửi email xác nhận đơn hàng không đồng bộ (không chặn response trả về)
    const fullAddress = `${shipping!.streetAddress}, ${shipping!.ward}, ${shipping!.district}, ${shipping!.provinceCity}`;
    emailService
      .sendOrderConfirmationEmail(user.email, {
        orderCode: createdOrder.orderCode,
        recipientName: createdOrder.recipientName,
        recipientPhone: createdOrder.recipientPhone,
        shippingAddress: fullAddress,
        totalAmount: Number(createdOrder.totalAmount),
        subtotal: Number(createdOrder.subtotal),
        shippingFee: Number(createdOrder.shippingFee),
        discountAmount: Number(createdOrder.discountAmount),
        paymentMethod: createdOrder.payment?.method || 'COD',
        items: createdOrder.items.map((i) => ({
          productName: i.productName,
          variantName: i.variantName,
          quantity: i.quantity,
          price: Number(i.price),
          thumbnail: i.thumbnail,
        })),
      })
      .catch((err) => {
        console.error('[OrderService] Lỗi gửi email xác nhận:', err);
      });

    return createdOrder;
  }

  /**
   * Lấy danh sách đơn hàng của khách hàng hiện tại
   */
  async getUserOrders(userId: string, query: { page?: number; limit?: number; status?: OrderStatus }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(50, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = { userId };
    if (query.status) {
      where.status = query.status;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        include: {
          items: true,
          payment: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Xem chi tiết một đơn hàng theo ID hoặc OrderCode (Kiểm tra quyền sở hữu)
   */
  async getOrderById(orderIdentifier: string, userId?: string, userRole?: Role) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      orderIdentifier
    );

    const where: Prisma.OrderWhereInput = isUuid
      ? { id: orderIdentifier }
      : { orderCode: orderIdentifier };

    const order = await prisma.order.findFirst({
      where,
      include: {
        items: true,
        payment: true,
        coupon: {
          select: {
            code: true,
            title: true,
            discountType: true,
            discountValue: true,
          },
        },
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
          },
        },
      },
    });

    if (!order) {
      throw { statusCode: 404, message: 'Không tìm thấy đơn hàng.' };
    }

    // Nếu không phải ADMIN hoặc STAFF thì chỉ được xem đơn hàng của chính mình
    if (userRole !== Role.ADMIN && userRole !== Role.STAFF && order.userId !== userId) {
      throw { statusCode: 403, message: 'Bạn không có quyền truy cập đơn hàng này.' };
    }

    return order;
  }

  /**
   * Huỷ đơn hàng (Khách hàng huỷ khi PENDING, hoặc Admin/Staff huỷ)
   * Hoàn trả tồn kho và lượt sử dụng mã giảm giá
   */
  async cancelOrder(orderId: string, userId: string, reason?: string, userRole?: Role) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, payment: true },
    });

    if (!order) {
      throw { statusCode: 404, message: 'Đơn hàng không tồn tại.' };
    }

    const isAdmin = userRole === Role.ADMIN || userRole === Role.STAFF;

    if (!isAdmin && order.userId !== userId) {
      throw { statusCode: 403, message: 'Bạn không có quyền huỷ đơn hàng này.' };
    }

    // Khách hàng chỉ được huỷ đơn khi còn ở trạng thái PENDING
    if (!isAdmin && order.status !== OrderStatus.PENDING) {
      throw {
        statusCode: 400,
        message: `Đơn hàng đang ở trạng thái "${order.status}". Bạn chỉ có thể huỷ đơn khi ở trạng thái Chờ xử lý (PENDING). Vui lòng liên hệ hotline hỗ trợ.`,
      };
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw { statusCode: 400, message: 'Đơn hàng này đã được huỷ trước đó.' };
    }

    if (order.status === OrderStatus.DELIVERED) {
      throw { statusCode: 400, message: 'Đơn hàng đã được giao thành công, không thể huỷ.' };
    }

    // Hoàn trả tồn kho và coupon trong transaction
    return prisma.$transaction(async (tx) => {
      // 1. Hoàn trả tồn kho cho các biến thể
      for (const item of order.items) {
        if (item.variantId) {
          await tx.productVariant.updateMany({
            where: { id: item.variantId },
            data: {
              stockQuantity: { increment: item.quantity },
            },
          });
        }

        if (item.productId) {
          await tx.product.updateMany({
            where: { id: item.productId },
            data: {
              soldCount: { decrement: item.quantity },
            },
          });
        }
      }

      // 2. Hoàn trả coupon nếu có
      if (order.couponId) {
        await tx.coupon.updateMany({
          where: { id: order.couponId },
          data: {
            usedCount: { decrement: 1 },
          },
        });

        await tx.couponUsage.deleteMany({
          where: { orderId: order.id },
        });
      }

      // 3. Cập nhật trạng thái đơn hàng
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CANCELLED,
          cancelReason: reason || 'Khách hàng yêu cầu huỷ đơn',
          cancelledAt: new Date(),
        },
        include: {
          items: true,
          payment: true,
        },
      });

      return updatedOrder;
    });
  }

  /**
   * Danh sách đơn hàng cho Admin / Staff (Có bộ lọc trạng thái, tìm kiếm, ngày tháng)
   */
  async getAdminOrders(query: OrderFilterQuery) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.paymentStatus) {
      where.payment = { status: query.paymentStatus };
    }

    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { orderCode: { contains: term, mode: 'insensitive' } },
        { recipientName: { contains: term, mode: 'insensitive' } },
        { recipientPhone: { contains: term } },
      ];
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        include: {
          items: true,
          payment: true,
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phoneNumber: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Cập nhật trạng thái đơn hàng (Admin/Staff)
   */
  async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    paymentStatus?: PaymentStatus,
    cancelReason?: string
  ) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, payment: true },
    });

    if (!order) {
      throw { statusCode: 404, message: 'Đơn hàng không tồn tại.' };
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw { statusCode: 400, message: 'Đơn hàng đã huỷ, không thể đổi trạng thái khác.' };
    }

    // Nếu chuyển sang CANCELLED, gọi qua cancelOrder để hoàn trả kho
    if (status === OrderStatus.CANCELLED) {
      return this.cancelOrder(orderId, order.userId, cancelReason, Role.ADMIN);
    }

    const updateData: Prisma.OrderUpdateInput = {
      status,
    };

    const now = new Date();
    if (status === OrderStatus.CONFIRMED && !order.confirmedAt) {
      updateData.confirmedAt = now;
    } else if (status === OrderStatus.SHIPPING && !order.shippedAt) {
      updateData.shippedAt = now;
    } else if (status === OrderStatus.DELIVERED && !order.deliveredAt) {
      updateData.deliveredAt = now;
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: { payment: true, items: true },
    });

    // Nếu chuyển sang DELIVERED và thanh toán COD, tự động cập nhật Payment sang PAID
    if (status === OrderStatus.DELIVERED && order.payment?.method === PaymentMethod.COD) {
      await prisma.payment.update({
        where: { orderId: order.id },
        data: {
          status: PaymentStatus.PAID,
          paidAt: now,
        },
      });
    } else if (paymentStatus && order.payment) {
      await prisma.payment.update({
        where: { orderId: order.id },
        data: {
          status: paymentStatus,
          paidAt: paymentStatus === PaymentStatus.PAID ? now : undefined,
        },
      });
    }

    return this.getOrderById(orderId, undefined, Role.ADMIN);
  }
}

export const orderService = new OrderService();
