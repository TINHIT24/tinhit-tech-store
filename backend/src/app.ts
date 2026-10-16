import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config/env';
import apiRoutes from './routes';
import { getRoot } from './controllers/health.controller';
import { notFoundHandler } from './middlewares/notFoundHandler';
import { errorHandler } from './middlewares/errorHandler';

const app: Application = express();

// Security and utility middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (config.nodeEnv !== 'test') {
  app.use(morgan(config.nodeEnv === 'development' ? 'dev' : 'combined'));
}

// Root route for instant ping
app.get('/', getRoot);

// Main API routes (e.g. /api/health)
app.use(config.apiPrefix, apiRoutes);

// Catch 404 and forward to error handler
app.use(notFoundHandler);

// Global centralized error handler
app.use(errorHandler);

export default app;
