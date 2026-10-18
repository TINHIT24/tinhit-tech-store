import { Request, Response, NextFunction } from 'express';
import { categoryService } from '../services/category.service';

/**
 * [GET] /categories - Lấy danh sách danh mục (công khai)
 */
export const getCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { tree, search, isActive, parentId } = req.query;

    const categories = await categoryService.getCategories({
      tree: tree as string,
      search: search as string,
      isActive: isActive as string,
      parentId: parentId as string,
    });

    res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * [GET] /categories/:identifier - Lấy chi tiết danh mục theo ID hoặc Slug (công khai)
 */
export const getCategoryByIdentifier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const identifier = req.params.identifier as string;
    const category = await categoryService.getCategoryByIdentifier(identifier);

    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * [POST] /categories - Tạo mới danh mục (Chỉ ADMIN)
 */
export const createCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const newCategory = await categoryService.createCategory(req.body);

    res.status(201).json({
      success: true,
      message: 'Tạo danh mục sản phẩm thành công.',
      data: newCategory,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * [PUT] /categories/:id - Cập nhật toàn bộ thông tin danh mục (Chỉ ADMIN)
 */
export const updateCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const updatedCategory = await categoryService.updateCategory(id, req.body);

    res.status(200).json({
      success: true,
      message: 'Cập nhật danh mục thành công.',
      data: updatedCategory,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * [PATCH] /categories/:id/status - Bật/tắt nhanh trạng thái hiển thị của danh mục (Chỉ ADMIN)
 */
export const toggleCategoryStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { isActive } = req.body;

    const updatedCategory = await categoryService.toggleCategoryStatus(id, isActive);

    res.status(200).json({
      success: true,
      message: `Đã ${updatedCategory.isActive ? 'kích hoạt' : 'ẩn'} danh mục thành công.`,
      data: updatedCategory,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * [DELETE] /categories/:id - Xóa danh mục (Chỉ ADMIN)
 */
export const deleteCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const force = req.query.force === 'true';

    const result = await categoryService.deleteCategory(id, force);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};
