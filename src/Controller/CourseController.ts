import { Router, type Request, type Response } from 'express';

import { CourseService } from '../Service/CourseService';
import { asyncHandler } from '../Middleware/asyncHandler';
import { Validator, parseResourceId } from '../Middleware/validation';
import { requireAdmin, requireAuth } from '../Security/authentication';
import { COURSE_CODE_PATTERN, COURSE_CODE_RULE } from '../Model/Course';

export const courseRouter: Router = Router();

courseRouter.use('/courses', requireAuth, requireAdmin);

courseRouter.get(
  '/courses',
  asyncHandler(async (_req: Request, res: Response) => {
    const courses = await CourseService.list();
    res.status(200).json(courses);
  }),
);

courseRouter.post(
  '/courses',
  asyncHandler(async (req: Request, res: Response) => {
    const validator = new Validator(req.body, 'Cours invalide');

    const code = validator.string('code', {
      min: 2,
      max: 20,
      pattern: COURSE_CODE_PATTERN,
      patternMessage: COURSE_CODE_RULE,
    });
    const name = validator.string('name', { min: 2, max: 150 });
    const description = validator.string('description', {
      optional: true,
      min: 0,
      max: 2000,
      default: '',
    });

    validator.throwIfInvalid();

    const course = await CourseService.create({ code, name, description });

    res.status(201).json(course);
  }),
);

courseRouter.put(
  '/courses/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseResourceId(req.params.id, 'identifiant de cours');

    const validator = new Validator(req.body, 'Modification invalide');
    const body = (req.body ?? {}) as Record<string, unknown>;

    const code =
      body.code === undefined
        ? undefined
        : validator.string('code', {
            min: 2,
            max: 20,
            pattern: COURSE_CODE_PATTERN,
            patternMessage: COURSE_CODE_RULE,
          });
    const name = body.name === undefined ? undefined : validator.string('name', { min: 2, max: 150 });
    const description =
      body.description === undefined
        ? undefined
        : validator.string('description', { min: 0, max: 2000, optional: true, default: '' });

    if (code === undefined && name === undefined && description === undefined) {
      validator.reject(
        'la requête',
        'doit contenir au moins un champ à modifier (code, name, description)',
      );
    }

    validator.throwIfInvalid();

    const course = await CourseService.update(id, { code, name, description });

    res.status(200).json(course);
  }),
);

courseRouter.delete(
  '/courses/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseResourceId(req.params.id, 'identifiant de cours');

    const course = await CourseService.remove(id);

    res.status(200).json({
      message: `Cours « ${course.code} » supprimé.`,
      course,
    });
  }),
);
