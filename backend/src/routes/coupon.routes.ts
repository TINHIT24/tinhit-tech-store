import { Router } from 'express';
import {
  getActiveCoupons,
  validateCoupon,
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} from '../controllers/coupon.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { authorizeRoles } from '../middlewares/role.middleware';
import { validateUuidParam } from '../middlewares/validate.middleware';
import { Role } from '@prisma/client';

const router = Router();

// PUBLIC ROUTES
// [GET] /coupons/active - Lấy danh sách các mã giảm giá đang mở
router.get('/active', getActiveCoupons);

// [POST] /coupons/validate - Kiểm tra mã giảm giá (áp dụng thử khi checkout)
router.post('/validate', authenticateToken, validateCoupon);

// ADMIN ROUTES (Chỉ quyền ADMIN hoặc STAFF)
// [GET] /coupons - Quản lý danh sách mã giảm giá
router.get('/', authenticateToken, authorizeRoles(Role.ADMIN, Role.STAFF), getCoupons);

// [POST] /coupons - Tạo mã giảm giá mới
router.post('/', authenticateToken, authorizeRoles(Role.ADMIN), createCoupon);

// [PUT] /coupons/:id - Chỉnh sửa mã giảm giá
router.put('/:id', authenticateToken, authorizeRoles(Role.ADMIN), validateUuidParam('id'), updateCoupon);

// [DELETE] /coupons/:id - Xoá mã giảm giá
router.delete('/:id', authenticateToken, authorizeRoles(Role.ADMIN), validateUuidParam('id'), deleteCoupon);

export default router;
