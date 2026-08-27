import type { NextFunction, Request, Response } from 'express';

import { isProduction } from '../Config/env';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const line = `${req.method} ${req.originalUrl} → ${res.statusCode} (${durationMs.toFixed(1)} ms)`;

    if (res.statusCode >= 500) {
      console.error(`[http] ${line}`);
    } else if (res.statusCode >= 400 || !isProduction) {
      console.log(`[http] ${line}`);
    }
  });

  next();
}
