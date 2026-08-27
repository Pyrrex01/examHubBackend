import type { NextFunction, Request, Response } from 'express';

import { HttpError } from './HttpError';
import { translatePostgresError } from './postgresErrors';
import { isProduction } from '../Config/env';

function isJsonParseError(error: unknown): boolean {
  return (
    error instanceof SyntaxError &&
    'body' in error &&
    (error as { status?: number }).status === 400
  );
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(HttpError.notFound(`Route introuvable : ${req.method} ${req.originalUrl}`));
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.status).json({ message: error.message });
    return;
  }

  if (isJsonParseError(error)) {
    res.status(400).json({ message: 'Le corps de la requête n’est pas un JSON valide.' });
    return;
  }

  const translated = translatePostgresError(error);
  if (translated) {
    console.warn(
      `[contrainte] ${req.method} ${req.originalUrl} →`,
      error instanceof Error ? error.message : error,
    );
    res.status(translated.status).json({ message: translated.message });
    return;
  }

  console.error(`[erreur non gérée] ${req.method} ${req.originalUrl}`, error);

  const message =
    !isProduction && error instanceof Error
      ? error.message
      : 'Une erreur interne est survenue.';

  res.status(500).json({ message });
}
