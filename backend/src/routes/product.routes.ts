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
import { validateUuidParam } from '../middlewares/validate.middleware';
import { Role } from '@prisma/client';

const router = Router();

// PUBLIC ROUTES (Khách hàng xem sản phẩm)

// [GET] /products - Lấy danh sách sản phẩm (hỗ trợ lọc category, brand, giá, search, phân trang)
router.get('/', getProducts);

// [GET] /products/featured - Lấy danh sách sản phẩm nổi bật
router.get('/featured', getFeaturedProducts);

// [GET] /products/related/:id - Lấy danh sách sản phẩm liên quan (yêu cầu :id là UUID)
router.get('/related/:id', validateUuidParam('id'), getRelatedProducts);

// [GET] /products/:identifier - Xem chi tiết sản phẩm theo ID hoặc Slug (VD: /products/laptop-asus-rog-strix-g16)
router.get('/:identifier', getProductByIdentifier);

// ADMIN ROUTES (Chỉ quyền ADMIN)

// [POST] /products - Tạo mới sản phẩm kèm biến thể & hình ảnh
router.post('/', authenticateToken, authorizeRoles(Role.ADMIN), createProduct);

// [PUT] /products/:id - Cập nhật thông tin chung của sản phẩm
router.put('/:id', authenticateToken, authorizeRoles(Role.ADMIN), validateUuidParam('id'), updateProduct);

// [PATCH] /products/:id/status - Cập nhật nhanh trạng thái (DRAFT, PUBLISHED, OUT_OF_STOCK, ARCHIVED)
router.patch('/:id/status', authenticateToken, authorizeRoles(Role.ADMIN), validateUuidParam('id'), updateProductStatus);

// [DELETE] /products/:id - Xóa sản phẩm
router.delete('/:id', authenticateToken, authorizeRoles(Role.ADMIN), validateUuidParam('id'), deleteProduct);

// --- Biến thể sản phẩm (Variants) ---

// [POST] /products/:id/variants - Thêm biến thể cho sản phẩm
router.post('/:id/variants', authenticateToken, authorizeRoles(Role.ADMIN), validateUuidParam('id'), addVariant);

// [PUT] /products/variants/:variantId - Cập nhật biến thể
router.put('/variants/:variantId', authenticateToken, authorizeRoles(Role.ADMIN), validateUuidParam('variantId'), updateVariant);

// [DELETE] /products/variants/:variantId - Xóa biến thể
router.delete('/variants/:variantId', authenticateToken, authorizeRoles(Role.ADMIN), validateUuidParam('variantId'), deleteVariant);

// --- Thư viện ảnh (Images) ---

// [POST] /products/:id/images - Thêm ảnh vào thư viện sản phẩm
router.post('/:id/images', authenticateToken, authorizeRoles(Role.ADMIN), validateUuidParam('id'), addImage);

// [DELETE] /products/images/:imageId - Xóa ảnh khỏi thư viện
router.delete('/images/:imageId', authenticateToken, authorizeRoles(Role.ADMIN), validateUuidParam('imageId'), deleteImage);

export default router;
