import { Router, type Request, type Response } from 'express';

import { QuestionService, type QuestionInput } from '../Service/QuestionService';
import { asyncHandler } from '../Middleware/asyncHandler';
import { Validator, parseResourceId } from '../Middleware/validation';
import { requireAdmin, requireAuth } from '../Security/authentication';
import { MAX_CHOICES, MIN_CHOICES } from '../Model/Question';

export const questionRouter: Router = Router();

questionRouter.use('/exams/:examId/questions', requireAuth, requireAdmin);
questionRouter.use('/questions', requireAuth, requireAdmin);

function readQuestionInput(body: unknown): QuestionInput {
  const validator = new Validator(body, 'Question invalide');

  const statement = validator.string('statement', { min: 3, max: 2000 });
  const points = validator.integer('points', { min: 1, max: 100, optional: true, default: 1 });
  const rawChoices = validator.array('choices', { min: MIN_CHOICES, max: MAX_CHOICES });

  const choices: Array<{ label: string; isCorrect: boolean }> = [];

  rawChoices.forEach((raw, index) => {
    const position = index + 1;

    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      validator.reject(`le choix n°${position}`, 'doit être un objet { label, isCorrect }');
      return;
    }

    const entry = raw as Record<string, unknown>;

    const label = entry.label;
    if (typeof label !== 'string' || label.trim().length === 0) {
      validator.reject(`le choix n°${position}`, 'doit comporter un intitulé non vide');
      return;
    }
    if (label.trim().length > 500) {
      validator.reject(`le choix n°${position}`, 'ne doit pas dépasser 500 caractères');
      return;
    }

    const isCorrect = entry.isCorrect;
    if (isCorrect !== undefined && typeof isCorrect !== 'boolean') {
      validator.reject(`le choix n°${position}`, 'a un champ isCorrect qui doit être un booléen');
      return;
    }

    choices.push({ label: label.trim(), isCorrect: isCorrect === true });
  });

  validator.throwIfInvalid();

  return { statement, points, choices };
}

questionRouter.get(
  '/exams/:examId/questions',
  asyncHandler(async (req: Request, res: Response) => {
    const examId = parseResourceId(req.params.examId, 'identifiant d’examen');

    const sujet = await QuestionService.listByExam(examId);
    res.status(200).json(sujet);
  }),
);

questionRouter.post(
  '/exams/:examId/questions',
  asyncHandler(async (req: Request, res: Response) => {
    const examId = parseResourceId(req.params.examId, 'identifiant d’examen');

    const input = readQuestionInput(req.body);
    const question = await QuestionService.create(examId, input);

    res.status(201).json(question);
  }),
);

questionRouter.put(
  '/questions/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseResourceId(req.params.id, 'identifiant de question');

    const input = readQuestionInput(req.body);
    const question = await QuestionService.replace(id, input);

    res.status(200).json(question);
  }),
);

questionRouter.delete(
  '/questions/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseResourceId(req.params.id, 'identifiant de question');

    const question = await QuestionService.remove(id);

    res.status(200).json({
      message: `Question n°${question.position} supprimée.`,
      question,
    });
  }),
);
