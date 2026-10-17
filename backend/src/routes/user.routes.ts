import { Router } from 'express';
import {
  getProfile,
  updateProfile,
  changePassword,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
} from '../controllers/user.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

// Tất cả các route bên dưới đều yêu cầu đăng nhập (JWT Access Token)
router.use(authenticateToken);

// [GET] /users/me - Lấy thông tin cá nhân hiện tại
router.get('/me', getProfile);

// [PUT] /users/me - Cập nhật thông tin cá nhân (họ tên, sđt, avatar)
router.put('/me', updateProfile);

// [PUT] /users/change-password - Đổi mật khẩu
router.put('/change-password', changePassword);

// [GET] /users/addresses - Lấy danh sách sổ địa chỉ giao hàng
router.get('/addresses', getAddresses);

// [POST] /users/addresses - Thêm địa chỉ nhận hàng mới
router.post('/addresses', addAddress);

// [PUT] /users/addresses/:addressId - Cập nhật thông tin địa chỉ
router.put('/addresses/:addressId', updateAddress);

// [DELETE] /users/addresses/:addressId - Xóa địa chỉ
router.delete('/addresses/:addressId', deleteAddress);

export default router;
