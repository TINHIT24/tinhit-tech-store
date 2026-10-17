import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/user.service';

export const getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const profile = await userService.getProfile(userId);

    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { fullName, phoneNumber, avatarUrl } = req.body;

    const updatedUser = await userService.updateProfile(userId, {
      fullName,
      phoneNumber,
      avatarUrl,
    });

    res.status(200).json({
      success: true,
      message: 'Cập nhật thông tin hồ sơ thành công.',
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { oldPassword, newPassword } = req.body;

    await userService.changePassword(userId, { oldPassword, newPassword });

    res.status(200).json({
      success: true,
      message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại trên các thiết bị khác.',
    });
  } catch (error) {
    next(error);
  }
};

export const getAddresses = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const addresses = await userService.getAddresses(userId);

    res.status(200).json({
      success: true,
      data: addresses,
    });
  } catch (error) {
    next(error);
  }
};

export const addAddress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const {
      recipientName,
      recipientPhone,
      provinceCity,
      district,
      ward,
      streetAddress,
      addressType,
      isDefault,
      notes,
    } = req.body;

    if (!recipientName || !recipientPhone || !provinceCity || !district || !ward || !streetAddress) {
      res.status(400).json({
        success: false,
        message: 'Vui lòng điền đầy đủ các thông tin địa chỉ bắt buộc.',
      });
      return;
    }

    const address = await userService.addAddress(userId, {
      recipientName,
      recipientPhone,
      provinceCity,
      district,
      ward,
      streetAddress,
      addressType,
      isDefault,
      notes,
    });

    res.status(201).json({
      success: true,
      message: 'Thêm địa chỉ giao hàng thành công.',
      data: address,
    });
  } catch (error) {
    next(error);
  }
};

export const updateAddress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const addressId = req.params.addressId as string;

    const address = await userService.updateAddress(userId, addressId, req.body);

    res.status(200).json({
      success: true,
      message: 'Cập nhật địa chỉ giao hàng thành công.',
      data: address,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAddress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const addressId = req.params.addressId as string;

    const result = await userService.deleteAddress(userId, addressId);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

// ADMIN USER MANAGEMENT HANDLERS

export const getAllUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page, limit, search, role, status, sortBy, sortOrder } = req.query;

    const result = await userService.getAllUsers({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
      search: search as string,
      role: role as any,
      status: status as any,
      sortBy: sortBy as string,
      sortOrder: sortOrder as any,
    });

    res.status(200).json({
      success: true,
      data: result.users,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const targetUserId = req.params.id as string;
    const user = await userService.getUserById(targetUserId);

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const newUser = await userService.createUserByAdmin(req.body);

    res.status(201).json({
      success: true,
      message: 'Tạo tài khoản người dùng thành công.',
      data: newUser,
    });
  } catch (error) {
    next(error);
  }
};

export const updateUserByAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const adminId = req.user!.userId;
    const targetUserId = req.params.id as string;

    const updatedUser = await userService.updateUserByAdmin(adminId, targetUserId, req.body);

    res.status(200).json({
      success: true,
      message: 'Cập nhật thông tin người dùng thành công.',
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteUserByAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const adminId = req.user!.userId;
    const targetUserId = req.params.id as string;

    const result = await userService.deleteUserByAdmin(adminId, targetUserId);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

