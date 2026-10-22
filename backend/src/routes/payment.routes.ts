import { Router } from 'express';
import {
  getPaymentMethods,
  getPaymentDetails,
  createMomoPaymentUrl,
  handleMomoIpn,
  confirmCustomerTransfer,
  verifyPaymentByAdmin,
} from '../controllers/payment.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { authorizeRoles } from '../middlewares/role.middleware';
import { validateUuidParam } from '../middlewares/validate.middleware';
import { Role } from '@prisma/client';

const router = Router();

// --- 1. ROUTE CÔNG KHAI (PUBLIC) ---
// [GET] /payments/methods - Xem danh sách các phương thức thanh toán (Tiền mặt, MoMo, Ngân hàng)
router.get('/methods', getPaymentMethods);

// [POST] /payments/momo/ipn - Webhook IPN nhận kết quả thanh toán từ MoMo Server (MoMo gọi trực tiếp, không dùng JWT)
router.post('/momo/ipn', handleMomoIpn);

// --- 2. CÁC ROUTE YÊU CẦU ĐĂNG NHẬP (AUTHENTICATED) ---
router.use(authenticateToken);

// [GET] /payments/order/:orderId - Lấy mã QR MoMo và hướng dẫn thanh toán chi tiết cho đơn hàng
router.get('/order/:orderId', getPaymentDetails);

// [POST] /payments/momo/create-url - Tạo URL / mã QR thanh toán MoMo cho đơn hàng
router.post('/momo/create-url', createMomoPaymentUrl);

// [POST] /payments/order/:orderId/confirm-transfer - Khách gửi thông báo đã chuyển khoản ví MoMo
router.post('/order/:orderId/confirm-transfer', validateUuidParam('orderId'), confirmCustomerTransfer);

// --- 3. QUẢN TRỊ VIÊN DUYỆT THANH TOÁN (ADMIN & STAFF) ---
// [PATCH] /payments/admin/order/:orderId/verify - Admin duyệt thanh toán khi đã kiểm tra ví MoMo
router.patch(
  '/admin/order/:orderId/verify',
  authorizeRoles(Role.ADMIN, Role.STAFF),
  validateUuidParam('orderId'),
  verifyPaymentByAdmin
);

export default router;
