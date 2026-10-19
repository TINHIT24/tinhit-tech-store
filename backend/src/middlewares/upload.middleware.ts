import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';

// Danh sách các định dạng MIME image được phép tải lên
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
];

// Giới hạn dung lượng tối đa: 5MB mỗi file
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Sử dụng bộ nhớ RAM (Memory Storage) để stream trực tiếp lên Cloudinary mà không ghi file rác vào ổ đĩa
const storage = multer.memoryStorage();

// Bộ lọc định dạng file
const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype.toLowerCase())) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Định dạng file "${file.mimetype}" không được hỗ trợ. Chỉ chấp nhận các file ảnh: JPG, PNG, WEBP, GIF, SVG.`
      )
    );
  }
};

export const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter,
});
