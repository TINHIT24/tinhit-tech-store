/**
 * Chuyển đổi chuỗi tiếng Việt có dấu thành slug URL thân thiện với SEO
 * Ví dụ: "Laptop Gaming & Đồ Họa Cao Cấp" -> "laptop-gaming-do-hoa-cao-cap"
 */
export const generateSlug = (text: string): string => {
  if (!text || typeof text !== 'string') return '';

  return text
    .toLowerCase()
    .normalize('NFD') // Tách tổ hợp ký tự có dấu
    .replace(/[\u0300-\u036f]/g, '') // Xóa các dấu thanh
    .replace(/[đĐ]/g, 'd') // Thay thế ký tự đ/Đ
    .replace(/[^a-z0-9\s-]/g, '') // Xóa các ký tự đặc biệt
    .trim()
    .replace(/\s+/g, '-') // Thay thế khoảng trắng bằng dấu gạch ngang
    .replace(/-+/g, '-') // Gom nhiều dấu gạch ngang liên tiếp thành 1
    .replace(/^-+|-+$/g, ''); // Cắt bỏ gạch ngang ở đầu và cuối chuỗi
};
