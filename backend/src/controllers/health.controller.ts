import { Request, Response, NextFunction } from 'express';
import { getHealthStatus } from '../services/health.service';

export const checkHealth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const healthData = await getHealthStatus();
    const statusCode = healthData.status === 'ok' ? 200 : 503;
    res.status(statusCode).json({
      success: healthData.status === 'ok',
      data: healthData,
    });
  } catch (error) {
    next(error);
  }
};

export const getRoot = (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'TinhIT Tech Store Backend API is operational',
    version: '1.0.0',
    docs: '/api/health',
  });
};

export const HealthController = {
  checkHealth,
  getRoot,
};
