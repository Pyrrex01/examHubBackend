import { Router, type Request, type Response } from 'express';

import { MyExamService } from '../Service/MyExamService';
import { asyncHandler } from '../Middleware/asyncHandler';
import { Validator, parseResourceId } from '../Middleware/validation';
import { currentUser, requireAuth, requireStudent } from '../Security/authentication';
import type { SubmittedAnswer } from '../Model/Attempt';

export const myExamRouter: Router = Router();

myExamRouter.use('/my', requireAuth, requireStudent);

myExamRouter.get(
  '/my/exams',
  asyncHandler(async (req: Request, res: Response) => {
    const student = currentUser(req);

    const exams = await MyExamService.listAvailable(student.id);
    res.status(200).json(exams);
  }),
);

myExamRouter.get(
  '/my/exams/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const student = currentUser(req);
    const examId = parseResourceId(req.params.id, 'identifiant d’examen');

    const paper = await MyExamService.getPaper(student.id, examId);
    res.status(200).json(paper);
  }),
);

myExamRouter.post(
  '/my/exams/:id/submit',
  asyncHandler(async (req: Request, res: Response) => {
    const student = currentUser(req);
    const examId = parseResourceId(req.params.id, 'identifiant d’examen');

    const answers = readAnswers(req.body);

    const result = await MyExamService.submit(student.id, examId, answers);

    res.status(201).json(result);
  }),
);

function readAnswers(body: unknown): SubmittedAnswer[] {
  const validator = new Validator(body, 'Copie invalide');

  const raw = validator.array('answers', { min: 0, max: 200 });
  const answers: SubmittedAnswer[] = [];

  raw.forEach((entry, index) => {
    const position = index + 1;

    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      validator.reject(`la réponse n°${position}`, 'doit être un objet { questionId, choiceId }');
      return;
    }

    const { questionId, choiceId } = entry as Record<string, unknown>;

    if (typeof questionId !== 'number' || !Number.isInteger(questionId) || questionId < 1) {
      validator.reject(`la réponse n°${position}`, 'a un questionId invalide');
      return;
    }

    if (typeof choiceId !== 'number' || !Number.isInteger(choiceId) || choiceId < 1) {
      validator.reject(`la réponse n°${position}`, 'a un choiceId invalide');
      return;
    }

    answers.push({ questionId, choiceId });
  });

  validator.throwIfInvalid();

  return answers;
}
