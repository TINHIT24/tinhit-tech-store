import prisma from '../config/prisma';
import { hashPassword, comparePassword, hashToken } from '../utils/hash.util';
import { generateOtp } from '../utils/otp.util';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.util';
import { sanitizeUser, SafeUser } from '../utils/sanitize.util';
import { isValidEmail, isValidPhoneNumber } from '../utils/validator.util';
import { emailService } from './email.service';
import { TokenType, UserStatus } from '@prisma/client';

export interface RegisterDTO {
  email: string;
  password: string;
  fullName: string;
  phoneNumber?: string;
}

export interface VerifyRegistrationDTO {
  email: string;
  otp: string;
}

export interface LoginDTO {
  email: string;
  password: string;
  deviceInfo?: string;
  ipAddress?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: SafeUser;
  tokens: AuthTokens;
}

export class AuthService {
  /**
   * Bước 1 đăng ký: Tạo/Cập nhật tài khoản ở trạng thái UNVERIFIED và gửi OTP qua Email
   */
  async register(data: RegisterDTO) {
    const email = data.email?.trim().toLowerCase();
    const { password, fullName, phoneNumber } = data;

    // Kiểm tra định dạng cơ bản
    if (!email || !password || !fullName) {
      throw { statusCode: 400, message: 'Vui lòng cung cấp đầy đủ email, mật khẩu và họ tên.' };
    }

    // Kiểm tra định dạng Email hợp lệ
    if (!isValidEmail(email)) {
      throw {
        statusCode: 400,
        message: 'Định dạng email không hợp lệ (Ví dụ hợp lệ: name@example.com).',
      };
    }

    // Kiểm tra số điện thoại nếu người dùng có nhập
    if (phoneNumber && !isValidPhoneNumber(phoneNumber)) {
      throw {
        statusCode: 400,
        message: 'Số điện thoại không hợp lệ (Ví dụ: 0987654321 hoặc +84987654321).',
      };
    }

    if (password.length < 6) {
      throw { statusCode: 400, message: 'Mật khẩu phải có tối thiểu 6 ký tự.' };
    }

    // Kiểm tra xem email đã tồn tại chưa
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      if (existingUser.status === UserStatus.ACTIVE) {
        throw { statusCode: 400, message: 'Email này đã được đăng ký và kích hoạt. Vui lòng đăng nhập.' };
      }
      if (existingUser.status === UserStatus.BANNED) {
        throw { statusCode: 403, message: 'Tài khoản liên kết với email này đã bị khóa.' };
      }
    }

    const passwordHash = await hashPassword(password);

    // Lưu thông tin người dùng với trạng thái UNVERIFIED
    let user;
    if (existingUser) {
      user = await prisma.user.update({
        where: { email },
        data: {
          passwordHash,
          fullName: fullName.trim(),
          phoneNumber: phoneNumber?.trim() || null,
          status: UserStatus.UNVERIFIED,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          fullName: fullName.trim(),
          phoneNumber: phoneNumber?.trim() || null,
          status: UserStatus.UNVERIFIED,
        },
      });
    }

    // Tạo mã OTP 6 số
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 phút

    // Xóa các mã xác nhận cũ của email này trước khi tạo mã mới
    await prisma.verificationToken.deleteMany({
      where: {
        email,
        type: TokenType.EMAIL_VERIFICATION,
      },
    });

    // Lưu mã xác nhận mới vào Database
    await prisma.verificationToken.create({
      data: {
        email,
        token: otp,
        type: TokenType.EMAIL_VERIFICATION,
        expiresAt,
      },
    });

    // Gửi email chứa OTP cho người dùng
    await emailService.sendRegistrationOtp(email, otp, user.fullName);

