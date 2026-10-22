import crypto from 'crypto';
import { Prisma, OrderStatus, PaymentMethod, PaymentStatus, Role } from '@prisma/client';
import prisma from '../config/prisma';
import { config } from '../config/env';

export interface ConfirmTransferDto {
  transactionCode?: string;
  note?: string;
}

export interface VerifyPaymentDto {
  isApproved: boolean;
  transactionCode?: string;
  note?: string;
}

export class PaymentService {
  /**
   * Lấy danh sách các phương thức thanh toán hệ thống hỗ trợ
   */
  async getPaymentMethods() {
    return [
      {
        id: PaymentMethod.COD,
        name: 'Thanh toán tiền mặt khi nhận hàng (COD)',
        description: 'Quý khách nhận hàng, kiểm tra sản phẩm và thanh toán tiền mặt trực tiếp cho nhân viên giao hàng.',
        icon: 'cash',
        isDefault: true,
      },
      {
        id: PaymentMethod.MOMO,
        name: 'Chuyển khoản qua Ví MoMo',
        description: `Quét mã QR MoMo hoặc chuyển trực tiếp đến SĐT MoMo Admin: ${config.momo.phone} (${config.momo.accountName}). Cú pháp là mã đơn hàng.`,
        icon: 'momo',
        accountInfo: {
          phone: config.momo.phone,
          accountName: config.momo.accountName,
        },
      },
      {
        id: PaymentMethod.BANK_TRANSFER,
        name: 'Chuyển khoản Ngân hàng (VietQR 24/7)',
        description: `Quét mã VietQR chuyển khoản nhanh 24/7 từ bất kỳ ứng dụng ngân hàng nào đến ví MoMo/Ngân hàng Admin.`,
        icon: 'bank',
        accountInfo: {
          phone: config.momo.phone,
          accountName: config.momo.accountName,
        },
      },
    ];
  }

