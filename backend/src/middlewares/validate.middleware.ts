import { Request, Response, NextFunction } from 'express';

/**
 * Biểu thức chính quy kiểm tra chuỗi UUID chuẩn RFC 4122 (8-4-4-4-12 hex)
 */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Hàm kiểm tra giá trị có phải là một UUID hợp lệ hay không
 */
export const isValidUuid = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;
  return UUID_REGEX.test(value.trim());
};

/**
 * Middleware kiểm tra các param trong req.params có phải là UUID hợp lệ hay không.
 * Trả về HTTP 400 Bad Request ngay lập tức nếu ID không tồn tại hoặc sai định dạng.
 * 
 * Ví dụ sử dụng:
 *   router.put('/:id', validateUuidParam('id'), updateProduct);
 *   router.delete('/variants/:variantId', validateUuidParam('variantId'), deleteVariant);
 */
export const validateUuidParam = (...paramNames: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    for (const paramName of paramNames) {
      const rawValue = req.params[paramName];
      const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;

      if (!value || typeof value !== 'string' || !value.trim()) {
        res.status(400).json({
          success: false,
          message: `Tham số "${paramName}" là bắt buộc trên đường dẫn URL.`,
        });
        return;
      }

      if (!isValidUuid(value)) {
        res.status(400).json({
          success: false,
          message: `Tham số "${paramName}" mang giá trị "${value}" không đúng định dạng UUID hợp lệ.`,
        });
        return;
      }
    }

    next();
  };
};
