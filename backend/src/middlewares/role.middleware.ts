import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';

export const authorizeRoles = (...allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Bạn chưa được xác thực.',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role as Role)) {
      res.status(403).json({
        success: false,
        message: 'Bạn không có quyền truy cập chức năng này.',
      });
      return;
    }

    next();
  };
};
