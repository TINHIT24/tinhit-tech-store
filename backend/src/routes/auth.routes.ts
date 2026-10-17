import { Router } from 'express';
import {
  register,
  verifyRegistration,
  resendOtp,
  login,
  refreshToken,
  logout,
} from '../controllers/auth.controller';

const router = Router();

// [POST] /auth/register - Đăng ký tài khoản (Tạo tài khoản UNVERIFIED và gửi OTP xác nhận qua Email)
router.post('/register', register);

// [POST] /auth/verify - Nhập OTP xác thực để kích hoạt tài khoản
router.post('/verify', verifyRegistration);

// [POST] /auth/resend-otp - Gửi lại mã xác nhận OTP qua email
router.post('/resend-otp', resendOtp);

// [POST] /auth/login - Đăng nhập bằng Email và Password
router.post('/login', login);

// [POST] /auth/refresh-token - Cấp lại Access Token mới bằng Refresh Token
router.post('/refresh-token', refreshToken);

// [POST] /auth/logout - Thu hồi Refresh Token và Đăng xuất
router.post('/logout', logout);

export default router;
