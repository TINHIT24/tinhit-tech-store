import os from 'os';
import { HealthCheckData, DatabaseHealthInfo } from '../models/health.model';
import { config } from '../config/env';
import prisma from '../config/prisma';

export const getHealthStatus = async (): Promise<HealthCheckData> => {
  const totalMemBytes = os.totalmem();
  const freeMemBytes = os.freemem();
  const usedMemBytes = totalMemBytes - freeMemBytes;
  const toMb = (bytes: number) => Math.round(bytes / 1024 / 1024);

  let dbInfo: DatabaseHealthInfo;
  const startTime = Date.now();

  try {
    // Ping PostgreSQL through Prisma
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - startTime;
    dbInfo = {
      status: 'connected',
      provider: 'postgresql',
      latencyMs,
    };
  } catch (error: any) {
    dbInfo = {
      status: 'disconnected',
      provider: 'postgresql',
      error: error?.message || 'Failed to connect to PostgreSQL database',
    };
  }

  const isHealthy = dbInfo.status === 'connected';

  return {
    status: isHealthy ? 'ok' : 'degraded',
    message: isHealthy
      ? 'TinhIT Tech Store API & PostgreSQL are running smoothly'
      : 'API is running but PostgreSQL connection is degraded',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: config.nodeEnv,
    nodeVersion: process.version,
    database: dbInfo,
    memory: {
      totalMb: toMb(totalMemBytes),
      freeMb: toMb(freeMemBytes),
      usedMb: toMb(usedMemBytes),
    },
  };
};

export const HealthService = {
  getHealthStatus,
};
