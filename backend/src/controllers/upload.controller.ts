import { Request, Response, NextFunction } from 'express';
import { uploadService } from '../services/upload.service';
import { Role } from '@prisma/client';

// Danh sách các thư mục upload được phép sử dụng (Whitelist)
export const ALLOWED_UPLOAD_FOLDERS = [
  'users',
  'products',
  'categories',
  'brands',
  'banners',
  'reviews',
] as const;

export type UploadFolder = (typeof ALLOWED_UPLOAD_FOLDERS)[number];

// Các thư mục quản trị chỉ dành cho ADMIN hoặc STAFF
export const PRIVILEGED_FOLDERS: UploadFolder[] = [
  'products',
  'categories',
  'brands',
  'banners',
];

/**
 * Kiểm tra tính hợp lệ và phân quyền truy cập thư mục upload
 */
const validateAndAuthorizeFolder = (
  folderInput: string | undefined,
  userRole: Role | undefined
): { folder?: UploadFolder; error?: { status: number; message: string } } => {
  // Mặc định nếu không truyền thì lưu vào 'users' (nếu là user thường) hoặc 'products' (nếu là admin)
  const defaultFolder: UploadFolder =
    userRole === Role.ADMIN || userRole === Role.STAFF ? 'products' : 'users';

  const rawFolder = folderInput ? folderInput.toLowerCase().trim() : defaultFolder;

  // 1. Kiểm tra Whitelist
  if (!ALLOWED_UPLOAD_FOLDERS.includes(rawFolder as UploadFolder)) {
    return {
      error: {
        status: 400,
        message: `Thư mục "${rawFolder}" không hợp lệ. Các thư mục được phép: ${ALLOWED_UPLOAD_FOLDERS.join(
          ', '
        )}`,
      },
    };
  }

  const folder = rawFolder as UploadFolder;

  // 2. Phân quyền: Chặn CUSTOMER upload vào thư mục quản trị
  if (PRIVILEGED_FOLDERS.includes(folder)) {
    const isPrivileged = userRole === Role.ADMIN || userRole === Role.STAFF;
    if (!isPrivileged) {
      return {
        error: {
          status: 403,
          message: `Bạn không có quyền upload hình ảnh vào thư mục "${folder}". Chỉ Quản trị viên (ADMIN/STAFF) mới có quyền này.`,
        },
      };
    }
  }

  return { folder };
};

/**
 * [POST] /upload/single - Upload 1 file ảnh lên Cloudinary
 * Hỗ trợ query ?folder=users | products | categories | brands | banners | reviews
 */
export const uploadSingleImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({
        success: false,
        message: 'Không tìm thấy file ảnh. Vui lòng gửi file với key là "image".',
      });
      return;
    }

    // Kiểm tra tính hợp lệ và phân quyền thư mục
    const folderInput = (req.query.folder as string) || (req.body.folder as string);
    const validation = validateAndAuthorizeFolder(folderInput, req.user?.role as Role);

    if (validation.error) {
      res.status(validation.error.status).json({
        success: false,
        message: validation.error.message,
      });
      return;
    }

    const result = await uploadService.uploadSingle(file, validation.folder!);

    res.status(201).json({
      success: true,
      message: 'Tải ảnh lên Cloudinary thành công.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * [POST] /upload/multiple - Upload nhiều file ảnh cùng lúc lên Cloudinary
 * Hỗ trợ query ?folder=products | reviews...
 */
export const uploadMultipleImages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Không tìm thấy danh sách file ảnh. Vui lòng gửi file với key là "images".',
      });
      return;
    }

    // Kiểm tra tính hợp lệ và phân quyền thư mục
    const folderInput = (req.query.folder as string) || (req.body.folder as string);
    const validation = validateAndAuthorizeFolder(folderInput, req.user?.role as Role);

    if (validation.error) {
      res.status(validation.error.status).json({
        success: false,
        message: validation.error.message,
      });
      return;
    }

    const results = await uploadService.uploadMultiple(files, validation.folder!);

    res.status(201).json({
      success: true,
      message: `Tải thành công ${results.length} hình ảnh lên Cloudinary.`,
      data: results,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * [DELETE] /upload - Xóa ảnh trên Cloudinary bằng publicId
 */
export const deleteImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const publicId = (req.body.publicId as string) || (req.query.publicId as string);

    if (!publicId || !publicId.trim()) {
      res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp publicId của ảnh cần xóa.',
      });
      return;
    }

    const cleanPublicId = publicId.trim();

    // Khách hàng thông thường chỉ có thể xóa ảnh cá nhân trong thư mục users/
    if (req.user?.role === Role.CUSTOMER && !cleanPublicId.includes('/users/')) {
      res.status(403).json({
        success: false,
        message: 'Bạn chỉ có quyền xóa hình ảnh trong thư mục cá nhân của mình.',
      });
      return;
    }

    const result = await uploadService.deleteImage(cleanPublicId);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};
