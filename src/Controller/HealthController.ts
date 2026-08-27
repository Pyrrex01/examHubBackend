import { Router, type Request, type Response } from 'express';

import { HealthService } from '../Service/HealthService';
import { asyncHandler } from '../Middleware/asyncHandler';

export const healthRouter: Router = Router();

healthRouter.get(
  '/health',
  asyncHandler(async (_req: Request, res: Response) => {
    const health = await HealthService.inspect();
    res.status(health.database.reachable ? 200 : 503).json(health);
  }),
);
