import { Router, type Request, type Response } from 'express';

import { StudentService } from '../Service/StudentService';
import { asyncHandler } from '../Middleware/asyncHandler';
import { Validator, parseResourceId } from '../Middleware/validation';
import { requireAdmin, requireAuth } from '../Security/authentication';
import { HttpError } from '../Middleware/HttpError';

export const studentRouter: Router = Router();

studentRouter.use('/students', requireAuth, requireAdmin);

studentRouter.get(
  '/students',
  asyncHandler(async (req: Request, res: Response) => {
    const active = req.query.active;
    let isActive: boolean | undefined;

    if (active !== undefined) {
      if (active !== 'true' && active !== 'false') {
        throw HttpError.badRequest(
          'Le paramètre « active » doit valoir true ou false.',
        );
      }
      isActive = active === 'true';
    }

    const students = await StudentService.list({ isActive });
    res.status(200).json(students);
  }),
);

studentRouter.post(
  '/students',
  asyncHandler(async (req: Request, res: Response) => {
    const validator = new Validator(req.body, 'Étudiant invalide');

    const fullName = validator.string('fullName', { min: 2, max: 120 });
    const email = validator.email('email');
    const password = validator.password('password', { min: 8 });

    validator.throwIfInvalid();

    const student = await StudentService.create({ fullName, email, password });

    res.status(201).json(student);
  }),
);

studentRouter.put(
  '/students/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseResourceId(req.params.id, 'identifiant d’étudiant');

    const validator = new Validator(req.body, 'Modification invalide');
    const body = (req.body ?? {}) as Record<string, unknown>;

    const fullName =
      body.fullName === undefined ? undefined : validator.string('fullName', { min: 2, max: 120 });
    const email = body.email === undefined ? undefined : validator.email('email');
    const password =
      body.password === undefined ? undefined : validator.password('password', { min: 8 });
    const isActive =
      body.isActive === undefined ? undefined : validator.boolean('isActive');

    if (
      fullName === undefined &&
      email === undefined &&
      password === undefined &&
      isActive === undefined
    ) {
      validator.reject(
        'la requête',
        'doit contenir au moins un champ à modifier (fullName, email, password, isActive)',
      );
    }

    validator.throwIfInvalid();

    const student = await StudentService.update(id, { fullName, email, password, isActive });

    res.status(200).json(student);
  }),
);

studentRouter.delete(
  '/students/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseResourceId(req.params.id, 'identifiant d’étudiant');

    const student = await StudentService.deactivate(id);

    res.status(200).json({
      message: 'Étudiant désactivé. Ses résultats restent consultables.',
      student,
    });
  }),
);
