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
}

export const emailService = new EmailService();