    return {
      email,
      message: 'Mã xác nhận 6 số đã được gửi tới email của bạn. Vui lòng kiểm tra hộp thư để hoàn tất kích hoạt.',
      expiresInMinutes: 10,
    };
  }

  /**
   * Bước 2 đăng ký: Nhập mã OTP từ Email để kích hoạt tài khoản
   */
  async verifyRegistration(data: VerifyRegistrationDTO): Promise<AuthResult> {
    const email = data.email.trim().toLowerCase();
    const otp = data.otp.trim();

    if (!email || !otp) {
      throw { statusCode: 400, message: 'Vui lòng cung cấp email và mã xác nhận OTP.' };
    }

    if (!isValidEmail(email)) {
      throw { statusCode: 400, message: 'Định dạng email không hợp lệ.' };
    }

    // Tìm mã xác thực hợp lệ
    const verificationRecord = await prisma.verificationToken.findFirst({
      where: {
        email,
        token: otp,
        type: TokenType.EMAIL_VERIFICATION,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!verificationRecord) {
      throw { statusCode: 400, message: 'Mã xác nhận không chính xác hoặc đã hết hạn.' };
    }

    // Tìm user tương ứng
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw { statusCode: 404, message: 'Không tìm thấy tài khoản tương ứng với email này.' };
    }

    // Cập nhật trạng thái người dùng thành ACTIVE
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        lastLoginAt: new Date(),
      },
    });

    // Xóa mã OTP đã sử dụng
    await prisma.verificationToken.delete({
      where: { id: verificationRecord.id },
    });

    // Tự động cấp Token đăng nhập ngay khi xác thực thành công
    const payload = {
      userId: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Lưu refresh token vào DB
    const refreshTokenHash = hashToken(refreshToken);
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
      data: {
        userId: updatedUser.id,
        tokenHash: refreshTokenHash,
        expiresAt: refreshExpiresAt,
      },
    });

    return {
      user: sanitizeUser(updatedUser),
      tokens: {
        accessToken,
        refreshToken,
      },
    };
  }

  /**
   * Gửi lại mã OTP xác nhận
   */
  async resendRegistrationOtp(email: string) {
    const cleanEmail = email?.trim().toLowerCase();

    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      throw { statusCode: 400, message: 'Định dạng email không hợp lệ.' };
    }

    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });

    if (!user) {
      throw { statusCode: 404, message: 'Tài khoản không tồn tại trong hệ thống.' };
    }

    if (user.status === UserStatus.ACTIVE) {
      throw { statusCode: 400, message: 'Tài khoản này đã được kích hoạt trước đó. Vui lòng đăng nhập.' };
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.verificationToken.deleteMany({
      where: {
        email: cleanEmail,
        type: TokenType.EMAIL_VERIFICATION,
      },
    });

    await prisma.verificationToken.create({
      data: {
        email: cleanEmail,
        token: otp,
        type: TokenType.EMAIL_VERIFICATION,
        expiresAt,
      },
    });

    await emailService.sendRegistrationOtp(cleanEmail, otp, user.fullName);

    return {
      email: cleanEmail,
      message: 'Mã xác nhận mới đã được gửi lại vào email của bạn.',
      expiresInMinutes: 10,
    };
  }

  /**
   * Đăng nhập bằng Email và Password
   */
  async login(data: LoginDTO): Promise<AuthResult> {
    const email = data.email.trim().toLowerCase();
    const { password, deviceInfo, ipAddress } = data;

    if (!email || !password) {
      throw { statusCode: 400, message: 'Vui lòng nhập đầy đủ email và mật khẩu.' };
    }

    if (!isValidEmail(email)) {
      throw { statusCode: 400, message: 'Định dạng email không hợp lệ.' };
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        addresses: {
          where: { isDefault: true },
        },
      },
    });

    if (!user || !user.passwordHash) {
      throw { statusCode: 401, message: 'Email hoặc mật khẩu không chính xác.' };
    }

    // Kiểm tra trạng thái tài khoản
    if (user.status === UserStatus.UNVERIFIED) {
      throw {
        statusCode: 403,
        errorCode: 'UNVERIFIED_ACCOUNT',
        message: 'Tài khoản của bạn chưa được kích hoạt qua mã xác nhận email. Vui lòng nhập OTP để kích hoạt.',
        email: user.email,
      };
    }

    if (user.status === UserStatus.BANNED) {
      throw { statusCode: 403, message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ ban quản trị.' };
    }

    if (user.status === UserStatus.INACTIVE) {
      throw { statusCode: 403, message: 'Tài khoản của bạn đang tạm thời vô hiệu hóa.' };
    }

    // Kiểm tra tính đúng đắn của mật khẩu
    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      throw { statusCode: 401, message: 'Email hoặc mật khẩu không chính xác.' };
    }

    // Cập nhật thời gian đăng nhập
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Tạo token xác thực
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Lưu thông tin phiên đăng nhập vào bảng refresh_tokens
    const refreshTokenHash = hashToken(refreshToken);
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 ngày

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        deviceInfo: deviceInfo || null,
        ipAddress: ipAddress || null,
        expiresAt: refreshExpiresAt,
      },
    });

    return {
      user: sanitizeUser(user),
      tokens: {
        accessToken,
        refreshToken,
      },
    };
  }

  /**
   * Cấp lại access token từ refresh token (Token Rotation)
   */
  async refreshTokens(refreshToken: string, deviceInfo?: string, ipAddress?: string): Promise<AuthTokens> {
    if (!refreshToken) {
      throw { statusCode: 400, message: 'Thiếu Refresh Token.' };
    }

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (err) {
      throw { statusCode: 401, message: 'Refresh token không hợp lệ hoặc đã hết hạn.' };
    }

    const tokenHash = hashToken(refreshToken);

    const savedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!savedToken || savedToken.isRevoked || savedToken.expiresAt < new Date()) {
      throw { statusCode: 401, message: 'Phiên đăng nhập đã hết hạn hoặc bị hủy.' };
    }

    // Thu hồi refresh token cũ (Rotation)
    await prisma.refreshToken.update({
      where: { id: savedToken.id },
      data: { isRevoked: true },
    });

    // Kiểm tra user vẫn còn hợp lệ
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw { statusCode: 403, message: 'Tài khoản không tồn tại hoặc đã bị khóa.' };
    }

    // Tạo cặp token mới
    const newPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const newAccessToken = generateAccessToken(newPayload);
    const newRefreshToken = generateRefreshToken(newPayload);

    // Lưu token mới
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(newRefreshToken),
        deviceInfo: deviceInfo || savedToken.deviceInfo,
        ipAddress: ipAddress || savedToken.ipAddress,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Đăng xuất và thu hồi refresh token
   */
  async logout(refreshToken?: string): Promise<void> {
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      await prisma.refreshToken.updateMany({
        where: { tokenHash },
        data: { isRevoked: true },
      });
    }
  }
}

export const authService = new AuthService();
