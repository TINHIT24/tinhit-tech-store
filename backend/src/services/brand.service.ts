import prisma from '../config/prisma';
import { generateSlug } from '../utils/slug.util';

export interface CreateBrandDTO {
  name: string;
  slug?: string;
  logoUrl?: string;
  description?: string;
  website?: string;
  isActive?: boolean;
}

export interface UpdateBrandDTO {
  name?: string;
  slug?: string;
  logoUrl?: string;
  description?: string;
  website?: string;
  isActive?: boolean;
}

export interface GetBrandsQueryDTO {
  search?: string;
  isActive?: boolean | string;
}

export class BrandService {
  /**
   * Lấy danh sách thương hiệu (tìm kiếm, lọc trạng thái)
   */
  async getBrands(query: GetBrandsQueryDTO = {}) {
    const where: any = {};

    if (query.isActive !== undefined && query.isActive !== '') {
      where.isActive = query.isActive === true || query.isActive === 'true';
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { slug: { contains: term, mode: 'insensitive' } },
      ];
    }

    return prisma.brand.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });
  }

  /**
   * Lấy chi tiết thương hiệu theo ID hoặc Slug
   */
  async getBrandByIdentifier(identifier: string) {
    if (!identifier) {
      throw { statusCode: 400, message: 'Vui lòng cung cấp ID hoặc Slug thương hiệu.' };
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

    const brand = await prisma.brand.findFirst({
      where: isUuid ? { OR: [{ id: identifier }, { slug: identifier }] } : { slug: identifier },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!brand) {
      throw { statusCode: 404, message: 'Không tìm thấy thương hiệu.' };
    }

    return brand;
  }

  /**
   * Tạo thương hiệu mới (Chỉ ADMIN)
   */
  async createBrand(data: CreateBrandDTO) {
    const { name, logoUrl, description, website, isActive } = data;

    if (!name || !name.trim()) {
      throw { statusCode: 400, message: 'Tên thương hiệu là bắt buộc.' };
    }

    const trimmedName = name.trim();
    let slug = data.slug?.trim() ? generateSlug(data.slug) : generateSlug(trimmedName);

    if (!slug) {
      slug = generateSlug(trimmedName);
    }

    const existing = await prisma.brand.findUnique({ where: { slug } });
    if (existing) {
      throw { statusCode: 409, message: `Thương hiệu với slug "${slug}" đã tồn tại.` };
    }

    return prisma.brand.create({
      data: {
        name: trimmedName,
        slug,
        logoUrl: logoUrl?.trim() || null,
        description: description?.trim() || null,
        website: website?.trim() || null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });
  }

  /**
   * Cập nhật thương hiệu (Chỉ ADMIN)
   */
  async updateBrand(id: string, data: UpdateBrandDTO) {
    const brand = await prisma.brand.findUnique({ where: { id } });
    if (!brand) {
      throw { statusCode: 404, message: 'Không tìm thấy thương hiệu cần cập nhật.' };
    }

    let newSlug = brand.slug;
    if (data.slug && data.slug.trim()) {
      newSlug = generateSlug(data.slug.trim());
    } else if (data.name && data.name.trim() !== brand.name) {
      newSlug = generateSlug(data.name.trim());
    }

    if (newSlug !== brand.slug) {
      const conflict = await prisma.brand.findFirst({
        where: { slug: newSlug, NOT: { id } },
      });
      if (conflict) {
        throw { statusCode: 409, message: `Slug "${newSlug}" đã được sử dụng bởi thương hiệu khác.` };
      }
    }

    return prisma.brand.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name.trim() }),
        slug: newSlug,
        ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl?.trim() || null }),
        ...(data.description !== undefined && { description: data.description?.trim() || null }),
        ...(data.website !== undefined && { website: data.website?.trim() || null }),
        ...(data.isActive !== undefined && { isActive: Boolean(data.isActive) }),
      },
    });
  }

  /**
   * Bật/tắt trạng thái hiển thị thương hiệu
   */
  async toggleBrandStatus(id: string, isActive?: boolean) {
    const brand = await prisma.brand.findUnique({ where: { id } });
    if (!brand) {
      throw { statusCode: 404, message: 'Không tìm thấy thương hiệu.' };
    }

    const nextState = isActive !== undefined ? Boolean(isActive) : !brand.isActive;

    return prisma.brand.update({
      where: { id },
      data: { isActive: nextState },
    });
  }

  /**
   * Xóa thương hiệu
   */
  async deleteBrand(id: string) {
    const brand = await prisma.brand.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!brand) {
      throw { statusCode: 404, message: 'Không tìm thấy thương hiệu cần xóa.' };
    }

    if (brand._count.products > 0) {
      throw {
        statusCode: 400,
        message: `Không thể xóa thương hiệu "${brand.name}" vì đang có ${brand._count.products} sản phẩm trực thuộc. Vui lòng chuyển sản phẩm sang thương hiệu khác trước.`,
      };
    }

    await prisma.brand.delete({ where: { id } });

    return { message: `Đã xóa thương hiệu "${brand.name}" thành công.` };
  }
}

export const brandService = new BrandService();
