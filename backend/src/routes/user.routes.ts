import { Router } from 'express';
import {
  getProfile,
  updateProfile,
  changePassword,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  getAllUsers,
  getUserById,
  createUser,
  updateUserByAdmin,
  deleteUserByAdmin,
} from '../controllers/user.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { authorizeRoles } from '../middlewares/role.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Tất cả các route bên dưới đều yêu cầu đăng nhập (JWT Access Token)
router.use(authenticateToken);

// USER ROUTES (Người dùng thao tác trên tài khoản cá nhân)

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

// ADMIN ROUTES (Chỉ quyền ADMIN mới có quyền truy cập & chỉnh sửa)

// [GET] /users - Lấy danh sách toàn bộ người dùng (phân trang, tìm kiếm, lọc)
router.get('/', authorizeRoles(Role.ADMIN), getAllUsers);

// [POST] /users - Tạo người dùng mới bởi Admin (STAFF, TECHNICIAN, CUSTOMER, ADMIN)
router.post('/', authorizeRoles(Role.ADMIN), createUser);

// [GET] /users/:id - Lấy thông tin chi tiết người dùng theo ID
router.get('/:id', authorizeRoles(Role.ADMIN), getUserById);

// [PUT] /users/:id - Chỉnh sửa thông tin, vai trò, trạng thái người dùng (Chỉ ADMIN)
router.put('/:id', authorizeRoles(Role.ADMIN), updateUserByAdmin);

// [DELETE] /users/:id - Xóa người dùng (Chỉ ADMIN)
router.delete('/:id', authorizeRoles(Role.ADMIN), deleteUserByAdmin);

export default router;

