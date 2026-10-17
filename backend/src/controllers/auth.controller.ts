import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password, fullName, phoneNumber } = req.body;
    const result = await authService.register({
      email,
      password,
      fullName,
      phoneNumber,
    });

    res.status(201).json({
      success: true,
      message: result.message,
      data: {
        email: result.email,
        expiresInMinutes: result.expiresInMinutes,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const verifyRegistration = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, otp } = req.body;
    const result = await authService.verifyRegistration({ email, otp });

    res.status(200).json({
      success: true,
      message: 'Xác thực tài khoản thành công! Bạn có thể sử dụng đầy đủ dịch vụ.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const resendOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp email.',
      });
      return;
    }

    const result = await authService.resendRegistrationOtp(email);
    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        email: result.email,
        expiresInMinutes: result.expiresInMinutes,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;
    const deviceInfo = req.headers['user-agent'] || undefined;
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || undefined;

    const result = await authService.login({
      email,
      password,
      deviceInfo,
      ipAddress,
    });

    res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    const deviceInfo = req.headers['user-agent'] || undefined;
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || undefined;

    const tokens = await authService.refreshTokens(refreshToken, deviceInfo, ipAddress);

    res.status(200).json({
      success: true,
      message: 'Làm mới token thành công.',
      data: tokens,
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    await authService.logout(refreshToken);

    res.status(200).json({
      success: true,
      message: 'Đăng xuất thành công.',
    });
  } catch (error) {
    next(error);
  }
};
