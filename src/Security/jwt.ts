import jwt, { type SignOptions } from 'jsonwebtoken';

import { env } from '../Config/env';
import { HttpError } from '../Middleware/HttpError';
import { USER_ROLES, type TokenPayload, type UserRole } from '../Model/User';


const ISSUER = 'exam-hub';

export function issueToken(userId: number, role: UserRole): string {
  const payload: TokenPayload = { sub: userId, role };

  const options: SignOptions = {
    algorithm: 'HS256',
    issuer: ISSUER,
    expiresIn: env.auth.jwtExpiresIn as SignOptions['expiresIn'],
  };

  return jwt.sign(payload, env.auth.jwtSecret, options);
}

export function verifyToken(token: string): TokenPayload {
  let decoded: unknown;

  try {
    decoded = jwt.verify(token, env.auth.jwtSecret, {
      algorithms: ['HS256'],
      issuer: ISSUER,
    });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw HttpError.unauthorized('Votre session a expiré, veuillez vous reconnecter.');
    }
    throw HttpError.unauthorized("Jeton d'authentification invalide.");
  }

  if (typeof decoded !== 'object' || decoded === null) {
    throw HttpError.unauthorized("Jeton d'authentification invalide.");
  }

  const { sub, role } = decoded as Record<string, unknown>;

  if (typeof sub !== 'number' || !Number.isInteger(sub) || sub < 1) {
    throw HttpError.unauthorized("Jeton d'authentification invalide.");
  }

  if (typeof role !== 'string' || !USER_ROLES.includes(role as UserRole)) {
    throw HttpError.unauthorized("Jeton d'authentification invalide.");
  }

  return { sub, role: role as UserRole };
}

export function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;

  const [scheme, ...rest] = header.trim().split(/\s+/);

  if (scheme?.toLowerCase() !== 'bearer' || rest.length !== 1) {
    return null;
  }

  const token = rest[0];
  return token && token.length > 0 ? token : null;
}
