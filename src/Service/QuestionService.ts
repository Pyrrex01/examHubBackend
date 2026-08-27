import { QuestionRepositorie, type QuestionData } from '../Repositorie/QuestionRepositorie';
import { ExamRepositorie } from '../Repositorie/ExamRepositorie';
import { HttpError } from '../Middleware/HttpError';
import { MAX_CHOICES, MIN_CHOICES, type ExamQuestions, type Question } from '../Model/Question';


export interface QuestionInput {
  statement: string;
  points: number;
  choices: Array<{ label: string; isCorrect: boolean }>;
}

function assertChoicesValid(choices: QuestionInput['choices']): void {
  if (choices.length < MIN_CHOICES || choices.length > MAX_CHOICES) {
    throw HttpError.badRequest(
      `Une question doit comporter entre ${MIN_CHOICES} et ${MAX_CHOICES} choix ` +
        `(${choices.length} fourni${choices.length > 1 ? 's' : ''}).`,
    );
  }

  const correctCount = choices.filter((choice) => choice.isCorrect).length;

  if (correctCount === 0) {
    throw HttpError.badRequest(
      'Une question doit comporter exactement un choix correct : aucun n’a été marqué comme tel.',
    );
  }

  if (correctCount > 1) {
    throw HttpError.badRequest(
      `Une question doit comporter exactement un choix correct (${correctCount} ont été marqués comme corrects).`,
    );
  }

  const labels = choices.map((choice) => choice.label.trim().toLowerCase());
  if (new Set(labels).size !== labels.length) {
    throw HttpError.badRequest('Deux choix d’une même question ne peuvent pas être identiques.');
  }
}

async function assertExamNotStarted(examId: number): Promise<void> {
  const attemptCount = await ExamRepositorie.countAttempts(examId);

  if (attemptCount > 0) {
    throw HttpError.conflict(
      `Cet examen a déjà été passé (${attemptCount} tentative(s)) : ses questions et ses choix ne sont ` +
        'plus modifiables ni supprimables, afin de ne pas fausser les notes déjà attribuées.',
    );
  }
}

async function requireQuestionById(id: number): Promise<Question> {
  const question = await QuestionRepositorie.findById(id);

  if (!question) {
    throw HttpError.notFound("Cette question n'existe pas.");
  }

  return question;
}

export const QuestionService = {
  async listByExam(examId: number): Promise<ExamQuestions> {
    const exam = await ExamRepositorie.findById(examId);

    if (!exam) {
      throw HttpError.notFound("Cet examen n'existe pas.");
    }

    const questions = await QuestionRepositorie.findByExamId(examId);

    return {
      examId: exam.id,
      examTitle: exam.title,
      locked: exam.attemptCount > 0,
      attemptCount: exam.attemptCount,
      totalPoints: exam.totalPoints,
      questions,
    };
  },

  async getById(id: number): Promise<Question> {
    return requireQuestionById(id);
  },

  async create(examId: number, input: QuestionInput): Promise<Question> {
    const exam = await ExamRepositorie.findById(examId);

    if (!exam) {
      throw HttpError.notFound("Cet examen n'existe pas.");
    }

    await assertExamNotStarted(examId);
    assertChoicesValid(input.choices);

    return QuestionRepositorie.create(examId, normalize(input));
  },

  async replace(id: number, input: QuestionInput): Promise<Question> {
    const existing = await requireQuestionById(id);

    await assertExamNotStarted(existing.examId);
    assertChoicesValid(input.choices);

    const updated = await QuestionRepositorie.replace(id, normalize(input));

    if (!updated) {
      throw HttpError.notFound("Cette question n'existe pas.");
    }

    return updated;
  },

  async remove(id: number): Promise<Question> {
    const question = await requireQuestionById(id);

    await assertExamNotStarted(question.examId);

    const removed = await QuestionRepositorie.remove(id);

    if (!removed) {
      throw HttpError.notFound("Cette question n'existe pas.");
    }

    return question;
  },
};

function normalize(input: QuestionInput): QuestionData {
  return {
    statement: input.statement.trim(),
    points: input.points,
    choices: input.choices.map((choice) => ({
      label: choice.label.trim(),
      isCorrect: choice.isCorrect,
    })),
  };
}
