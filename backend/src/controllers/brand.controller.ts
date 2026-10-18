import { Request, Response, NextFunction } from 'express';
import { brandService } from '../services/brand.service';

/**
 * [GET] /brands - Lấy danh sách thương hiệu (công khai)
 */
export const getBrands = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { search, isActive } = req.query;

    const brands = await brandService.getBrands({
      search: search as string,
      isActive: isActive as string,
    });

    res.status(200).json({
      success: true,
      data: brands,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * [GET] /brands/:identifier - Xem chi tiết thương hiệu theo ID hoặc Slug (công khai)
 */
export const getBrandByIdentifier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const identifier = req.params.identifier as string;
    const brand = await brandService.getBrandByIdentifier(identifier);

    res.status(200).json({
      success: true,
      data: brand,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * [POST] /brands - Tạo mới thương hiệu (Chỉ ADMIN)
 */
export const createBrand = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const brand = await brandService.createBrand(req.body);

    res.status(201).json({
      success: true,
      message: 'Tạo thương hiệu thành công.',
      data: brand,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * [PUT] /brands/:id - Cập nhật thương hiệu (Chỉ ADMIN)
 */
export const updateBrand = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const brand = await brandService.updateBrand(id, req.body);

    res.status(200).json({
      success: true,
      message: 'Cập nhật thương hiệu thành công.',
      data: brand,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * [PATCH] /brands/:id/status - Bật/tắt trạng thái hiển thị thương hiệu (Chỉ ADMIN)
 */
export const toggleBrandStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { isActive } = req.body;

    const brand = await brandService.toggleBrandStatus(id, isActive);

    res.status(200).json({
      success: true,
      message: `Đã ${brand.isActive ? 'kích hoạt' : 'ẩn'} thương hiệu thành công.`,
      data: brand,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * [DELETE] /brands/:id - Xóa thương hiệu (Chỉ ADMIN)
 */
export const deleteBrand = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const result = await brandService.deleteBrand(id);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};
