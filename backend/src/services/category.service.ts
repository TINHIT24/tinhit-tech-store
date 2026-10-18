import prisma from '../config/prisma';
import { generateSlug } from '../utils/slug.util';

export interface CreateCategoryDTO {
  name: string;
  slug?: string;
  description?: string;
  imageUrl?: string;
  iconUrl?: string;
  parentId?: string | null;
  order?: number;
  isActive?: boolean;
}

export interface UpdateCategoryDTO {
  name?: string;
  slug?: string;
  description?: string;
  imageUrl?: string;
  iconUrl?: string;
  parentId?: string | null;
  order?: number;
  isActive?: boolean;
}

export interface GetCategoriesQueryDTO {
  tree?: boolean | string;
  search?: string;
  isActive?: boolean | string;
  parentId?: string | null;
}

export class CategoryService {
  /**
   * Lấy danh sách danh mục (hỗ trợ phân cấp cây cha-con hoặc danh sách phẳng)
   */
  async getCategories(query: GetCategoriesQueryDTO = {}) {
    const isTree = query.tree === true || query.tree === 'true';
    const where: any = {};

    // Lọc theo trạng thái hiển thị
    if (query.isActive !== undefined && query.isActive !== '') {
      where.isActive = query.isActive === true || query.isActive === 'true';
    }

    // Tìm kiếm theo tên hoặc mô tả
    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { slug: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }

    if (isTree) {
      // Dạng cây: Chỉ lấy các danh mục gốc (parentId = null), sau đó đệ quy lấy children
      where.parentId = null;

      return prisma.category.findMany({
        where,
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        include: {
          children: {
            where: query.isActive !== undefined && query.isActive !== ''
              ? { isActive: query.isActive === true || query.isActive === 'true' }
              : undefined,
            orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
            include: {
              children: {
                orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
              },
            },
          },
        },
      });
    }

    // Dạng phẳng (Flat List)
    if (query.parentId !== undefined) {
      where.parentId = query.parentId === 'null' || query.parentId === null ? null : query.parentId;
    }

    return prisma.category.findMany({
      where,
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      include: {
        parent: {
          select: { id: true, name: true, slug: true },
        },
        _count: {
          select: { children: true },
        },
      },
    });
  }

