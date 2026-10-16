export interface SystemMemoryInfo {
  totalMb: number;
  freeMb: number;
  usedMb: number;
}

export interface DatabaseHealthInfo {
  status: 'connected' | 'disconnected';
  provider: 'postgresql';
  latencyMs?: number;
  error?: string;
}

export interface HealthCheckData {
  status: 'ok' | 'degraded' | 'error';
  message: string;
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  nodeVersion: string;
  database: DatabaseHealthInfo;
  memory: SystemMemoryInfo;
}
