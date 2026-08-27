import { UserRepositorie } from '../Repositorie/UserRepositorie';
import { HttpError } from '../Middleware/HttpError';
import { issueToken } from '../Security/jwt';
import { consumeVerificationTime, verifyPassword } from '../Security/password';
import { toPublicUser, type AuthenticatedUser, type PublicUser, type TokenPayload } from '../Model/User';


export interface LoginResult {
  token: string;
  user: PublicUser;
}

const INVALID_CREDENTIALS = 'Email ou mot de passe incorrect.';

const ACCOUNT_DISABLED =
  'Ce compte a été désactivé. Rapprochez-vous de l’administration pour le réactiver.';

export const AuthService = {
  async login(email: string, password: string): Promise<LoginResult> {
    const user = await UserRepositorie.findByEmail(email);

    if (!user) {
      await consumeVerificationTime(password);
      throw HttpError.unauthorized(INVALID_CREDENTIALS);
    }

    const passwordMatches = await verifyPassword(password, user.passwordHash);

    if (!passwordMatches) {
      throw HttpError.unauthorized(INVALID_CREDENTIALS);
    }

    if (!user.isActive) {
      throw HttpError.forbidden(ACCOUNT_DISABLED);
    }

    return {
      token: issueToken(user.id, user.role),
      user: toPublicUser(user),
    };
  },

  async resolveAuthenticatedUser(payload: TokenPayload): Promise<AuthenticatedUser> {
    const user = await UserRepositorie.findById(payload.sub);

    if (!user) {
      throw HttpError.unauthorized('Ce compte n’existe plus.');
    }

    if (!user.isActive) {
      throw HttpError.forbidden(ACCOUNT_DISABLED);
    }

    if (user.role !== payload.role) {
      throw HttpError.unauthorized(
        'Vos droits ont changé, veuillez vous reconnecter.',
      );
    }

    return {
      id: user.id,
      role: user.role,
      email: user.email,
      fullName: user.fullName,
    };
  },
};