  /**
   * Lấy chi tiết danh mục theo ID hoặc Slug
   */
  async getCategoryByIdentifier(identifier: string) {
    if (!identifier) {
      throw { statusCode: 400, message: 'Vui lòng cung cấp ID hoặc Slug danh mục.' };
    }

    // Kiểm tra xem identifier có phải là UUID không
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

    const category = await prisma.category.findFirst({
      where: isUuid ? { OR: [{ id: identifier }, { slug: identifier }] } : { slug: identifier },
      include: {
        parent: {
          select: { id: true, name: true, slug: true, parentId: true },
        },
        children: {
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!category) {
      throw { statusCode: 404, message: 'Không tìm thấy danh mục yêu cầu.' };
    }

    return category;
  }

  /**
   * Tạo mới danh mục sản phẩm
   */
  async createCategory(data: CreateCategoryDTO) {
    const { name, description, imageUrl, iconUrl, parentId, order, isActive } = data;

    if (!name || !name.trim()) {
      throw { statusCode: 400, message: 'Tên danh mục là bắt buộc.' };
    }

    const trimmedName = name.trim();
    // Tạo slug từ tên nếu người dùng không tự nhập
    let slug = data.slug?.trim() ? generateSlug(data.slug) : generateSlug(trimmedName);

    if (!slug) {
      slug = generateSlug(trimmedName);
    }

    // Kiểm tra trùng lặp slug
    const existing = await prisma.category.findUnique({ where: { slug } });
    if (existing) {
      throw { statusCode: 409, message: `Slug danh mục "${slug}" đã tồn tại. Vui lòng chọn slug khác.` };
    }

    // Nếu có parentId, kiểm tra danh mục cha có tồn tại không
    if (parentId) {
      const parent = await prisma.category.findUnique({ where: { id: parentId } });
      if (!parent) {
        throw { statusCode: 404, message: 'Danh mục cha được chỉ định không tồn tại.' };
      }
    }

    return prisma.category.create({
      data: {
        name: trimmedName,
        slug,
        description: description?.trim() || null,
        imageUrl: imageUrl?.trim() || null,
        iconUrl: iconUrl?.trim() || null,
        parentId: parentId || null,
        order: Number(order) || 0,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
      include: {
        parent: {
          select: { id: true, name: true, slug: true },
        },
      },
    });
  }

  /**
   * Cập nhật thông tin danh mục
   */
  async updateCategory(id: string, data: UpdateCategoryDTO) {
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw { statusCode: 404, message: 'Không tìm thấy danh mục cần cập nhật.' };
    }

    // Xử lý slug mới nếu có thay đổi
    let newSlug = category.slug;
    if (data.slug && data.slug.trim()) {
      newSlug = generateSlug(data.slug.trim());
    } else if (data.name && data.name.trim() !== category.name) {
      newSlug = generateSlug(data.name.trim());
    }

    if (newSlug !== category.slug) {
      const conflict = await prisma.category.findFirst({
        where: { slug: newSlug, NOT: { id } },
      });
      if (conflict) {
        throw { statusCode: 409, message: `Slug danh mục "${newSlug}" đã được sử dụng bởi danh mục khác.` };
      }
    }

    // Kiểm tra logic danh mục cha (parentId)
    if (data.parentId !== undefined) {
      if (data.parentId === id) {
        throw { statusCode: 400, message: 'Danh mục không thể làm cha của chính nó.' };
      }

      if (data.parentId) {
        const parent = await prisma.category.findUnique({ where: { id: data.parentId } });
        if (!parent) {
          throw { statusCode: 404, message: 'Danh mục cha được chỉ định không tồn tại.' };
        }

        // Kiểm tra chống tạo vòng lặp (danh mục con không thể trở thành cha của tổ tiên nó)
        if (parent.parentId === id) {
          throw { statusCode: 400, message: 'Không thể thiết lập danh mục con làm cha của danh mục này.' };
        }
      }
    }

    return prisma.category.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name.trim() }),
        slug: newSlug,
        ...(data.description !== undefined && { description: data.description?.trim() || null }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl?.trim() || null }),
        ...(data.iconUrl !== undefined && { iconUrl: data.iconUrl?.trim() || null }),
        ...(data.parentId !== undefined && { parentId: data.parentId || null }),
        ...(data.order !== undefined && { order: Number(data.order) }),
        ...(data.isActive !== undefined && { isActive: Boolean(data.isActive) }),
      },
      include: {
        parent: {
          select: { id: true, name: true, slug: true },
        },
      },
    });
  }

  /**
   * Bật/tắt nhanh trạng thái hiển thị của danh mục
   */
  async toggleCategoryStatus(id: string, isActive?: boolean) {
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw { statusCode: 404, message: 'Không tìm thấy danh mục.' };
    }

    const nextState = isActive !== undefined ? Boolean(isActive) : !category.isActive;

    return prisma.category.update({
      where: { id },
      data: { isActive: nextState },
    });
  }

  /**
   * Xóa danh mục
   */
  async deleteCategory(id: string, force: boolean = false) {
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { children: true },
        },
      },
    });

    if (!category) {
      throw { statusCode: 404, message: 'Không tìm thấy danh mục cần xóa.' };
    }

    const childrenCount = category._count.children;

    if (childrenCount > 0 && !force) {
      throw {
        statusCode: 400,
        message: `Danh mục "${category.name}" đang chứa ${childrenCount} danh mục con. Vui lòng xóa hoặc di chuyển các danh mục con trước, hoặc sử dụng tùy chọn xóa ép buộc.`,
      };
    }

    // Nếu force = true và có danh mục con, set parentId của các con về null
    if (childrenCount > 0 && force) {
      await prisma.category.updateMany({
        where: { parentId: id },
        data: { parentId: null },
      });
    }

    await prisma.category.delete({ where: { id } });

    return { message: `Đã xóa danh mục "${category.name}" thành công.` };
  }
}

export const categoryService = new CategoryService();
