import { Router } from 'express';
import {
  uploadSingleImage,
  uploadMultipleImages,
  deleteImage,
} from '../controllers/upload.controller';
import { upload } from '../middlewares/upload.middleware';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

// Yêu cầu đăng nhập trước khi upload tài nguyên lên Cloud
router.use(authenticateToken);

// [POST] /upload/single - Upload 1 ảnh (Key form-data: "image" hoặc ?folder=users|products|categories|brands)
router.post('/single', upload.single('image'), uploadSingleImage);

// [POST] /upload/multiple - Upload tối đa 10 ảnh cùng lúc (Key form-data: "images")
router.post('/multiple', upload.array('images', 10), uploadMultipleImages);

// [DELETE] /upload - Xóa ảnh khỏi Cloudinary (Body: { "publicId": "..." })
router.delete('/', deleteImage);

export default router;
