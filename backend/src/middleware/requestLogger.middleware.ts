import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { httpRequestsTotal, httpRequestDurationSeconds } from '../utils/metrics';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  (req as any).requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  const startTime = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const durationSec = durationMs / 1000;
    const route = req.route ? req.route.path : req.path;

    httpRequestsTotal.inc({ method: req.method, route, status: res.statusCode.toString() });
    httpRequestDurationSeconds.observe({ method: req.method, route, status: res.statusCode.toString() }, durationSec);

    logger.info({
      requestId,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs,
      ip: req.ip
    }, `${req.method} ${req.originalUrl} ${res.statusCode} - ${durationMs}ms`);
  });

  next();
};
