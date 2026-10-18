import { Router } from 'express';
import {
  getCategories,
  getCategoryByIdentifier,
  createCategory,
  updateCategory,
  toggleCategoryStatus,
  deleteCategory,
} from '../controllers/category.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { authorizeRoles } from '../middlewares/role.middleware';
import { Role } from '@prisma/client';

const router = Router();

// PUBLIC ROUTES (Dành cho khách hàng xem sản phẩm)

// [GET] /categories - Lấy danh sách danh mục (hỗ trợ ?tree=true, ?search=..., ?isActive=true)
router.get('/', getCategories);

// [GET] /categories/:identifier - Xem chi tiết danh mục theo ID hoặc Slug (VD: /categories/laptop-gaming)
router.get('/:identifier', getCategoryByIdentifier);

// ADMIN ROUTES

// [POST] /categories - Tạo mới danh mục
router.post('/', authenticateToken, authorizeRoles(Role.ADMIN), createCategory);

// [PUT] /categories/:id - Cập nhật toàn bộ thông tin danh mục
router.put('/:id', authenticateToken, authorizeRoles(Role.ADMIN), updateCategory);

// [PATCH] /categories/:id/status - Bật/tắt nhanh trạng thái hiển thị
router.patch('/:id/status', authenticateToken, authorizeRoles(Role.ADMIN), toggleCategoryStatus);

// [DELETE] /categories/:id - Xóa danh mục (?force=true nếu muốn gỡ liên kết danh mục con)
router.delete('/:id', authenticateToken, authorizeRoles(Role.ADMIN), deleteCategory);

export default router;
