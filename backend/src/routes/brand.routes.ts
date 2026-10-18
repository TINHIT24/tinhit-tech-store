import { Router } from 'express';
import {
  getBrands,
  getBrandByIdentifier,
  createBrand,
  updateBrand,
  toggleBrandStatus,
  deleteBrand,
} from '../controllers/brand.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { authorizeRoles } from '../middlewares/role.middleware';
import { Role } from '@prisma/client';

const router = Router();

// PUBLIC ROUTES (Khách hàng xem thương hiệu)

// [GET] /brands - Lấy danh sách thương hiệu (hỗ trợ ?search=..., ?isActive=true)
router.get('/', getBrands);

// [GET] /brands/:identifier - Xem chi tiết theo ID hoặc Slug (VD: /brands/asus)
router.get('/:identifier', getBrandByIdentifier);

// ADMIN ROUTES (Chỉ quyền ADMIN)

// [POST] /brands - Tạo mới thương hiệu
router.post('/', authenticateToken, authorizeRoles(Role.ADMIN), createBrand);

// [PUT] /brands/:id - Cập nhật thông tin thương hiệu
router.put('/:id', authenticateToken, authorizeRoles(Role.ADMIN), updateBrand);

// [PATCH] /brands/:id/status - Bật/tắt trạng thái hiển thị
router.patch('/:id/status', authenticateToken, authorizeRoles(Role.ADMIN), toggleBrandStatus);

// [DELETE] /brands/:id - Xóa thương hiệu
router.delete('/:id', authenticateToken, authorizeRoles(Role.ADMIN), deleteBrand);

export default router;
