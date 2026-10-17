import prisma from '../config/prisma';
import { hashPassword, comparePassword } from '../utils/hash.util';
import { sanitizeUser, SafeUser } from '../utils/sanitize.util';
import { isValidEmail, isValidPhoneNumber } from '../utils/validator.util';
import { AddressType, Role, UserStatus } from '@prisma/client';

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

export interface GetUsersQueryDTO {
  page?: number;
  limit?: number;
  search?: string;
  role?: Role;
  status?: UserStatus;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateUserAdminDTO {
  email: string;
  password: string;
  fullName: string;
  phoneNumber?: string;
  role?: Role;
  status?: UserStatus;
}

export interface UpdateUserAdminDTO {
  fullName?: string;
  phoneNumber?: string;
  avatarUrl?: string;
  role?: Role;
  status?: UserStatus;
  password?: string;
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

  // ADMIN USER MANAGEMENT METHODS

  /**
   * Lấy danh sách người dùng (hỗ trợ phân trang, tìm kiếm và lọc)
   */
  async getAllUsers(query: GetUsersQueryDTO) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.role && Object.values(Role).includes(query.role)) {
      where.role = query.role;
    }

    if (query.status && Object.values(UserStatus).includes(query.status)) {
      where.status = query.status;
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { fullName: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { phoneNumber: { contains: term, mode: 'insensitive' } },
      ];
    }

    const allowedSortFields = ['createdAt', 'fullName', 'email', 'role', 'status', 'lastLoginAt'];
    const sortBy = allowedSortFields.includes(query.sortBy || '') ? (query.sortBy as string) : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              addresses: true,
            },
          },
        },
      }),
    ]);

    const sanitizedUsers = users.map((u) => {
      const { passwordHash, ...safe } = u;
      return safe;
    });

    return {
      users: sanitizedUsers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Xem chi tiết thông tin một người dùng theo ID
   */
  async getUserById(userId: string) {
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
        _count: {
          select: {
            refreshTokens: true,
          },
        },
      },
    });

    if (!user) {
      throw { statusCode: 404, message: 'Không tìm thấy người dùng trong hệ thống.' };
    }

    const { passwordHash, ...safe } = user;
    return safe;
  }

  /**
   * Tạo tài khoản người dùng mới bởi Admin (có thể tạo STAFF, TECHNICIAN, CUSTOMER, ADMIN)
   */
  async createUserByAdmin(data: CreateUserAdminDTO) {
    const email = data.email?.trim().toLowerCase();
    const { password, fullName, phoneNumber, role, status } = data;

    if (!email || !password || !fullName) {
      throw { statusCode: 400, message: 'Vui lòng cung cấp email, mật khẩu và họ tên.' };
    }

    if (!isValidEmail(email)) {
      throw { statusCode: 400, message: 'Định dạng email không hợp lệ.' };
    }

    if (password.length < 6) {
      throw { statusCode: 400, message: 'Mật khẩu phải có tối thiểu 6 ký tự.' };
    }

    if (phoneNumber && !isValidPhoneNumber(phoneNumber)) {
      throw { statusCode: 400, message: 'Số điện thoại không hợp lệ (Ví dụ: 0912345678).' };
    }

    if (role && !Object.values(Role).includes(role)) {
      throw { statusCode: 400, message: 'Vai trò (Role) không hợp lệ.' };
    }

    if (status && !Object.values(UserStatus).includes(status)) {
      throw { statusCode: 400, message: 'Trạng thái (Status) không hợp lệ.' };
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw { statusCode: 409, message: 'Email này đã tồn tại trong hệ thống.' };
    }

    const targetStatus = status || UserStatus.ACTIVE;
    const passwordHash = await hashPassword(password);

    const newUser = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: fullName.trim(),
        phoneNumber: phoneNumber?.trim() || null,
        role: role || Role.CUSTOMER,
        status: targetStatus,
        emailVerifiedAt: targetStatus === UserStatus.ACTIVE ? new Date() : null,
      },
    });

    return sanitizeUser(newUser);
  }

  /**
   * Chỉnh sửa thông tin, vai trò, trạng thái người dùng (Chỉ ADMIN)
   */
  async updateUserByAdmin(adminId: string, targetUserId: string, data: UpdateUserAdminDTO) {
    const user = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) {
      throw { statusCode: 404, message: 'Không tìm thấy người dùng cần cập nhật.' };
    }

    // Bảo vệ an toàn: Admin không thể tự hạ quyền hoặc tự khóa/banned chính mình
    if (adminId === targetUserId) {
      if (data.role && data.role !== Role.ADMIN) {
        throw { statusCode: 400, message: 'Admin không thể tự hạ quyền của chính mình.' };
      }
      if (data.status && data.status !== UserStatus.ACTIVE) {
        throw { statusCode: 400, message: 'Admin không thể tự vô hiệu hóa hoặc khóa tài khoản của chính mình.' };
      }
    }

    if (data.role && !Object.values(Role).includes(data.role)) {
      throw { statusCode: 400, message: 'Vai trò (Role) không hợp lệ.' };
    }

    if (data.status && !Object.values(UserStatus).includes(data.status)) {
      throw { statusCode: 400, message: 'Trạng thái (Status) không hợp lệ.' };
    }

    if (data.phoneNumber && !isValidPhoneNumber(data.phoneNumber)) {
      throw { statusCode: 400, message: 'Số điện thoại không hợp lệ (Ví dụ: 0912345678).' };
    }

    let newPasswordHash: string | undefined = undefined;
    if (data.password) {
      if (data.password.length < 6) {
        throw { statusCode: 400, message: 'Mật khẩu mới phải có tối thiểu 6 ký tự.' };
      }
      newPasswordHash = await hashPassword(data.password);
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: {
        ...(data.fullName && { fullName: data.fullName.trim() }),
        ...(data.phoneNumber !== undefined && { phoneNumber: data.phoneNumber ? data.phoneNumber.trim() : null }),
        ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl ? data.avatarUrl.trim() : null }),
        ...(data.role && { role: data.role }),
        ...(data.status && {
          status: data.status,
          ...(data.status === UserStatus.ACTIVE && !user.emailVerifiedAt ? { emailVerifiedAt: new Date() } : {}),
        }),
        ...(newPasswordHash && { passwordHash: newPasswordHash }),
      },
    });

    // Nếu bị khóa/vô hiệu hóa hoặc bị đổi mật khẩu, thu hồi toàn bộ token đăng nhập hiện có
    if (data.status === UserStatus.BANNED || data.status === UserStatus.INACTIVE || newPasswordHash) {
      await prisma.refreshToken.updateMany({
        where: { userId: targetUserId },
        data: { isRevoked: true },
      });
    }

    return sanitizeUser(updatedUser);
  }

  /**
   * Xóa người dùng (Chỉ ADMIN)
   */
  async deleteUserByAdmin(adminId: string, targetUserId: string) {
    if (adminId === targetUserId) {
      throw { statusCode: 400, message: 'Admin không thể tự xóa tài khoản của chính mình.' };
    }

    const user = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) {
      throw { statusCode: 404, message: 'Không tìm thấy người dùng cần xóa.' };
    }

    await prisma.user.delete({
      where: { id: targetUserId },
    });

    return { message: 'Đã xóa người dùng thành công.' };
  }
}

export const userService = new UserService();
