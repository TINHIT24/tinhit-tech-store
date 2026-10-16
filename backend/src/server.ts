import app from './app';
import { config } from './config/env';
import prisma from './config/prisma';

const server = app.listen(config.port, () => {
  console.log(`Server is running on port ${config.port}`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Base URL: http://localhost:${config.port}`);
  console.log(`Health API: http://localhost:${config.port}${config.apiPrefix}/health`);
});

// Graceful shutdown handling
const handleGracefulShutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  try {
    await prisma.$disconnect();
    console.log('Database disconnected.');
  } catch (err) {
    console.error('Error disconnecting database:', err);
  }

  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
