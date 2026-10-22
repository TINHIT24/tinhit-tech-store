import { Request, Response } from 'express';
import { orderService } from '../services/order.service';
import { OrderStatus, PaymentStatus, Role } from '@prisma/client';

/**
 * [POST] /orders/preview - Xem trước thông tin đơn hàng trước khi bấm đặt (tính tiền, ship, coupon)
 */
export const checkoutPreview = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const result = await orderService.checkoutPreview(userId, req.body);
    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Lỗi kiểm tra đơn hàng',
    });
  }
};

/**
 * [POST] /orders - Đặt hàng chính thức (Checkout)
 */
export const createOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const order = await orderService.createOrder(userId, req.body);
    res.status(201).json({
      success: true,
      message: 'Đặt hàng thành công!',
      data: order,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Lỗi tạo đơn hàng',
    });
  }
};

/**
 * [GET] /orders - Lấy danh sách đơn hàng của khách hàng hiện tại
 */
export const getUserOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { page, limit, status } = req.query;

    const result = await orderService.getUserOrders(userId, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
      status: status ? (status as OrderStatus) : undefined,
    });

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Lỗi lấy danh sách đơn hàng',
    });
  }
};

/**
 * [GET] /orders/:id - Xem chi tiết một đơn hàng
 */
export const getOrderById = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const userRole = req.user!.role as Role;
    const { id } = req.params as { id: string };

    const order = await orderService.getOrderById(id, userId, userRole);
    res.json({
      success: true,
      data: order,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Lỗi xem chi tiết đơn hàng',
    });
  }
};

/**
 * [PATCH] /orders/:id/cancel - Khách hàng huỷ đơn hàng
 */
export const cancelOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const userRole = req.user!.role as Role;
    const { id } = req.params as { id: string };
    const { reason } = req.body;

    const order = await orderService.cancelOrder(id, userId, reason, userRole);
    res.json({
      success: true,
      message: 'Huỷ đơn hàng thành công!',
      data: order,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Lỗi huỷ đơn hàng',
    });
  }
};

/**
 * [GET] /orders/admin/all - Danh sách tất cả đơn hàng (Admin/Staff)
 */
export const getAdminOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit, status, paymentStatus, search, startDate, endDate } = req.query;

    const result = await orderService.getAdminOrders({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
      status: status ? (status as OrderStatus) : undefined,
      paymentStatus: paymentStatus ? (paymentStatus as PaymentStatus) : undefined,
      search: search ? String(search) : undefined,
      startDate: startDate ? String(startDate) : undefined,
      endDate: endDate ? String(endDate) : undefined,
    });

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Lỗi lấy danh sách đơn hàng quản trị',
    });
  }
};

/**
 * [PATCH] /orders/admin/:id/status - Cập nhật trạng thái đơn hàng (Admin/Staff)
 */
export const updateOrderStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const { status, paymentStatus, cancelReason } = req.body;

    if (!status) {
      res.status(400).json({ success: false, message: 'Vui lòng cung cấp trạng thái mới cho đơn hàng.' });
      return;
    }

    const order = await orderService.updateOrderStatus(
      id,
      status as OrderStatus,
      paymentStatus as PaymentStatus | undefined,
      cancelReason
    );

    res.json({
      success: true,
      message: `Đã cập nhật trạng thái đơn hàng sang ${status}!`,
      data: order,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Lỗi cập nhật trạng thái đơn hàng',
    });
  }
};
