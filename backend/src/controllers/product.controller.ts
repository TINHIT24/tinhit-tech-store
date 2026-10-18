import { Request, Response, NextFunction } from 'express';
import { productService } from '../services/product.service';
import { ProductStatus } from '@prisma/client';

/**
 * [GET] /products - Lấy danh sách sản phẩm với bộ lọc đa năng & phân trang (công khai)
 */
export const getProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      page,
      limit,
      search,
      categoryId,
      brandId,
      status,
      isFeatured,
      isNew,
      minPrice,
      maxPrice,
      sortBy,
    } = req.query;

    const result = await productService.getProducts({
      page: page as string,
      limit: limit as string,
      search: search as string,
      categoryId: categoryId as string,
      brandId: brandId as string,
      status: status as string,
      isFeatured: isFeatured as string,
      isNew: isNew as string,
      minPrice: minPrice as string,
      maxPrice: maxPrice as string,
      sortBy: sortBy as any,
    });

    res.status(200).json({
      success: true,
      pagination: result.pagination,
      data: result.data,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * [GET] /products/featured - Lấy danh sách sản phẩm nổi bật (công khai)
 */
export const getFeaturedProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 8;
    const products = await productService.getFeaturedProducts(limit);

    res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * [GET] /products/related/:id - Lấy danh sách sản phẩm liên quan (công khai)
 */
export const getRelatedProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const limit = req.query.limit ? Number(req.query.limit) : 4;
    const products = await productService.getRelatedProducts(id, limit);

    res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * [GET] /products/:identifier - Xem chi tiết sản phẩm theo ID hoặc Slug (công khai)
 */
export const getProductByIdentifier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const identifier = req.params.identifier as string;
    const product = await productService.getProductByIdentifier(identifier);

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * [POST] /products - Tạo mới sản phẩm kèm biến thể & hình ảnh (Chỉ ADMIN)
 */
export const createProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const product = await productService.createProduct(req.body);

    res.status(201).json({
      success: true,
      message: 'Tạo sản phẩm thành công.',
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * [PUT] /products/:id - Cập nhật thông tin chung của sản phẩm (Chỉ ADMIN)
 */
export const updateProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const product = await productService.updateProduct(id, req.body);

    res.status(200).json({
      success: true,
      message: 'Cập nhật sản phẩm thành công.',
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * [PATCH] /products/:id/status - Cập nhật nhanh trạng thái sản phẩm (Chỉ ADMIN)
 */
export const updateProductStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { status } = req.body;

    if (!status || !Object.values(ProductStatus).includes(status)) {
      res.status(400).json({
        success: false,
        message: `Trạng thái không hợp lệ. Các giá trị được chấp nhận: ${Object.values(ProductStatus).join(', ')}`,
      });
      return;
    }

    const product = await productService.updateProductStatus(id, status);

    res.status(200).json({
      success: true,
      message: `Cập nhật trạng thái sản phẩm thành "${status}" thành công.`,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * [DELETE] /products/:id - Xóa sản phẩm (Chỉ ADMIN)
 */
export const deleteProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const result = await productService.deleteProduct(id);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

// CONTROLLERS CHO BIẾN THỂ (PRODUCT VARIANTS)

/**
 * [POST] /products/:id/variants - Thêm biến thể mới cho sản phẩm (Chỉ ADMIN)
 */
export const addVariant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const productId = req.params.id as string;
    const variant = await productService.addVariant(productId, req.body);

    res.status(201).json({
      success: true,
      message: 'Thêm biến thể sản phẩm thành công.',
      data: variant,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * [PUT] /products/variants/:variantId - Cập nhật biến thể sản phẩm (Chỉ ADMIN)
 */
export const updateVariant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const variantId = req.params.variantId as string;
    const variant = await productService.updateVariant(variantId, req.body);

    res.status(200).json({
      success: true,
      message: 'Cập nhật biến thể thành công.',
      data: variant,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * [DELETE] /products/variants/:variantId - Xóa biến thể sản phẩm (Chỉ ADMIN)
 */
export const deleteVariant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const variantId = req.params.variantId as string;
    const result = await productService.deleteVariant(variantId);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

// CONTROLLERS CHO THƯ VIỆN ẢNH (PRODUCT IMAGES)

/**
 * [POST] /products/:id/images - Thêm ảnh vào thư viện của sản phẩm (Chỉ ADMIN)
 */
export const addImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const productId = req.params.id as string;
    const image = await productService.addImage(productId, req.body);

    res.status(201).json({
      success: true,
      message: 'Thêm hình ảnh vào thư viện thành công.',
      data: image,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * [DELETE] /products/images/:imageId - Xóa ảnh khỏi thư viện sản phẩm (Chỉ ADMIN)
 */
export const deleteImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const imageId = req.params.imageId as string;
    const result = await productService.deleteImage(imageId);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};