  /**
   * Sinh thông tin thanh toán chuyển khoản MoMo / VietQR chi tiết cho một đơn hàng
   */
  async getPaymentDetails(orderIdentifier: string, userId?: string, userRole?: Role) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      orderIdentifier
    );

    const where: Prisma.OrderWhereInput = isUuid ? { id: orderIdentifier } : { orderCode: orderIdentifier };

    const order = await prisma.order.findFirst({
      where,
      include: {
        payment: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
          },
        },
      },
    });

    if (!order) {
      throw { statusCode: 404, message: 'Không tìm thấy đơn hàng cần thanh toán.' };
    }

    // Kiểm tra quyền: chỉ chủ đơn hàng hoặc Admin/Staff được xem
    if (userRole !== Role.ADMIN && userRole !== Role.STAFF && order.userId !== userId) {
      throw { statusCode: 403, message: 'Bạn không có quyền xem thông tin thanh toán đơn hàng này.' };
    }

    const amount = Number(order.totalAmount);
    const orderCode = order.orderCode;
    const phone = config.momo.phone;
    const accountName = config.momo.accountName;

    // Chuỗi mã QR chuẩn chuyển tiền MoMo P2P: 2|99|phone|name||0|0|amount|comment|transfer_myqr
    const momoRawQr = `2|99|${phone}|${accountName}||0|0|${amount}|${orderCode}|transfer_myqr`;
    const momoQrImage = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(
      momoRawQr
    )}`;

    // Mã VietQR Napas 24/7 (hỗ trợ quét từ tất cả app ngân hàng và MoMo)
    const vietQrImage = `https://img.vietqr.io/image/970422-${phone}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(
      orderCode
    )}&accountName=${encodeURIComponent(accountName)}`;

    return {
      orderId: order.id,
      orderCode: order.orderCode,
      status: order.status,
      totalAmount: amount,
      payment: order.payment,
      transferInfo: {
        receiverPhone: phone,
        receiverName: accountName,
        amount,
        transferContent: orderCode, // Cú pháp chuyển khoản bắt buộc
        momoQrUrl: momoQrImage,
        vietQrUrl: vietQrImage,
        deeplink: `momo://?action=payWithApp&isScanQR=true`,
        instructions: [
          `Bước 1: Mở ứng dụng MoMo hoặc ứng dụng Ngân hàng của bạn.`,
          `Bước 2: Chọn tính năng "Quét mã QR" và quét một trong hai mã QR ở trên.`,
          `Bước 3: Kiểm tra thông tin: Người nhận là "${accountName}" và Số tiền là "${amount.toLocaleString('vi-VN')} đ".`,
          `Bước 4: Bắt buộc giữ nguyên nội dung chuyển khoản là "${orderCode}".`,
          `Bước 5: Hoàn tất chuyển tiền và bấm nút "Xác nhận đã chuyển khoản" bên dưới.`,
        ],
      },
    };
  }

  /**
   * Tạo phiên thanh toán Cổng MoMo Payment Gateway (MoMo Partner API)
   * Nếu đã cấu hình MOMO_ACCESS_KEY & MOMO_SECRET_KEY, tạo URL thanh toán trực tuyến.
   * Nếu chưa cấu hình, fallback sang chế độ chuyển khoản MoMo trực tiếp (Direct QR Transfer).
   */
  async createMomoPaymentUrl(orderId: string, userId: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { payment: true },
    });

    if (!order) {
      throw { statusCode: 404, message: 'Đơn hàng không tồn tại.' };
    }

    if (order.payment?.status === PaymentStatus.PAID) {
      throw { statusCode: 400, message: 'Đơn hàng này đã được thanh toán trước đó.' };
    }

    const { partnerCode, accessKey, secretKey, endpoint, redirectUrl, ipnUrl } = config.momo;

    // Nếu chưa cấu hình Gateway API key, fallback trả về thông tin mã QR chuyển tiền MoMo
    if (!accessKey || !secretKey) {
      const details = await this.getPaymentDetails(orderId, userId);
      return {
        paymentType: 'DIRECT_MOMO_QR',
        message: 'Đang sử dụng chế độ chuyển khoản Ví MoMo trực tiếp của Quản trị viên.',
        payUrl: details.transferInfo.momoQrUrl,
        qrCodeUrl: details.transferInfo.momoQrUrl,
        vietQrUrl: details.transferInfo.vietQrUrl,
        deeplink: details.transferInfo.deeplink,
        transferInfo: details.transferInfo,
      };
    }

    // Tạo thanh toán qua MoMo All-in-One Gateway API
    const requestId = `${order.orderCode}_${Date.now()}`;
    const amount = String(Math.round(Number(order.totalAmount)));
    const orderInfo = `Thanh toán đơn hàng ${order.orderCode} - TinhIT Tech Store`;
    const requestType = 'captureWallet';
    const extraData = '';

    const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${order.orderCode}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

    const signature = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');

    const requestBody = {
      partnerCode,
      partnerName: 'TinhIT Tech Store',
      storeId: 'TinhITStore',
      requestId,
      amount,
      orderId: order.orderCode,
      orderInfo,
      redirectUrl,
      ipnUrl,
      lang: 'vi',
      requestType,
      autoCapture: true,
      extraData,
      signature,
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const responseData: any = await response.json();

      if (responseData.resultCode === 0) {
        return {
          paymentType: 'MOMO_GATEWAY',
          payUrl: responseData.payUrl,
          qrCodeUrl: responseData.qrCodeUrl,
          deeplink: responseData.deeplink,
          orderId: order.id,
          orderCode: order.orderCode,
        };
      } else {
        console.warn('[MoMo Gateway] Lỗi từ cổng MoMo, fallback sang Direct QR:', responseData);
        const details = await this.getPaymentDetails(orderId, userId);
        return {
          paymentType: 'DIRECT_MOMO_QR',
          message: responseData.message || 'Chuyển sang quét mã MoMo trực tiếp',
          payUrl: details.transferInfo.momoQrUrl,
          qrCodeUrl: details.transferInfo.momoQrUrl,
          transferInfo: details.transferInfo,
        };
      }
    } catch (error) {
      console.error('[MoMo Gateway] Lỗi kết nối MoMo API:', error);
      const details = await this.getPaymentDetails(orderId, userId);
      return {
        paymentType: 'DIRECT_MOMO_QR',
        message: 'Lỗi kết nối cổng thanh toán trực tuyến, vui lòng quét mã MoMo trực tiếp.',
        payUrl: details.transferInfo.momoQrUrl,
        qrCodeUrl: details.transferInfo.momoQrUrl,
        transferInfo: details.transferInfo,
      };
    }
  }

  /**
   * Xử lý Webhook IPN từ MoMo Server khi khách thanh toán thành công qua MoMo Gateway
   */
  async handleMomoIpn(payload: any) {
    const { orderId, resultCode, transId, signature, accessKey, amount, extraData, message, requestId, responseTime } =
      payload;

    // Kiểm tra chữ ký HMAC nếu có secretKey
    if (config.momo.secretKey && signature) {
      const rawSignature = `accessKey=${config.momo.accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&partnerCode=${config.momo.partnerCode}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;
      const generatedSignature = crypto
        .createHmac('sha256', config.momo.secretKey)
        .update(rawSignature)
        .digest('hex');

      if (signature !== generatedSignature) {
        console.error('[MoMo IPN] Sai chữ ký HMAC xác thực!');
        return { status: 400, message: 'Chữ ký không hợp lệ' };
      }
    }

    if (Number(resultCode) === 0) {
      // Tìm đơn hàng theo orderCode
      const order = await prisma.order.findFirst({
        where: { orderCode: String(orderId) },
        include: { payment: true },
      });

      if (order && order.payment) {
        const now = new Date();
        await prisma.$transaction([
          prisma.payment.update({
            where: { orderId: order.id },
            data: {
              status: PaymentStatus.PAID,
              paidAt: now,
              transactionCode: String(transId),
              note: `Thanh toán thành công qua MoMo Gateway. Mã GD: ${transId}`,
            },
          }),
          prisma.order.update({
            where: { id: order.id },
            data: {
              status: OrderStatus.CONFIRMED,
              confirmedAt: order.confirmedAt || now,
            },
          }),
        ]);
        console.log(`[MoMo IPN] Đã xác nhận đơn hàng #${order.orderCode} thanh toán thành công qua MoMo!`);
      }
    }

    return { status: 204 };
  }

  /**
   * Khách hàng bấm "Xác nhận đã chuyển khoản" và gửi mã giao dịch / ghi chú
   */
  async confirmCustomerTransfer(orderId: string, userId: string, data: ConfirmTransferDto) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { payment: true },
    });

    if (!order) {
      throw { statusCode: 404, message: 'Đơn hàng không tồn tại.' };
    }

    if (!order.payment) {
      throw { statusCode: 400, message: 'Không tìm thấy thông tin thanh toán của đơn hàng.' };
    }

    if (order.payment.status === PaymentStatus.PAID) {
      throw { statusCode: 400, message: 'Đơn hàng này đã được xác nhận thanh toán thành công.' };
    }

    const noteText = data.note
      ? `Khách báo đã chuyển: ${data.note.trim()}`
      : `Khách thông báo đã chuyển khoản qua MoMo lúc ${new Date().toLocaleString('vi-VN')}`;

    const updatedPayment = await prisma.payment.update({
      where: { orderId: order.id },
      data: {
        transactionCode: data.transactionCode?.trim() || order.payment.transactionCode,
        note: noteText,
      },
    });

    return {
      message: 'Đã ghi nhận thông báo chuyển khoản. Quản trị viên sẽ kiểm tra ví MoMo và xác nhận đơn hàng sớm nhất!',
      payment: updatedPayment,
    };
  }

  /**
   * Admin / Staff duyệt thanh toán khi đã kiểm tra tiền vào ví MoMo
   */
  async verifyPaymentByAdmin(orderId: string, data: VerifyPaymentDto) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    });

    if (!order) {
      throw { statusCode: 404, message: 'Đơn hàng không tồn tại.' };
    }

    if (!order.payment) {
      throw { statusCode: 400, message: 'Đơn hàng chưa có bản ghi thanh toán.' };
    }

    const now = new Date();

    if (data.isApproved) {
      await prisma.$transaction([
        prisma.payment.update({
          where: { orderId: order.id },
          data: {
            status: PaymentStatus.PAID,
            paidAt: now,
            transactionCode: data.transactionCode?.trim() || order.payment.transactionCode,
            note: data.note?.trim() || 'Admin đã kiểm tra ví MoMo và xác nhận thanh toán thành công.',
          },
        }),
        prisma.order.update({
          where: { id: order.id },
          data: {
            status: order.status === OrderStatus.PENDING ? OrderStatus.CONFIRMED : order.status,
            confirmedAt: order.confirmedAt || now,
          },
        }),
      ]);

      return {
        success: true,
        message: 'Đã xác nhận thanh toán thành công và duyệt đơn hàng!',
      };
    } else {
      await prisma.payment.update({
        where: { orderId: order.id },
        data: {
          status: PaymentStatus.FAILED,
          note: data.note?.trim() || 'Admin từ chối xác nhận: Chưa nhận được tiền vào ví MoMo.',
        },
      });

      return {
        success: true,
        message: 'Đã đánh dấu thanh toán không thành công.',
      };
    }
  }
}

export const paymentService = new PaymentService();
