import { Router } from 'express';
import {
  getCart,
  addToCart,
  updateQuantity,
  toggleItemSelect,
  toggleSelectAll,
  removeCartItem,
  clearCart,
} from '../controllers/cart.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { validateUuidParam } from '../middlewares/validate.middleware';

const router = Router();

// Tất cả các route giỏ hàng đều yêu cầu đăng nhập
router.use(authenticateToken);

// [GET] /cart - Xem giỏ hàng của người dùng hiện tại
router.get('/', getCart);

// [POST] /cart/items - Thêm sản phẩm vào giỏ
router.post('/items', addToCart);

// [PATCH] /cart/select-all - Chọn tất cả hoặc bỏ chọn tất cả các món trong giỏ
router.patch('/select-all', toggleSelectAll);

// [PATCH] /cart/items/:itemId/select - Tích chọn (checkbox) hoặc bỏ chọn 1 sản phẩm
router.patch('/items/:itemId/select', validateUuidParam('itemId'), toggleItemSelect);

// [PUT] /cart/items/:itemId - Cập nhật số lượng
router.put('/items/:itemId', validateUuidParam('itemId'), updateQuantity);

// [DELETE] /cart/items/:itemId - Xóa một sản phẩm
router.delete('/items/:itemId', validateUuidParam('itemId'), removeCartItem);

// [DELETE] /cart - Làm trống giỏ hàng
router.delete('/', clearCart);

export default router;
