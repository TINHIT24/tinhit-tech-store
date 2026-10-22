import { Router } from 'express';
import {
  checkoutPreview,
  createOrder,
  getUserOrders,
  getOrderById,
  cancelOrder,
  getAdminOrders,
  updateOrderStatus,
} from '../controllers/order.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { authorizeRoles } from '../middlewares/role.middleware';
import { validateUuidParam } from '../middlewares/validate.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Yêu cầu đăng nhập cho toàn bộ luồng đơn hàng
router.use(authenticateToken);

// --- 1. KHÁCH HÀNG: CHECKOUT & TẠO ĐƠN ---
// [POST] /orders/preview - Xem trước thông tin đơn hàng, phí ship, mã giảm giá
router.post('/preview', checkoutPreview);

// [POST] /orders - Đặt hàng chính thức
router.post('/', createOrder);

// [GET] /orders - Lấy danh sách đơn hàng đã mua của khách
router.get('/', getUserOrders);

// --- 2. ADMIN & STAFF: QUẢN TRỊ ĐƠN HÀNG ---
// [GET] /orders/admin/all - Quản trị đơn hàng toàn hệ thống
router.get('/admin/all', authorizeRoles(Role.ADMIN, Role.STAFF), getAdminOrders);

// [PATCH] /orders/admin/:id/status - Cập nhật trạng thái đơn hàng (CONFIRMED, SHIPPING, DELIVERED, CANCELLED)
router.patch('/admin/:id/status', authorizeRoles(Role.ADMIN, Role.STAFF), validateUuidParam('id'), updateOrderStatus);

// --- 3. CHI TIẾT & HUỶ ĐƠN (ĐẶT SAU CÁC ROUTE CỤ THỂ) ---
// [GET] /orders/:id - Xem chi tiết đơn hàng (hỗ trợ cả UUID và OrderCode)
router.get('/:id', getOrderById);

// [PATCH] /orders/:id/cancel - Khách hàng huỷ đơn hàng
router.patch('/:id/cancel', validateUuidParam('id'), cancelOrder);

export default router;
