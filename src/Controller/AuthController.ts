import { Router, type Request, type Response } from 'express';

import { AuthService } from '../Service/AuthService';
import { asyncHandler } from '../Middleware/asyncHandler';
import { Validator } from '../Middleware/validation';

export const authRouter: Router = Router();

authRouter.post(
  '/auth/login',
  asyncHandler(async (req: Request, res: Response) => {
    const validator = new Validator(req.body, 'Identifiants invalides');

    const email = validator.email('email');
    const password = validator.string('password', { min: 1, max: 200 });

    validator.throwIfInvalid();

    const { token, user } = await AuthService.login(email, password);

    res.status(200).json({ token, user });
  }),
);
