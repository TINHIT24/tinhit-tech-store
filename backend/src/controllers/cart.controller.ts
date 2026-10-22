import { Request, Response } from 'express';
import { cartService } from '../services/cart.service';

/**
 * [GET] /cart - Xem giỏ hàng của người dùng hiện tại
 */
export const getCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const cart = await cartService.getCart(userId);
    res.json({
      success: true,
      data: cart,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Lỗi lấy thông tin giỏ hàng',
    });
  }
};

/**
 * [POST] /cart/items - Thêm sản phẩm biến thể vào giỏ hàng
 */
export const addToCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { variantId, quantity } = req.body;

    if (!variantId) {
      res.status(400).json({ success: false, message: 'Vui lòng cung cấp variantId của sản phẩm.' });
      return;
    }

    const cart = await cartService.addToCart(userId, {
      variantId,
      quantity: quantity ? Number(quantity) : 1,
    });

    res.status(200).json({
      success: true,
      message: 'Đã thêm sản phẩm vào giỏ hàng!',
      data: cart,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Lỗi thêm sản phẩm vào giỏ hàng',
    });
  }
};

/**
 * [PUT] /cart/items/:itemId - Cập nhật số lượng sản phẩm trong giỏ
 */
export const updateQuantity = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { itemId } = req.params as { itemId: string };
    const { quantity } = req.body;

    if (quantity === undefined || isNaN(Number(quantity))) {
      res.status(400).json({ success: false, message: 'Vui lòng cung cấp số lượng hợp lệ.' });
      return;
    }

    const cart = await cartService.updateQuantity(userId, itemId, Number(quantity));
    res.json({
      success: true,
      message: 'Cập nhật số lượng thành công!',
      data: cart,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Lỗi cập nhật số lượng giỏ hàng',
    });
  }
};

/**
 * [PATCH] /cart/items/:itemId/select - Tích chọn (checkbox) hoặc Bỏ chọn 1 sản phẩm
 */
export const toggleItemSelect = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { itemId } = req.params as { itemId: string };
    const { isSelected } = req.body;

    const cart = await cartService.updateItemSelect(userId, itemId, isSelected);
    res.json({
      success: true,
      message: 'Cập nhật trạng thái chọn sản phẩm thành công!',
      data: cart,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Lỗi cập nhật chọn sản phẩm',
    });
  }
};

/**
 * [PATCH] /cart/select-all - Chọn tất cả hoặc bỏ chọn tất cả
 */
export const toggleSelectAll = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { isSelected } = req.body;

    const cart = await cartService.selectAll(userId, isSelected !== undefined ? Boolean(isSelected) : true);
    res.json({
      success: true,
      message: isSelected ? 'Đã chọn tất cả sản phẩm trong giỏ!' : 'Đã bỏ chọn tất cả sản phẩm!',
      data: cart,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Lỗi chọn tất cả sản phẩm',
    });
  }
};

/**
 * [DELETE] /cart/items/:itemId - Xóa một sản phẩm khỏi giỏ hàng
 */
export const removeCartItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { itemId } = req.params as { itemId: string };

    const cart = await cartService.removeItem(userId, itemId);
    res.json({
      success: true,
      message: 'Đã xóa sản phẩm khỏi giỏ hàng!',
      data: cart,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Lỗi xóa sản phẩm khỏi giỏ hàng',
    });
  }
};

/**
 * [DELETE] /cart - Làm trống toàn bộ giỏ hàng
 */
export const clearCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const result = await cartService.clearCart(userId);
    res.json({
      success: true,
      message: 'Đã làm trống giỏ hàng!',
      data: result,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Lỗi làm trống giỏ hàng',
    });
  }
};
