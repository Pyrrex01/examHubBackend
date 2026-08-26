import type { NextFunction, Request, Response } from 'express';

import { AuthService } from '../Service/AuthService';
import { HttpError } from '../Middleware/HttpError';
import { asyncHandler } from '../Middleware/asyncHandler';
import { extractBearerToken, verifyToken } from './jwt';
import type { AuthenticatedUser, UserRole } from '../Model/User';


declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const requireAuth = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    if (req.user) {
      next();
      return;
    }

    const token = extractBearerToken(req.header('authorization'));

    if (!token) {
      throw HttpError.unauthorized(
        "Authentification requise : fournissez un jeton via l'en-tête Authorization: Bearer.",
      );
    }

    const payload = verifyToken(token);
    req.user = await AuthService.resolveAuthenticatedUser(payload);

    next();
  },
);

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(
        new HttpError(
          500,
          'Configuration incorrecte : requireRole doit être placé après requireAuth.',
        ),
      );
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(
        HttpError.forbidden(
          "Vous n'avez pas les droits nécessaires pour accéder à cette ressource.",
        ),
      );
      return;
    }

    next();
  };
}

export const requireAdmin = requireRole('ADMIN');
export const requireStudent = requireRole('STUDENT');

export function currentUser(req: Request): AuthenticatedUser {
  if (!req.user) {
    throw new HttpError(500, 'Configuration incorrecte : requireAuth est absent de cette route.');
  }
  return req.user;
}
