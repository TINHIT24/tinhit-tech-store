import { Router } from 'express';
import {
  getProducts,
  getFeaturedProducts,
  getRelatedProducts,
  getProductByIdentifier,
  createProduct,
  updateProduct,
  updateProductStatus,
  deleteProduct,
  addVariant,
  updateVariant,
  deleteVariant,
  addImage,
  deleteImage,
} from '../controllers/product.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { authorizeRoles } from '../middlewares/role.middleware';
import { Role } from '@prisma/client';

const router = Router();

// PUBLIC ROUTES (Khách hàng xem sản phẩm)

// [GET] /products - Lấy danh sách sản phẩm (hỗ trợ lọc category, brand, giá, search, phân trang)
router.get('/', getProducts);

// [GET] /products/featured - Lấy danh sách sản phẩm nổi bật
router.get('/featured', getFeaturedProducts);

// [GET] /products/related/:id - Lấy danh sách sản phẩm liên quan
router.get('/related/:id', getRelatedProducts);

// [GET] /products/:identifier - Xem chi tiết sản phẩm theo ID hoặc Slug (VD: /products/laptop-asus-rog-strix-g16)
router.get('/:identifier', getProductByIdentifier);

// ADMIN ROUTES (Chỉ quyền ADMIN)

// [POST] /products - Tạo mới sản phẩm kèm biến thể & hình ảnh
router.post('/', authenticateToken, authorizeRoles(Role.ADMIN), createProduct);

// [PUT] /products/:id - Cập nhật thông tin chung của sản phẩm
router.put('/:id', authenticateToken, authorizeRoles(Role.ADMIN), updateProduct);

// [PATCH] /products/:id/status - Cập nhật nhanh trạng thái (DRAFT, PUBLISHED, OUT_OF_STOCK, ARCHIVED)
router.patch('/:id/status', authenticateToken, authorizeRoles(Role.ADMIN), updateProductStatus);

// [DELETE] /products/:id - Xóa sản phẩm
router.delete('/:id', authenticateToken, authorizeRoles(Role.ADMIN), deleteProduct);

// --- Biến thể sản phẩm (Variants) ---

// [POST] /products/:id/variants - Thêm biến thể cho sản phẩm
router.post('/:id/variants', authenticateToken, authorizeRoles(Role.ADMIN), addVariant);

// [PUT] /products/variants/:variantId - Cập nhật biến thể
router.put('/variants/:variantId', authenticateToken, authorizeRoles(Role.ADMIN), updateVariant);

// [DELETE] /products/variants/:variantId - Xóa biến thể
router.delete('/variants/:variantId', authenticateToken, authorizeRoles(Role.ADMIN), deleteVariant);

// --- Thư viện ảnh (Images) ---

// [POST] /products/:id/images - Thêm ảnh vào thư viện sản phẩm
router.post('/:id/images', authenticateToken, authorizeRoles(Role.ADMIN), addImage);

// [DELETE] /products/images/:imageId - Xóa ảnh khỏi thư viện
router.delete('/images/:imageId', authenticateToken, authorizeRoles(Role.ADMIN), deleteImage);

export default router;
