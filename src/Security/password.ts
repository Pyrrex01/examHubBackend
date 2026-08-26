import bcrypt from 'bcrypt';

import { env } from '../Config/env';


const DUMMY_HASH = bcrypt.hashSync(
  'hachage-de-reference-jamais-egal-a-un-mot-de-passe-reel',
  env.auth.bcryptSaltRounds,
);

export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, env.auth.bcryptSaltRounds);
}

export async function verifyPassword(
  plainPassword: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(plainPassword, passwordHash);
}

export async function consumeVerificationTime(plainPassword: string): Promise<void> {
  await bcrypt.compare(plainPassword, DUMMY_HASH);
}
