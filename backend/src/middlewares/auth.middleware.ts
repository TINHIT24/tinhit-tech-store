import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JwtPayload } from '../utils/jwt.util';
import prisma from '../config/prisma';
import { UserStatus } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Không tìm thấy Access Token xác thực. Vui lòng đăng nhập.',
      });
      return;
    }

    const token = authHeader.split(' ')[1];
    let decoded: JwtPayload;

    try {
      decoded = verifyAccessToken(token);
    } catch (err: any) {
      res.status(401).json({
        success: false,
        message: 'Token xác thực không hợp lệ hoặc đã hết hạn.',
      });
      return;
    }

    // Kiểm tra trạng thái hiện tại của tài khoản trong cơ sở dữ liệu
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true, status: true },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Tài khoản không tồn tại hoặc đã bị xóa.',
      });
      return;
    }

    if (user.status !== UserStatus.ACTIVE) {
      res.status(403).json({
        success: false,
        message: 'Tài khoản chưa được kích hoạt hoặc đã bị khóa.',
      });
      return;
    }

    req.user = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    next(error);
  }
};
