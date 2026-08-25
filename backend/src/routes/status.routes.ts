import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { redisClient } from '../config/redis';
import { getPrometheusMetrics } from '../utils/metrics';
import { getQueueMetrics } from '../queues/queue.manager';

export const createStatusRoutes = (): Router => {
  const router = Router();

  // Liveness Check: verifies process is alive
  router.get('/health/live', (req: Request, res: Response) => {
    res.json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      service: 'ai-email-management-api'
    });
  });

  // Readiness Check: verifies all external dependencies (Postgres, Redis)
  router.get('/health/ready', async (req: Request, res: Response) => {
    const checks: Record<string, string> = {};
    let ready = true;

    // Check Postgres
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.postgres = 'UP';
    } catch (err: any) {
      checks.postgres = `DOWN (${err.message})`;
      ready = false;
    }

    // Check Redis
    try {
      await redisClient.ping();
      checks.redis = 'UP';
    } catch (err: any) {
      checks.redis = `DOWN (${err.message})`;
      ready = false;
    }

    const statusCode = ready ? 200 : 503;
    res.status(statusCode).json({
      status: ready ? 'READY' : 'UNREADY',
      checks,
      timestamp: new Date().toISOString()
    });
  });

  // Prometheus Metrics Exporter Endpoint
  router.get('/metrics', async (req: Request, res: Response) => {
    try {
      res.set('Content-Type', 'text/plain');
      const metrics = await getPrometheusMetrics();
      res.send(metrics);
    } catch (err: any) {
      res.status(500).send(`Error fetching metrics: ${err.message}`);
    }
  });

  // BullMQ Queue Status Endpoint
  router.get('/queues/status', async (req: Request, res: Response) => {
    try {
      const metrics = await getQueueMetrics();
      res.json({ success: true, data: metrics });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
};