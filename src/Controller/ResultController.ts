import { Router, type Request, type Response } from 'express';

import { ResultService } from '../Service/ResultService';
import { asyncHandler } from '../Middleware/asyncHandler';
import { parseResourceId } from '../Middleware/validation';
import {
  currentUser,
  requireAdmin,
  requireAuth,
  requireStudent,
} from '../Security/authentication';

export const resultRouter: Router = Router();

resultRouter.use('/exams/:examId/results', requireAuth, requireAdmin);
resultRouter.use('/my/results', requireAuth, requireStudent);

resultRouter.get(
  '/exams/:examId/results',
  asyncHandler(async (req: Request, res: Response) => {
    const examId = parseResourceId(req.params.examId, 'identifiant d’examen');

    const results = await ResultService.getExamResults(examId);
    res.status(200).json(results);
  }),
);

resultRouter.get(
  '/my/results',
  asyncHandler(async (req: Request, res: Response) => {
    const student = currentUser(req);

    const rawExamId = req.query.examId;

    if (rawExamId === undefined) {
      const results = await ResultService.getMyResults(student.id);
      res.status(200).json(results);
      return;
    }

    const examId = parseResourceId(rawExamId, 'identifiant d’examen');
    const detailed = await ResultService.getMyResultForExam(student.id, examId);

    res.status(200).json(detailed ? [detailed] : []);
  }),
);
