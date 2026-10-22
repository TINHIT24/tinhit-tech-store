import { Request, Response } from 'express';
import { couponService } from '../services/coupon.service';

/**
 * [GET] /coupons/active - Lấy danh sách mã giảm giá đang hoạt động (Public)
 */
export const getActiveCoupons = async (req: Request, res: Response): Promise<void> => {
  try {
    const coupons = await couponService.getActiveCoupons();
    res.json({
      success: true,
      data: coupons,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Lỗi lấy danh sách mã giảm giá',
    });
  }
};

/**
 * [POST] /coupons/validate - Kiểm tra tính hợp lệ & tính giảm giá cho đơn hàng
 */
export const validateCoupon = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, subtotal } = req.body;
    const userId = req.user?.userId;

    if (!code) {
      res.status(400).json({ success: false, message: 'Vui lòng cung cấp mã code giảm giá.' });
      return;
    }

    if (subtotal === undefined || isNaN(Number(subtotal))) {
      res.status(400).json({ success: false, message: 'Vui lòng cung cấp số tiền đơn hàng subtotal hợp lệ.' });
      return;
    }

    const result = await couponService.validateCoupon(code, Number(subtotal), userId);
    res.json({
      success: true,
      message: 'Áp dụng mã giảm giá thành công!',
      data: result,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Mã giảm giá không hợp lệ',
    });
  }
};

/**
 * [GET] /coupons - Quản lý danh sách mã giảm giá (Admin)
 */
export const getCoupons = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit, search, isActive } = req.query;
    const result = await couponService.getCoupons({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
      search: search ? String(search) : undefined,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Lỗi lấy danh sách coupon',
    });
  }
};

/**
 * [POST] /coupons - Tạo mã giảm giá mới (Admin)
 */
export const createCoupon = async (req: Request, res: Response): Promise<void> => {
  try {
    const coupon = await couponService.createCoupon(req.body);
    res.status(201).json({
      success: true,
      message: 'Tạo mã giảm giá thành công!',
      data: coupon,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Lỗi tạo mã giảm giá',
    });
  }
};

/**
 * [PUT] /coupons/:id - Cập nhật mã giảm giá (Admin)
 */
export const updateCoupon = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const coupon = await couponService.updateCoupon(id, req.body);
    res.json({
      success: true,
      message: 'Cập nhật mã giảm giá thành công!',
      data: coupon,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Lỗi cập nhật mã giảm giá',
    });
  }
};

/**
 * [DELETE] /coupons/:id - Xoá mã giảm giá (Admin)
 */
export const deleteCoupon = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    await couponService.deleteCoupon(id);
    res.json({
      success: true,
      message: 'Xoá hoặc ngừng áp dụng mã giảm giá thành công!',
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Lỗi xoá mã giảm giá',
    });
  }
};
