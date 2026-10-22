import { Request, Response } from 'express';
import { paymentService } from '../services/payment.service';
import { Role } from '@prisma/client';

/**
 * [GET] /payments/methods - Lấy danh sách phương thức thanh toán hỗ trợ (COD, MoMo, Chuyển khoản)
 */
export const getPaymentMethods = async (req: Request, res: Response): Promise<void> => {
  try {
    const methods = await paymentService.getPaymentMethods();
    res.json({
      success: true,
      data: methods,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Lỗi lấy danh sách phương thức thanh toán',
    });
  }
};

/**
 * [GET] /payments/order/:orderId - Lấy thông tin thanh toán chi tiết, mã MoMo QR và VietQR
 */
export const getPaymentDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const userRole = req.user!.role as Role;
    const { orderId } = req.params as { orderId: string };

    const details = await paymentService.getPaymentDetails(orderId, userId, userRole);
    res.json({
      success: true,
      data: details,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Lỗi lấy thông tin thanh toán đơn hàng',
    });
  }
};

/**
 * [POST] /payments/momo/create-url - Tạo liên kết / mã QR thanh toán MoMo cho đơn hàng
 */
export const createMomoPaymentUrl = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { orderId } = req.body;

    if (!orderId) {
      res.status(400).json({ success: false, message: 'Vui lòng cung cấp mã đơn hàng orderId.' });
      return;
    }

    const result = await paymentService.createMomoPaymentUrl(orderId, userId);
    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Lỗi tạo liên kết thanh toán MoMo',
    });
  }
};

/**
 * [POST] /payments/momo/ipn - Webhook IPN nhận kết quả thanh toán từ MoMo Server
 */
export const handleMomoIpn = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await paymentService.handleMomoIpn(req.body);
    res.status(result.status || 204).json({ message: 'IPN processed' });
  } catch (error: any) {
    console.error('[MoMo IPN Controller Error]:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * [POST] /payments/order/:orderId/confirm-transfer - Khách hàng xác nhận đã chuyển khoản qua MoMo
 */
export const confirmCustomerTransfer = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { orderId } = req.params as { orderId: string };
    const { transactionCode, note } = req.body;

    const result = await paymentService.confirmCustomerTransfer(orderId, userId, {
      transactionCode,
      note,
    });

    res.json({
      success: true,
      message: result.message,
      data: result.payment,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Lỗi xác nhận chuyển khoản',
    });
  }
};

/**
 * [PATCH] /payments/admin/order/:orderId/verify - Admin duyệt thanh toán khi đã kiểm tra ví MoMo
 */
export const verifyPaymentByAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params as { orderId: string };
    const { isApproved, transactionCode, note } = req.body;

    if (isApproved === undefined) {
      res.status(400).json({ success: false, message: 'Vui lòng cung cấp quyết định duyệt (isApproved: true/false).' });
      return;
    }

    const result = await paymentService.verifyPaymentByAdmin(orderId, {
      isApproved: Boolean(isApproved),
      transactionCode,
      note,
    });

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Lỗi duyệt thanh toán',
    });
  }
};
