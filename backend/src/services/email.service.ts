import nodemailer, { Transporter } from 'nodemailer';
import { config } from '../config/env';

class EmailService {
  private transporter: Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  private initTransporter() {
    if (config.smtp.user && config.smtp.pass) {
      this.transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: {
          user: config.smtp.user,
          pass: config.smtp.pass,
        },
      });
    }
  }

  /**
   * Send Registration OTP email to user
   */
  async sendRegistrationOtp(email: string, otp: string, fullName?: string): Promise<void> {
    const name = fullName || 'Quý khách';
    const subject = `[TinhIT Tech Store] Mã xác nhận đăng ký tài khoản: ${otp}`;

    const htmlContent = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 580px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <div style="background: linear-gradient(135deg, #1e293b, #0f172a); padding: 28px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px;">TinhIT Tech Store</h1>
          <p style="color: #94a3b8; margin: 6px 0 0; font-size: 14px;">Chuyên trang thiết bị công nghệ & linh kiện chính hãng</p>
        </div>

        <div style="padding: 32px 28px; color: #334155; line-height: 1.6;">
          <p style="font-size: 16px; margin: 0 0 16px;">Xin chào <strong>${name}</strong>,</p>
          <p style="font-size: 15px; margin: 0 0 24px;">
            Cảm ơn bạn đã đăng ký tài khoản tại <strong>TinhIT Tech Store</strong>. Để hoàn tất quy trình kích hoạt tài khoản của bạn, vui lòng nhập mã xác thực OTP bên dưới:
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <div style="display: inline-block; background-color: #f1f5f9; border: 2px dashed #3b82f6; border-radius: 10px; padding: 16px 36px;">
              <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1d4ed8; font-family: monospace;">${otp}</span>
            </div>
            <p style="font-size: 13px; color: #64748b; margin-top: 10px;">(Mã xác thực có hiệu lực trong vòng <strong>10 phút</strong>)</p>
          </div>

          <p style="font-size: 14px; color: #64748b; margin-bottom: 24px;">
            Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này hoặc liên hệ bộ phận hỗ trợ khách hàng. Tuyệt đối không chia sẻ mã này cho bất kỳ ai.
          </p>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />

          <p style="font-size: 13px; color: #94a3b8; text-align: center; margin: 0;">
            © 2026 TinhIT Tech Store. Mọi quyền được bảo lưu.
          </p>
        </div>
      </div>
    `;

    // If SMTP credentials are configured, send real email
    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: config.smtp.from,
          to: email,
          subject,
          html: htmlContent,
        });
        console.log(`[EmailService] OTP sent successfully to ${email}`);
        return;
      } catch (error) {
        console.error(`[EmailService] Failed to send email via SMTP to ${email}:`, error);
        // Fall back to console log so development/testing is not blocked
      }
    }

    // Dev/Fallback mock logger
    console.log('\n======================================================');
    console.log(`[MOCK EMAIL SERVICE] To: ${email}`);
    console.log(`[MÃ XÁC NHẬN ĐĂNG KÝ OTP]: ${otp}`);
    console.log(`Hết hạn trong 10 phút`);
    console.log('======================================================\n');
  }

  /**
   * Send Order Confirmation email to customer
   */
  async sendOrderConfirmationEmail(
    email: string,
    order: {
      orderCode: string;
      recipientName: string;
      recipientPhone: string;
      shippingAddress: string;
      totalAmount: number;
      subtotal: number;
      shippingFee: number;
      discountAmount: number;
      paymentMethod: string;
      items: Array<{
        productName: string;
        variantName: string;
        quantity: number;
        price: number;
        thumbnail?: string | null;
      }>;
    }
  ): Promise<void> {
    const subject = `[TinhIT Tech Store] Xác nhận đơn hàng thành công #${order.orderCode}`;

    const itemsHtml = order.items
      .map(
        (item) => `
        <tr>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0;">
            <div style="font-weight: 600; color: #1e293b;">${item.productName}</div>
            <div style="font-size: 12px; color: #64748b;">Phiên bản: ${item.variantName}</div>
          </td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #475569;">
            ${item.quantity}
          </td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: #0f172a;">
            ${item.price.toLocaleString('vi-VN')} đ
          </td>
        </tr>
      `
      )
      .join('');

    const htmlContent = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 620px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #1e293b, #0f172a); padding: 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">TinhIT Tech Store</h1>
          <p style="color: #38bdf8; margin: 6px 0 0; font-size: 14px; font-weight: 600;">Cảm ơn bạn đã đặt hàng!</p>
        </div>

        <div style="padding: 24px; color: #334155; line-height: 1.6;">
          <p style="font-size: 15px; margin: 0 0 16px;">Xin chào <strong>${order.recipientName}</strong>,</p>
          <p style="font-size: 14px; margin: 0 0 20px;">
            Đơn hàng <strong>#${order.orderCode}</strong> của bạn đã được tiếp nhận và đang được bộ phận vận hành chuẩn bị đóng gói.
          </p>

          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
            <div style="font-size: 13px; margin-bottom: 6px;"><strong>Người nhận:</strong> ${order.recipientName} (${order.recipientPhone})</div>
            <div style="font-size: 13px; margin-bottom: 6px;"><strong>Địa chỉ giao hàng:</strong> ${order.shippingAddress}</div>
            <div style="font-size: 13px;"><strong>Phương thức thanh toán:</strong> ${order.paymentMethod}</div>
          </div>

          <h3 style="font-size: 15px; margin: 16px 0 10px; color: #1e293b; border-bottom: 2px solid #3b82f6; padding-bottom: 6px;">Chi tiết sản phẩm</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #f1f5f9; color: #475569; text-align: left;">
                <th style="padding: 8px;">Sản phẩm</th>
                <th style="padding: 8px; text-align: center;">SL</th>
                <th style="padding: 8px; text-align: right;">Đơn giá</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div style="border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 13px; line-height: 1.8;">
            <div style="display: flex; justify-content: space-between;">
              <span>Tạm tính:</span>
              <span style="font-weight: 500;">${order.subtotal.toLocaleString('vi-VN')} đ</span>
            </div>
            ${
              order.discountAmount > 0
                ? `<div style="display: flex; justify-content: space-between; color: #16a34a;">
                    <span>Giảm giá khuyến mãi:</span>
                    <span>-${order.discountAmount.toLocaleString('vi-VN')} đ</span>
                  </div>`
                : ''
            }
            <div style="display: flex; justify-content: space-between;">
              <span>Phí vận chuyển:</span>
              <span style="font-weight: 500;">${order.shippingFee === 0 ? 'Miễn phí' : `${order.shippingFee.toLocaleString('vi-VN')} đ`}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 700; color: #dc2626; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #cbd5e1;">
              <span>Tổng thanh toán:</span>
              <span>${order.totalAmount.toLocaleString('vi-VN')} đ</span>
            </div>
          </div>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />

          <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
            © 2026 TinhIT Tech Store. Hotline: 1900 6868 | Email: hotro@tinhit.vn
          </p>
        </div>
      </div>
    `;

    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: config.smtp.from,
          to: email,
          subject,
          html: htmlContent,
        });
        console.log(`[EmailService] Order confirmation email sent to ${email} for order ${order.orderCode}`);
        return;
      } catch (error) {
        console.error(`[EmailService] Failed to send order confirmation to ${email}:`, error);
      }
    }

    console.log('\n======================================================');
    console.log(`[MOCK EMAIL SERVICE] Order Confirmation to: ${email}`);
    console.log(`Đơn hàng: #${order.orderCode} | Tổng tiền: ${order.totalAmount.toLocaleString('vi-VN')} đ`);
    console.log('======================================================\n');
  }
}

export const emailService = new EmailService();

