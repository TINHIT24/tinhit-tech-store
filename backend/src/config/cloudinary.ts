import { v2 as cloudinary } from 'cloudinary';
import { config } from './env';

// Khởi tạo cấu hình Cloudinary SDK
cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
  secure: true,
});

/**
 * Kiểm tra xem Cloudinary đã được cấu hình đầy đủ API Key hay chưa
 */
export const isCloudinaryConfigured = (): boolean => {
  return Boolean(
    config.cloudinary.cloudName &&
    config.cloudinary.apiKey &&
    config.cloudinary.apiSecret
  );
};

export default cloudinary;
