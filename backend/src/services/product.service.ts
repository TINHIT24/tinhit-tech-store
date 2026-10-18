import prisma from '../config/prisma';
import { generateSlug } from '../utils/slug.util';
import { ProductStatus } from '@prisma/client';

export interface CreateProductVariantDTO {
  sku: string;
  name: string;
  originalPrice: number;
  salePrice?: number;
  stockQuantity?: number;
  imageUrl?: string;
  attributes?: Record<string, any>;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface UpdateProductVariantDTO {
  sku?: string;
  name?: string;
  originalPrice?: number;
  salePrice?: number;
  stockQuantity?: number;
  imageUrl?: string;
  attributes?: Record<string, any>;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface ProductImageDTO {
  url: string;
  altText?: string;
  order?: number;
  isThumbnail?: boolean;
}

export interface CreateProductDTO {
  name: string;
  slug?: string;
  shortDescription?: string;
  description?: string;
  thumbnail?: string;
  categoryId: string;
  brandId?: string | null;
  warrantyMonths?: number;
  specifications?: Record<string, any>;
  status?: ProductStatus;
  isFeatured?: boolean;
  isNew?: boolean;
  variants?: CreateProductVariantDTO[];
  images?: ProductImageDTO[];
}

export interface UpdateProductDTO {
  name?: string;
  slug?: string;
  shortDescription?: string;
  description?: string;
  thumbnail?: string;
  categoryId?: string;
  brandId?: string | null;
  warrantyMonths?: number;
  specifications?: Record<string, any>;
  status?: ProductStatus;
  isFeatured?: boolean;
  isNew?: boolean;
}

export interface GetProductsQueryDTO {
  page?: number | string;
  limit?: number | string;
  search?: string;
  categoryId?: string;
  brandId?: string;
  status?: ProductStatus | string;
  isFeatured?: boolean | string;
  isNew?: boolean | string;
  minPrice?: number | string;
  maxPrice?: number | string;
  sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'oldest' | 'popular' | 'name_asc' | 'name_desc';
}

export class ProductService {
  /**
   * Tạo mới sản phẩm kèm biến thể và thư viện ảnh (Chỉ ADMIN)
   */
  async createProduct(data: CreateProductDTO) {
    const {
      name,
      shortDescription,
      description,
      thumbnail,
      categoryId,
      brandId,
      warrantyMonths,
      specifications,
      status,
      isFeatured,
      isNew,
      variants = [],
      images = [],
    } = data;

    if (!name || !name.trim()) {
      throw { statusCode: 400, message: 'Tên sản phẩm là bắt buộc.' };
    }

    if (!categoryId) {
      throw { statusCode: 400, message: 'Danh mục sản phẩm (categoryId) là bắt buộc.' };
    }

    // Kiểm tra danh mục có tồn tại không
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      throw { statusCode: 404, message: 'Danh mục được chỉ định không tồn tại.' };
    }

    // Kiểm tra thương hiệu (nếu có)
    if (brandId) {
      const brand = await prisma.brand.findUnique({ where: { id: brandId } });
      if (!brand) {
        throw { statusCode: 404, message: 'Thương hiệu được chỉ định không tồn tại.' };
      }
    }

    const trimmedName = name.trim();
    let slug = data.slug?.trim() ? generateSlug(data.slug) : generateSlug(trimmedName);

    if (!slug) {
      slug = generateSlug(trimmedName);
    }

    // Kiểm tra trùng lặp slug
    const existing = await prisma.product.findUnique({ where: { slug } });
    if (existing) {
      throw { statusCode: 409, message: `Slug sản phẩm "${slug}" đã tồn tại. Vui lòng chọn slug khác.` };
    }

    // Kiểm tra danh sách SKU biến thể
    if (variants.length > 0) {
      const skus = variants.map((v) => v.sku.trim());
      const hasDuplicateSku = new Set(skus).size !== skus.length;
      if (hasDuplicateSku) {
        throw { statusCode: 400, message: 'Các biến thể không được trùng lặp mã SKU.' };
      }

      const existingVariants = await prisma.productVariant.findMany({
        where: { sku: { in: skus } },
      });
      if (existingVariants.length > 0) {
        const dupList = existingVariants.map((v) => v.sku).join(', ');
        throw { statusCode: 409, message: `Mã SKU [${dupList}] đã tồn tại trong hệ thống.` };
      }
    }

    // Thực hiện transaction tạo sản phẩm, biến thể và hình ảnh
    return prisma.$transaction(async (tx) => {
      // Xác định thumbnail chính từ mảng ảnh hoặc tham số thumbnail
      let mainThumbnail = thumbnail?.trim() || null;
      if (!mainThumbnail && images.length > 0) {
        const defaultThumb = images.find((img) => img.isThumbnail);
        mainThumbnail = defaultThumb ? defaultThumb.url : images[0].url;
      }

      // Tạo sản phẩm cha
      const product = await tx.product.create({
        data: {
          name: trimmedName,
          slug,
          shortDescription: shortDescription?.trim() || null,
          description: description?.trim() || null,
          thumbnail: mainThumbnail,
          categoryId,
          brandId: brandId || null,
          warrantyMonths: warrantyMonths !== undefined ? Number(warrantyMonths) : 12,
          specifications: specifications || undefined,
          status: status || ProductStatus.DRAFT,
          isFeatured: Boolean(isFeatured),
          isNew: isNew !== undefined ? Boolean(isNew) : true,
        },
      });

      // Tạo các biến thể (nếu có)
      if (variants.length > 0) {
        let hasDefault = variants.some((v) => v.isDefault);

        await tx.productVariant.createMany({
          data: variants.map((v, index) => ({
            productId: product.id,
            sku: v.sku.trim(),
            name: v.name.trim(),
            originalPrice: v.originalPrice,
            salePrice: v.salePrice !== undefined && v.salePrice !== null ? v.salePrice : null,
            stockQuantity: Number(v.stockQuantity) || 0,
            imageUrl: v.imageUrl?.trim() || null,
            attributes: v.attributes || undefined,
            isDefault: hasDefault ? Boolean(v.isDefault) : index === 0, // Mặc định cái đầu tiên nếu chưa set
            isActive: v.isActive !== undefined ? Boolean(v.isActive) : true,
          })),
        });
      }

      // Tạo thư viện ảnh (nếu có)
      if (images.length > 0) {
        await tx.productImage.createMany({
          data: images.map((img, index) => ({
            productId: product.id,
            url: img.url.trim(),
            altText: img.altText?.trim() || product.name,
            order: img.order !== undefined ? Number(img.order) : index,
            isThumbnail: Boolean(img.isThumbnail),
          })),
        });
      }

      // Trả về đầy đủ thông tin sản phẩm vừa tạo
      return tx.product.findUnique({
        where: { id: product.id },
        include: {
          category: {
            select: { id: true, name: true, slug: true },
          },
          brand: {
            select: { id: true, name: true, slug: true, logoUrl: true },
          },
          variants: {
            orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
          },
          images: {
            orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
          },
        },
      });
    });
  }

  /**
   * Lấy danh sách sản phẩm với bộ lọc đa năng & phân trang (Công khai & Admin)
   */
  async getProducts(query: GetProductsQueryDTO = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 12));
    const skip = (page - 1) * limit;

