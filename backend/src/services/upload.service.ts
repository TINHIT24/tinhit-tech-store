import { Readable } from 'stream';
import cloudinary, { isCloudinaryConfigured } from '../config/cloudinary';
import { config } from '../config/env';

export interface UploadResult {
  url: string;
  publicId: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
  resourceType: string;
}

export class UploadService {
  /**
   * Tải 1 file ảnh lên Cloudinary
   * @param file File nhận từ Multer (file.buffer)
   * @param subFolder Thư mục con trên Cloudinary (users, products, categories, brands)
   */
  async uploadSingle(file: Express.Multer.File, subFolder: string = 'general'): Promise<UploadResult> {
    if (!file) {
      throw { statusCode: 400, message: 'Vui lòng đính kèm file ảnh cần tải lên.' };
    }

    if (!isCloudinaryConfigured()) {
      throw {
        statusCode: 500,
        message:
          'Hệ thống chưa được cấu hình API Cloudinary (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET trong .env). Vui lòng cấu hình tài khoản Cloudinary để sử dụng tính năng upload.',
      };
    }

    // Làm sạch tên thư mục (bỏ dấu gạch chéo đầu cuối)
    const cleanSubFolder = subFolder ? subFolder.trim().replace(/^\/+|\/+$/g, '') : 'general';
    const folderPath = `${config.cloudinary.folder}/${cleanSubFolder}`;

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folderPath,
          resource_type: 'image',
          // Tự động nén chất lượng và chuyển sang định dạng WebP/AVIF tối ưu
          transformation: [
            { quality: 'auto:good' },
            { fetch_format: 'auto' },
          ],
        },
        (error, result) => {
          if (error || !result) {
            return reject({
              statusCode: 500,
              message: `Lỗi upload lên Cloudinary: ${error?.message || 'Không xác định'}`,
            });
          }

          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            format: result.format,
            width: result.width,
            height: result.height,
            bytes: result.bytes,
            resourceType: result.resource_type,
          });
        }
      );

      // Stream buffer trực tiếp từ RAM lên Cloudinary
      Readable.from(file.buffer).pipe(uploadStream);
    });
  }

  /**
   * Tải đồng thời nhiều file ảnh lên Cloudinary
   */
  async uploadMultiple(files: Express.Multer.File[], subFolder: string = 'general'): Promise<UploadResult[]> {
    if (!files || files.length === 0) {
      throw { statusCode: 400, message: 'Vui lòng chọn ít nhất 1 file ảnh.' };
    }

    return Promise.all(files.map((file) => this.uploadSingle(file, subFolder)));
  }

  /**
   * Xóa ảnh khỏi Cloudinary bằng publicId
   */
  async deleteImage(publicId: string) {
    if (!isCloudinaryConfigured()) {
      throw {
        statusCode: 500,
        message: 'Hệ thống chưa được cấu hình API Cloudinary.',
      };
    }

    if (!publicId || !publicId.trim()) {
      throw { statusCode: 400, message: 'publicId là bắt buộc để xóa ảnh.' };
    }

    const result = await cloudinary.uploader.destroy(publicId.trim());

    if (result.result !== 'ok' && result.result !== 'not found') {
      throw { statusCode: 500, message: `Xóa ảnh trên Cloudinary thất bại: ${result.result}` };
    }

    return { message: 'Đã xóa ảnh thành công.', result: result.result };
  }
}

export const uploadService = new UploadService();
