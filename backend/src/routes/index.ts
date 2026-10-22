import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import categoryRoutes from './category.routes';
import brandRoutes from './brand.routes';
import productRoutes from './product.routes';
import uploadRoutes from './upload.routes';
import cartRoutes from './cart.routes';
import couponRoutes from './coupon.routes';
import orderRoutes from './order.routes';
import paymentRoutes from './payment.routes';

const router = Router();

// Mount sub-routes
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/categories', categoryRoutes);
router.use('/brands', brandRoutes);
router.use('/products', productRoutes);
router.use('/upload', uploadRoutes);
router.use('/cart', cartRoutes);
router.use('/coupons', couponRoutes);
router.use('/orders', orderRoutes);
router.use('/payments', paymentRoutes);

export default router;


