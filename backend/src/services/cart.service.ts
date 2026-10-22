import prisma from '../config/prisma';

export interface AddToCartDto {
  variantId: string;
  quantity: number;
}

export class CartService {
  /**
   * Lấy hoặc tự động tạo giỏ hàng cho người dùng
   */
  async getOrCreateCart(userId: string) {
    return prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  /**
   * Xem chi tiết giỏ hàng hiện tại của người dùng
   * Bao gồm cả tổng tiền toàn bộ giỏ và tổng tiền chỉ các món được TÍCH CHỌN (selected)
   */
  async getCart(userId: string) {
    const cart = await this.getOrCreateCart(userId);

    const items = await prisma.cartItem.findMany({
      where: { cartId: cart.id },
      include: {
        variant: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                thumbnail: true,
                status: true,
                warrantyMonths: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    let cartSubtotal = 0;
    let totalItems = 0;
    let totalQuantity = 0;

    let selectedSubtotal = 0;
    let selectedTotalItems = 0;
    let selectedTotalQuantity = 0;

    const formattedItems = items.map((item) => {
      const variant = item.variant;
      const product = variant.product;
      const originalPrice = Number(variant.originalPrice);
      const salePrice = variant.salePrice ? Number(variant.salePrice) : null;
      const effectivePrice = salePrice !== null ? salePrice : originalPrice;
      const itemSubtotal = effectivePrice * item.quantity;

      const isOutOfStock = variant.stockQuantity <= 0;
      const isInsufficient = item.quantity > variant.stockQuantity;
      const isAvailable = variant.isActive && product.status === 'PUBLISHED' && !isOutOfStock;

      if (isAvailable && !isInsufficient) {
        cartSubtotal += itemSubtotal;
        if (item.isSelected) {
          selectedSubtotal += itemSubtotal;
          selectedTotalItems += 1;
          selectedTotalQuantity += item.quantity;
        }
      }

      totalItems += 1;
      totalQuantity += item.quantity;

      return {
        id: item.id,
        variantId: item.variantId,
        quantity: item.quantity,
        isSelected: item.isSelected,
        sku: variant.sku,
        variantName: variant.name,
        attributes: variant.attributes,
        imageUrl: variant.imageUrl || product.thumbnail,
        originalPrice,
        salePrice,
        effectivePrice,
        itemSubtotal,
        stockQuantity: variant.stockQuantity,
        isOutOfStock,
        isInsufficient,
        isAvailable,
        product: {
          id: product.id,
          name: product.name,
          slug: product.slug,
          thumbnail: product.thumbnail,
          status: product.status,
          warrantyMonths: product.warrantyMonths,
        },
      };
    });

    return {
      cartId: cart.id,
      totalItems,
      totalQuantity,
      subtotal: cartSubtotal,
      // Thống kê dành riêng cho các món được tích chọn
      selectedTotalItems,
      selectedTotalQuantity,
      selectedSubtotal,
      items: formattedItems,
    };
  }

  /**
   * Thêm sản phẩm biến thể vào giỏ hàng
   */
  async addToCart(userId: string, data: AddToCartDto) {
    const { variantId } = data;
    const quantity = Math.max(1, Number(data.quantity) || 1);

    // Kiểm tra biến thể và sản phẩm cha
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: true },
    });

    if (!variant || !variant.isActive) {
      throw { statusCode: 404, message: 'Phiên bản sản phẩm không tồn tại hoặc đã ngừng kinh doanh.' };
    }

    if (variant.product.status !== 'PUBLISHED') {
      throw { statusCode: 400, message: 'Sản phẩm hiện không ở trạng thái mở bán.' };
    }

    if (variant.stockQuantity <= 0) {
      throw { statusCode: 400, message: 'Sản phẩm này hiện đã hết hàng.' };
    }

    const cart = await this.getOrCreateCart(userId);

    // Kiểm tra item đã tồn tại trong giỏ chưa
    const existingItem = await prisma.cartItem.findUnique({
      where: {
        cartId_variantId: {
          cartId: cart.id,
          variantId,
        },
      },
    });

    const currentQuantity = existingItem ? existingItem.quantity : 0;
    const newQuantity = currentQuantity + quantity;

    if (newQuantity > variant.stockQuantity) {
      throw {
        statusCode: 400,
        message: `Số lượng yêu cầu (${newQuantity}) vượt quá tồn kho hiện có (${variant.stockQuantity}).`,
      };
    }

    if (existingItem) {
      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: newQuantity,
          isSelected: true,
        },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          variantId,
          quantity,
          isSelected: true,
        },
      });
    }

    return this.getCart(userId);
  }

  /**
   * Cập nhật số lượng của 1 sản phẩm trong giỏ hàng
   */
  async updateQuantity(userId: string, itemId: string, quantity: number) {
    const cart = await this.getOrCreateCart(userId);

    const item = await prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cartId: cart.id,
      },
      include: { variant: true },
    });

    if (!item) {
      throw { statusCode: 404, message: 'Không tìm thấy sản phẩm trong giỏ hàng.' };
    }

    const newQty = Number(quantity);

    if (newQty <= 0) {
      // Nếu số lượng <= 0 thì tự động xoá khỏi giỏ
      await prisma.cartItem.delete({ where: { id: itemId } });
      return this.getCart(userId);
    }

    if (newQty > item.variant.stockQuantity) {
      throw {
        statusCode: 400,
        message: `Tồn kho chỉ còn ${item.variant.stockQuantity} sản phẩm. Không thể chọn ${newQty}.`,
      };
    }

    await prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity: newQty },
    });

    return this.getCart(userId);
  }

  /**
   * Tích chọn (checkbox) hoặc Bỏ chọn 1 sản phẩm trong giỏ
   */
  async updateItemSelect(userId: string, itemId: string, isSelected?: boolean) {
    const cart = await this.getOrCreateCart(userId);

    const item = await prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cartId: cart.id,
      },
    });

    if (!item) {
      throw { statusCode: 404, message: 'Không tìm thấy sản phẩm trong giỏ hàng.' };
    }

    const nextSelected = isSelected !== undefined ? Boolean(isSelected) : !item.isSelected;

    await prisma.cartItem.update({
      where: { id: itemId },
      data: { isSelected: nextSelected },
    });

    return this.getCart(userId);
  }

  /**
   * Tích chọn tất cả hoặc Bỏ chọn tất cả sản phẩm trong giỏ
   */
  async selectAll(userId: string, isSelected: boolean) {
    const cart = await this.getOrCreateCart(userId);

    await prisma.cartItem.updateMany({
      where: { cartId: cart.id },
      data: { isSelected: Boolean(isSelected) },
    });

    return this.getCart(userId);
  }

  /**
   * Xoá 1 sản phẩm khỏi giỏ hàng
   */
  async removeItem(userId: string, itemId: string) {
    const cart = await this.getOrCreateCart(userId);

    const item = await prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cartId: cart.id,
      },
    });

    if (!item) {
      throw { statusCode: 404, message: 'Không tìm thấy sản phẩm trong giỏ hàng.' };
    }

    await prisma.cartItem.delete({ where: { id: itemId } });
    return this.getCart(userId);
  }

  /**
   * Xoá toàn bộ giỏ hàng
   */
  async clearCart(userId: string) {
    const cart = await this.getOrCreateCart(userId);
    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    return {
      cartId: cart.id,
      totalItems: 0,
      totalQuantity: 0,
      subtotal: 0,
      selectedTotalItems: 0,
      selectedTotalQuantity: 0,
      selectedSubtotal: 0,
      items: [],
    };
  }
}

export const cartService = new CartService();
