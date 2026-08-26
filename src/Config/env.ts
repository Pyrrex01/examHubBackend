import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function requireEnv(key: string): string {
  const value = process.env[key];
  if (value === undefined || value.trim() === '') {
    throw new Error(
      `Variable d'environnement manquante : ${key}. ` +
        'Copiez `.env.example` vers `.env` et renseignez cette valeur.',
    );
  }
  return value.trim();
}

function optionalEnv(key: string, fallback: string): string {
  const value = process.env[key];
  return value === undefined || value.trim() === '' ? fallback : value.trim();
}

function optionalNumberEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return fallback;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(
      `Variable d'environnement invalide : ${key} doit être un entier positif (reçu « ${raw} »).`,
    );
  }
  return parsed;
}

function readJwtSecret(): string {
  const secret = requireEnv('JWT_SECRET');
  const weak = secret === 'change_me' || secret.length < 32;

  if (weak) {
    const message =
      'JWT_SECRET est trop faible : utilisez une chaîne aléatoire d’au moins 32 caractères. ' +
      'Génération : node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"';

    if (process.env.NODE_ENV === 'production') {
      throw new Error(message);
    }
    console.warn(`[config] ${message}`);
  }

  return secret;
}

export type NodeEnvironment = 'development' | 'production' | 'test';

function readNodeEnv(): NodeEnvironment {
  const value = optionalEnv('NODE_ENV', 'development');
  if (value !== 'development' && value !== 'production' && value !== 'test') {
    throw new Error(
      `Variable d'environnement invalide : NODE_ENV doit valoir development, production ou test (reçu « ${value} »).`,
    );
  }
  return value;
}

export const env = {
  nodeEnv: readNodeEnv(),
  port: optionalNumberEnv('PORT', 3000),
  corsOrigin: optionalEnv('CORS_ORIGIN', 'http://localhost:5173'),

  database: {
    host: requireEnv('DB_HOST'),
    port: optionalNumberEnv('DB_PORT', 5432),
    name: requireEnv('DB_NAME'),
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
  },

  auth: {
    jwtSecret: readJwtSecret(),
    jwtExpiresIn: optionalEnv('JWT_EXPIRES_IN', '12h'),
    bcryptSaltRounds: optionalNumberEnv('BCRYPT_SALT_ROUNDS', 10),
  },
} as const;

export const isProduction = env.nodeEnv === 'production';

export { requireEnv, optionalEnv, optionalNumberEnv };
