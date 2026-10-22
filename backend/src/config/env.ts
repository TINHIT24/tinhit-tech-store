import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  apiPrefix: process.env.API_PREFIX || '/api',
  jwt: {
    secret: process.env.JWT_SECRET || '',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || '',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    folder: process.env.CLOUDINARY_FOLDER || 'tinhit-tech-store',
  },
  momo: {
    phone: process.env.MOMO_PHONE || '0901234567',
    accountName: process.env.MOMO_ACCOUNT_NAME || 'TINHIT TECH STORE',
    partnerCode: process.env.MOMO_PARTNER_CODE || 'MOMO',
    accessKey: process.env.MOMO_ACCESS_KEY || '',
    secretKey: process.env.MOMO_SECRET_KEY || '',
    endpoint: process.env.MOMO_ENDPOINT || 'https://test-payment.momo.vn/v2/gateway/api/create',
    redirectUrl: process.env.MOMO_REDIRECT_URL || 'http://localhost:3000/orders/payment-result',
    ipnUrl: process.env.MOMO_IPN_URL || 'http://localhost:5000/api/payments/momo/ipn',
  },
};