    const where: any = {};

    // 1. Lọc theo trạng thái sản phẩm
    if (query.status) {
      where.status = query.status as ProductStatus;
    }

    // 2. Lọc theo danh mục
    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    // 3. Lọc theo thương hiệu
    if (query.brandId) {
      where.brandId = query.brandId;
    }

    // 4. Lọc cờ nổi bật hoặc hàng mới
    if (query.isFeatured !== undefined && query.isFeatured !== '') {
      where.isFeatured = query.isFeatured === true || query.isFeatured === 'true';
    }
    if (query.isNew !== undefined && query.isNew !== '') {
      where.isNew = query.isNew === true || query.isNew === 'true';
    }

    // 5. Tìm kiếm theo từ khóa (tên, slug, mô tả tóm tắt)
    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { slug: { contains: term, mode: 'insensitive' } },
        { shortDescription: { contains: term, mode: 'insensitive' } },
      ];
    }

    // 6. Lọc theo khoảng giá biến thể (minPrice, maxPrice)
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      const priceFilter: any = {};
      if (query.minPrice !== undefined && query.minPrice !== '') {
        priceFilter.gte = Number(query.minPrice);
      }
      if (query.maxPrice !== undefined && query.maxPrice !== '') {
        priceFilter.lte = Number(query.maxPrice);
      }

      where.variants = {
        some: {
          OR: [
            { salePrice: priceFilter },
            { AND: [{ salePrice: null }, { originalPrice: priceFilter }] },
          ],
        },
      };
    }

    // 7. Xác định thứ tự sắp xếp (Sorting)
    let orderBy: any = [{ createdAt: 'desc' }];
    switch (query.sortBy) {
      case 'newest':
        orderBy = [{ createdAt: 'desc' }];
        break;
      case 'oldest':
        orderBy = [{ createdAt: 'asc' }];
        break;
      case 'popular':
        orderBy = [{ soldCount: 'desc' }, { viewCount: 'desc' }];
        break;
      case 'name_asc':
        orderBy = [{ name: 'asc' }];
        break;
      case 'name_desc':
        orderBy = [{ name: 'desc' }];
        break;
      default:
        orderBy = [{ createdAt: 'desc' }];
        break;
    }

    // Đếm tổng số bản ghi thỏa mãn điều kiện
    const [totalItems, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          category: {
            select: { id: true, name: true, slug: true },
          },
          brand: {
            select: { id: true, name: true, slug: true, logoUrl: true },
          },
          variants: {
            where: { isActive: true },
            orderBy: [{ isDefault: 'desc' }, { originalPrice: 'asc' }],
          },
          images: {
            orderBy: [{ order: 'asc' }],
            take: 4, // Lấy 4 ảnh đầu đại diện
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    return {
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      data: products,
    };
  }

  /**
   * Lấy chi tiết sản phẩm theo ID hoặc Slug (Kèm tăng viewCount)
   */
  async getProductByIdentifier(identifier: string, incrementView: boolean = true) {
    if (!identifier) {
      throw { statusCode: 400, message: 'Vui lòng cung cấp ID hoặc Slug sản phẩm.' };
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

    const product = await prisma.product.findFirst({
      where: isUuid ? { OR: [{ id: identifier }, { slug: identifier }] } : { slug: identifier },
      include: {
        category: {
          select: { id: true, name: true, slug: true, parentId: true },
        },
        brand: {
          select: { id: true, name: true, slug: true, logoUrl: true, website: true },
        },
        variants: {
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        },
        images: {
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!product) {
      throw { statusCode: 404, message: 'Không tìm thấy sản phẩm yêu cầu.' };
    }

    // Tăng lượt xem sản phẩm (bất đồng bộ ngầm)
    if (incrementView) {
      prisma.product
        .update({
          where: { id: product.id },
          data: { viewCount: { increment: 1 } },
        })
        .catch(() => { });
    }

    return product;
  }

  /**
   * Lấy danh sách sản phẩm nổi bật (Featured Products cho trang chủ)
   */
  async getFeaturedProducts(limit: number = 8) {
    return prisma.product.findMany({
      where: {
        isFeatured: true,
        status: ProductStatus.PUBLISHED,
      },
      take: Math.min(20, Math.max(1, limit)),
      orderBy: [{ soldCount: 'desc' }, { createdAt: 'desc' }],
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
        brand: {
          select: { id: true, name: true, slug: true, logoUrl: true },
        },
        variants: {
          where: { isActive: true },
          orderBy: [{ isDefault: 'desc' }, { originalPrice: 'asc' }],
        },
      },
    });
  }

  /**
   * Lấy danh sách sản phẩm liên quan (Cùng danh mục hoặc cùng thương hiệu)
   */
  async getRelatedProducts(productId: string, limit: number = 4) {
    const targetProduct = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, categoryId: true, brandId: true },
    });

    if (!targetProduct) {
      throw { statusCode: 404, message: 'Không tìm thấy sản phẩm gốc.' };
    }

    return prisma.product.findMany({
      where: {
        id: { not: productId },
        status: ProductStatus.PUBLISHED,
        OR: [
          { categoryId: targetProduct.categoryId },
          ...(targetProduct.brandId ? [{ brandId: targetProduct.brandId }] : []),
        ],
      },
      take: limit,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
        brand: {
          select: { id: true, name: true, slug: true, logoUrl: true },
        },
        variants: {
          where: { isActive: true },
          orderBy: [{ isDefault: 'desc' }, { originalPrice: 'asc' }],
        },
      },
    });
  }

  /**
   * Cập nhật thông tin chung của sản phẩm (Chỉ ADMIN)
   */
  async updateProduct(id: string, data: UpdateProductDTO) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw { statusCode: 404, message: 'Không tìm thấy sản phẩm cần cập nhật.' };
    }

    // Xử lý danh mục nếu có thay đổi
    if (data.categoryId && data.categoryId !== product.categoryId) {
      const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
      if (!category) {
        throw { statusCode: 404, message: 'Danh mục được chỉ định không tồn tại.' };
      }
    }

    // Xử lý thương hiệu nếu có thay đổi
    if (data.brandId && data.brandId !== product.brandId) {
      const brand = await prisma.brand.findUnique({ where: { id: data.brandId } });
      if (!brand) {
        throw { statusCode: 404, message: 'Thương hiệu được chỉ định không tồn tại.' };
      }
    }

    // Xử lý slug
    let newSlug = product.slug;
    if (data.slug && data.slug.trim()) {
      newSlug = generateSlug(data.slug.trim());
    } else if (data.name && data.name.trim() !== product.name) {
      newSlug = generateSlug(data.name.trim());
    }

    if (newSlug !== product.slug) {
      const conflict = await prisma.product.findFirst({
        where: { slug: newSlug, NOT: { id } },
      });
      if (conflict) {
        throw { statusCode: 409, message: `Slug sản phẩm "${newSlug}" đã được sử dụng.` };
      }
    }

    return prisma.product.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name.trim() }),
        slug: newSlug,
        ...(data.shortDescription !== undefined && { shortDescription: data.shortDescription?.trim() || null }),
        ...(data.description !== undefined && { description: data.description?.trim() || null }),
        ...(data.thumbnail !== undefined && { thumbnail: data.thumbnail?.trim() || null }),
        ...(data.categoryId && { categoryId: data.categoryId }),
        ...(data.brandId !== undefined && { brandId: data.brandId || null }),
        ...(data.warrantyMonths !== undefined && { warrantyMonths: Number(data.warrantyMonths) }),
        ...(data.specifications !== undefined && { specifications: data.specifications }),
        ...(data.status && { status: data.status }),
        ...(data.isFeatured !== undefined && { isFeatured: Boolean(data.isFeatured) }),
        ...(data.isNew !== undefined && { isNew: Boolean(data.isNew) }),
      },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
        brand: {
          select: { id: true, name: true, slug: true, logoUrl: true },
        },
        variants: true,
        images: true,
      },
    });
  }

  /**
   * Cập nhật nhanh trạng thái sản phẩm (Chỉ ADMIN)
   */
  async updateProductStatus(id: string, status: ProductStatus) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw { statusCode: 404, message: 'Không tìm thấy sản phẩm.' };
    }

    return prisma.product.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Xóa sản phẩm (Cascade xóa biến thể và hình ảnh) (Chỉ ADMIN)
   */
  async deleteProduct(id: string) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw { statusCode: 404, message: 'Không tìm thấy sản phẩm cần xóa.' };
    }

    await prisma.product.delete({ where: { id } });

    return { message: `Đã xóa sản phẩm "${product.name}" thành công.` };
  }

  // QUẢN LÝ BIẾN THỂ (PRODUCT VARIANT MANAGEMENT)

  /**
   * Thêm một biến thể mới cho sản phẩm (Chỉ ADMIN)
   */
  async addVariant(productId: string, data: CreateProductVariantDTO) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw { statusCode: 404, message: 'Không tìm thấy sản phẩm.' };
    }

    const trimmedSku = data.sku.trim();
    const existingSku = await prisma.productVariant.findUnique({ where: { sku: trimmedSku } });
    if (existingSku) {
      throw { statusCode: 409, message: `Mã SKU "${trimmedSku}" đã tồn tại trên hệ thống.` };
    }

    // Nếu biến thể này đánh dấu là default, bỏ default của các biến thể khác
    if (data.isDefault) {
      await prisma.productVariant.updateMany({
        where: { productId },
        data: { isDefault: false },
      });
    }

    return prisma.productVariant.create({
      data: {
        productId,
        sku: trimmedSku,
        name: data.name.trim(),
        originalPrice: data.originalPrice,
        salePrice: data.salePrice !== undefined && data.salePrice !== null ? data.salePrice : null,
        stockQuantity: Number(data.stockQuantity) || 0,
        imageUrl: data.imageUrl?.trim() || null,
        attributes: data.attributes || undefined,
        isDefault: Boolean(data.isDefault),
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
      },
    });
  }

  /**
   * Cập nhật thông tin một biến thể (Chỉ ADMIN)
   */
  async updateVariant(variantId: string, data: UpdateProductVariantDTO) {
    const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant) {
      throw { statusCode: 404, message: 'Không tìm thấy biến thể cần cập nhật.' };
    }

    if (data.sku && data.sku.trim() !== variant.sku) {
      const conflict = await prisma.productVariant.findUnique({
        where: { sku: data.sku.trim() },
      });
      if (conflict) {
        throw { statusCode: 409, message: `Mã SKU "${data.sku.trim()}" đã được sử dụng.` };
      }
    }

    // Nếu set isDefault = true, bỏ default của các biến thể cùng sản phẩm
    if (data.isDefault) {
      await prisma.productVariant.updateMany({
        where: { productId: variant.productId, NOT: { id: variantId } },
        data: { isDefault: false },
      });
    }

    return prisma.productVariant.update({
      where: { id: variantId },
      data: {
        ...(data.sku && { sku: data.sku.trim() }),
        ...(data.name && { name: data.name.trim() }),
        ...(data.originalPrice !== undefined && { originalPrice: data.originalPrice }),
        ...(data.salePrice !== undefined && { salePrice: data.salePrice }),
        ...(data.stockQuantity !== undefined && { stockQuantity: Number(data.stockQuantity) }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl?.trim() || null }),
        ...(data.attributes !== undefined && { attributes: data.attributes }),
        ...(data.isDefault !== undefined && { isDefault: Boolean(data.isDefault) }),
        ...(data.isActive !== undefined && { isActive: Boolean(data.isActive) }),
      },
    });
  }

  /**
   * Xóa một biến thể (Chỉ ADMIN)
   */
  async deleteVariant(variantId: string) {
    const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant) {
      throw { statusCode: 404, message: 'Không tìm thấy biến thể cần xóa.' };
    }

    await prisma.productVariant.delete({ where: { id: variantId } });

    return { message: `Đã xóa biến thể SKU "${variant.sku}" thành công.` };
  }

  // QUẢN LÝ THƯ VIỆN ẢNH (IMAGE GALLERY MANAGEMENT)

  /**
   * Thêm ảnh vào thư viện của sản phẩm
   */
  async addImage(productId: string, data: ProductImageDTO) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw { statusCode: 404, message: 'Không tìm thấy sản phẩm.' };
    }

    if (!data.url || !data.url.trim()) {
      throw { statusCode: 400, message: 'Đường dẫn ảnh (url) là bắt buộc.' };
    }

    return prisma.productImage.create({
      data: {
        productId,
        url: data.url.trim(),
        altText: data.altText?.trim() || product.name,
        order: Number(data.order) || 0,
        isThumbnail: Boolean(data.isThumbnail),
      },
    });
  }

  /**
   * Xóa một ảnh khỏi thư viện
   */
  async deleteImage(imageId: string) {
    const image = await prisma.productImage.findUnique({ where: { id: imageId } });
    if (!image) {
      throw { statusCode: 404, message: 'Không tìm thấy hình ảnh cần xóa.' };
    }

    await prisma.productImage.delete({ where: { id: imageId } });

    return { message: 'Đã xóa hình ảnh thành công.' };
  }
}

export const productService = new ProductService();
