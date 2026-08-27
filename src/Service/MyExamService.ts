import { AttemptRepositorie, SubmissionError } from '../Repositorie/AttemptRepositorie';
import { QuestionRepositorie } from '../Repositorie/QuestionRepositorie';
import { HttpError } from '../Middleware/HttpError';
import { toQuestionForStudent, type Question } from '../Model/Question';
import type {
  AttemptResult,
  AvailableExam,
  CorrectedQuestion,
  ExamPaper,
  SubmittedAnswer,
} from '../Model/Attempt';


const NOT_AVAILABLE =
  "Cet examen n'est pas disponible : il n'existe pas, sa période est close, ou vous l'avez déjà passé.";

export const MyExamService = {
  async listAvailable(studentId: number): Promise<AvailableExam[]> {
    return AttemptRepositorie.findAvailableFor(studentId);
  },

  async getPaper(studentId: number, examId: number): Promise<ExamPaper> {
    const exam = await AttemptRepositorie.findExamById(examId);

    if (!exam) {
      throw HttpError.notFound(NOT_AVAILABLE);
    }

    const attempt = await AttemptRepositorie.findAttempt(examId, studentId);

    if (attempt) {
      throw HttpError.conflict(
        'Vous avez déjà passé cet examen. Une seule tentative est autorisée ; ' +
          'consultez vos résultats pour revoir votre copie.',
      );
    }

    if (!(await AttemptRepositorie.isWindowOpen(examId))) {
      throw HttpError.notFound(NOT_AVAILABLE);
    }

    const questions = await QuestionRepositorie.findByExamId(examId);

    if (questions.length === 0) {
      throw HttpError.notFound(NOT_AVAILABLE);
    }

    return {
      exam,
      questions: questions.map(toQuestionForStudent),
    };
  },

  async submit(
    studentId: number,
    examId: number,
    answers: readonly SubmittedAnswer[],
  ): Promise<AttemptResult> {
    const questionIds = answers.map((answer) => answer.questionId);
    if (new Set(questionIds).size !== questionIds.length) {
      throw HttpError.badRequest(
        'Une seule réponse par question est autorisée : la copie en contient plusieurs pour la même question.',
      );
    }

    let attempt;

    try {
      attempt = await AttemptRepositorie.submit(examId, studentId, answers);
    } catch (error) {
      if (error instanceof SubmissionError) {
        throw translate(error);
      }
      throw error;
    }

    return this.buildResult(examId, attempt.id, attempt.score, attempt.maxScore, attempt.submittedAt);
  },

  async buildResult(
    examId: number,
    attemptId: number,
    score: number,
    maxScore: number,
    submittedAt: string,
  ): Promise<AttemptResult> {
    const exam = await AttemptRepositorie.findExamById(examId);

    if (!exam) {
      throw HttpError.notFound("Cet examen n'existe pas.");
    }

    const questions = await QuestionRepositorie.findByExamId(examId);
    const selections = await AttemptRepositorie.findAnswers(attemptId);

    const corrected = questions.map((question) => correct(question, selections));

    return {
      attemptId,
      examId,
      examTitle: exam.title,
      courseCode: exam.courseCode,
      score,
      maxScore,
      unansweredCount: corrected.filter((question) => question.selectedChoiceId === null).length,
      submittedAt,
      questions: corrected,
    };
  },
};

function translate(error: SubmissionError): HttpError {
  switch (error.reason) {
    case 'EXAM_NOT_FOUND':
      return HttpError.notFound(NOT_AVAILABLE);

    case 'EXAM_HAS_NO_QUESTIONS':
      return HttpError.conflict(
        "Cet examen ne comporte aucune question : il n'est pas encore prêt à être passé.",
      );

    case 'WINDOW_CLOSED':
      return HttpError.forbidden(
        "La période de disponibilité de cet examen est close : votre copie n'a pas été enregistrée.",
      );

    case 'ALREADY_ATTEMPTED':
      return HttpError.conflict(
        'Vous avez déjà passé cet examen. Une seule tentative est autorisée.',
      );

    case 'INVALID_ANSWER':
      return HttpError.badRequest(
        'Copie invalide : une réponse désigne un choix qui n’appartient pas à sa question, ' +
          'ou une question qui n’appartient pas à cet examen.',
      );
  }
}

function correct(question: Question, selections: Map<number, number>): CorrectedQuestion {
  const selectedChoiceId = selections.get(question.id) ?? null;
  const correctChoice = question.choices.find((choice) => choice.isCorrect);
  const answeredCorrectly = selectedChoiceId !== null && selectedChoiceId === correctChoice?.id;

  return {
    id: question.id,
    statement: question.statement,
    points: question.points,
    position: question.position,
    choices: question.choices.map((choice) => ({
      id: choice.id,
      label: choice.label,
      position: choice.position,
      isCorrect: choice.isCorrect,
      selected: choice.id === selectedChoiceId,
    })),
    selectedChoiceId,
    correctChoiceId: correctChoice?.id ?? 0,
    answeredCorrectly,
    pointsEarned: answeredCorrectly ? question.points : 0,
  };
}
