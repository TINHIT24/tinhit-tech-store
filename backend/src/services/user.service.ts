import prisma from '../config/prisma';
import { hashPassword, comparePassword } from '../utils/hash.util';
import { sanitizeUser, SafeUser } from '../utils/sanitize.util';
import { AddressType } from '@prisma/client';

export interface UpdateProfileDTO {
  fullName?: string;
  phoneNumber?: string;
  avatarUrl?: string;
}

export interface ChangePasswordDTO {
  oldPassword: string;
  newPassword: string;
}

export interface AddressDTO {
  recipientName: string;
  recipientPhone: string;
  provinceCity: string;
  district: string;
  ward: string;
  streetAddress: string;
  addressType?: AddressType;
  isDefault?: boolean;
  notes?: string;
}

export class UserService {
  /**
   * Lấy thông tin tài khoản cá nhân kèm danh sách địa chỉ
   */
  async getProfile(userId: string): Promise<SafeUser & { addresses: any[]; socialAccounts: any[] }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        addresses: {
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        },
        socialAccounts: {
          select: {
            id: true,
            provider: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      throw { statusCode: 404, message: 'Người dùng không tồn tại.' };
    }

    return sanitizeUser(user) as any;
  }

  /**
   * Cập nhật thông tin hồ sơ
   */
  async updateProfile(userId: string, data: UpdateProfileDTO): Promise<SafeUser> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw { statusCode: 404, message: 'Người dùng không tồn tại.' };
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.fullName && { fullName: data.fullName.trim() }),
        ...(data.phoneNumber !== undefined && { phoneNumber: data.phoneNumber?.trim() || null }),
        ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl?.trim() || null }),
      },
    });

    return sanitizeUser(updatedUser);
  }

  /**
   * Đổi mật khẩu
   */
  async changePassword(userId: string, data: ChangePasswordDTO): Promise<void> {
    const { oldPassword, newPassword } = data;

    if (!oldPassword || !newPassword) {
      throw { statusCode: 400, message: 'Vui lòng cung cấp mật khẩu cũ và mật khẩu mới.' };
    }

    if (newPassword.length < 6) {
      throw { statusCode: 400, message: 'Mật khẩu mới phải có tối thiểu 6 ký tự.' };
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) {
      throw { statusCode: 404, message: 'Người dùng không hợp lệ.' };
    }

    const isMatch = await comparePassword(oldPassword, user.passwordHash);
    if (!isMatch) {
      throw { statusCode: 400, message: 'Mật khẩu hiện tại không chính xác.' };
    }

    const newPasswordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    // Thu hồi toàn bộ refresh token để bắt buộc đăng nhập lại vì lý do an toàn
    await prisma.refreshToken.updateMany({
      where: { userId },
      data: { isRevoked: true },
    });
  }

  /**
   * Lấy danh sách sổ địa chỉ
   */
  async getAddresses(userId: string) {
    return prisma.userAddress.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Thêm mới một địa chỉ giao hàng
   */
  async addAddress(userId: string, data: AddressDTO) {
    const count = await prisma.userAddress.count({ where: { userId } });
    // Nếu là địa chỉ đầu tiên thì mặc định isDefault = true
    const shouldBeDefault = count === 0 ? true : Boolean(data.isDefault);

    if (shouldBeDefault) {
      // Hủy mặc định của các địa chỉ trước
      await prisma.userAddress.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return prisma.userAddress.create({
      data: {
        userId,
        recipientName: data.recipientName.trim(),
        recipientPhone: data.recipientPhone.trim(),
        provinceCity: data.provinceCity.trim(),
        district: data.district.trim(),
        ward: data.ward.trim(),
        streetAddress: data.streetAddress.trim(),
        addressType: data.addressType || AddressType.HOME,
        isDefault: shouldBeDefault,
        notes: data.notes?.trim() || null,
      },
    });
  }

  /**
   * Cập nhật địa chỉ
   */
  async updateAddress(userId: string, addressId: string, data: Partial<AddressDTO>) {
    const existing = await prisma.userAddress.findFirst({
      where: { id: addressId, userId },
    });

    if (!existing) {
      throw { statusCode: 404, message: 'Không tìm thấy địa chỉ giao hàng.' };
    }

    if (data.isDefault) {
      await prisma.userAddress.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return prisma.userAddress.update({
      where: { id: addressId },
      data: {
        ...(data.recipientName && { recipientName: data.recipientName.trim() }),
        ...(data.recipientPhone && { recipientPhone: data.recipientPhone.trim() }),
        ...(data.provinceCity && { provinceCity: data.provinceCity.trim() }),
        ...(data.district && { district: data.district.trim() }),
        ...(data.ward && { ward: data.ward.trim() }),
        ...(data.streetAddress && { streetAddress: data.streetAddress.trim() }),
        ...(data.addressType && { addressType: data.addressType }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
        ...(data.notes !== undefined && { notes: data.notes?.trim() || null }),
      },
    });
  }

  /**
   * Xóa một địa chỉ
   */
  async deleteAddress(userId: string, addressId: string) {
    const existing = await prisma.userAddress.findFirst({
      where: { id: addressId, userId },
    });

    if (!existing) {
      throw { statusCode: 404, message: 'Không tìm thấy địa chỉ giao hàng.' };
    }

    await prisma.userAddress.delete({
      where: { id: addressId },
    });

    // Nếu vừa xóa địa chỉ mặc định, tự động gán địa chỉ còn lại gần nhất làm mặc định
    if (existing.isDefault) {
      const remainingAddress = await prisma.userAddress.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      if (remainingAddress) {
        await prisma.userAddress.update({
          where: { id: remainingAddress.id },
          data: { isDefault: true },
        });
      }
    }

    return { message: 'Đã xóa địa chỉ thành công.' };
  }
}

export const userService = new UserService();
