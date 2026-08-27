import { Router, type Request, type Response } from 'express';

import { ExamService } from '../Service/ExamService';
import { asyncHandler } from '../Middleware/asyncHandler';
import { Validator, parseResourceId } from '../Middleware/validation';
import { requireAdmin, requireAuth } from '../Security/authentication';

export const examRouter: Router = Router();

examRouter.use('/exams', requireAuth, requireAdmin);

examRouter.get(
  '/exams',
  asyncHandler(async (req: Request, res: Response) => {
    const rawCourseId = req.query.courseId;
    const courseId =
      rawCourseId === undefined
        ? undefined
        : parseResourceId(rawCourseId, 'identifiant de cours');

    const exams = await ExamService.list({ courseId });
    res.status(200).json(exams);
  }),
);

examRouter.get(
  '/exams/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseResourceId(req.params.id, 'identifiant d’examen');

    const exam = await ExamService.getById(id);
    res.status(200).json(exam);
  }),
);

examRouter.post(
  '/exams',
  asyncHandler(async (req: Request, res: Response) => {
    const validator = new Validator(req.body, 'Examen invalide');

    const courseId = validator.integer('courseId', { min: 1 });
    const title = validator.string('title', { min: 3, max: 200 });
    const description = validator.string('description', {
      optional: true,
      min: 0,
      max: 2000,
      default: '',
    });
    const availableFrom = validator.dateTime('availableFrom');
    const availableTo = validator.dateTime('availableTo');

    validator.throwIfInvalid();

    const exam = await ExamService.create({
      courseId,
      title,
      description,
      availableFrom: availableFrom as Date,
      availableTo: availableTo as Date,
    });

    res.status(201).json(exam);
  }),
);

examRouter.put(
  '/exams/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseResourceId(req.params.id, 'identifiant d’examen');

    const validator = new Validator(req.body, 'Modification invalide');
    const body = (req.body ?? {}) as Record<string, unknown>;

    const courseId =
      body.courseId === undefined ? undefined : validator.integer('courseId', { min: 1 });
    const title =
      body.title === undefined ? undefined : validator.string('title', { min: 3, max: 200 });
    const description =
      body.description === undefined
        ? undefined
        : validator.string('description', { min: 0, max: 2000, optional: true, default: '' });
    const availableFrom =
      body.availableFrom === undefined ? undefined : validator.dateTime('availableFrom');
    const availableTo =
      body.availableTo === undefined ? undefined : validator.dateTime('availableTo');

    if (
      courseId === undefined &&
      title === undefined &&
      description === undefined &&
      availableFrom === undefined &&
      availableTo === undefined
    ) {
      validator.reject(
        'la requête',
        'doit contenir au moins un champ à modifier (courseId, title, description, availableFrom, availableTo)',
      );
    }

    validator.throwIfInvalid();

    const exam = await ExamService.update(id, {
      courseId,
      title,
      description,
      availableFrom: availableFrom ?? undefined,
      availableTo: availableTo ?? undefined,
    });

    res.status(200).json(exam);
  }),
);

examRouter.delete(
  '/exams/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseResourceId(req.params.id, 'identifiant d’examen');

    const exam = await ExamService.remove(id);

    res.status(200).json({
      message:
        exam.questionCount > 0
          ? `Examen « ${exam.title} » supprimé, ainsi que ses ${exam.questionCount} question(s).`
          : `Examen « ${exam.title} » supprimé.`,
      exam,
    });
  }),
);
