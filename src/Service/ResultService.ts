import { ResultRepositorie } from '../Repositorie/ResultRepositorie';
import { ExamRepositorie } from '../Repositorie/ExamRepositorie';
import { AttemptRepositorie } from '../Repositorie/AttemptRepositorie';
import { QuestionRepositorie } from '../Repositorie/QuestionRepositorie';
import { HttpError } from '../Middleware/HttpError';
import type { ExamResults, StudentResultSummary } from '../Model/Result';
import type { CorrectedQuestion } from '../Model/Attempt';
import type { Question } from '../Model/Question';


export const ResultService = {
  async getExamResults(examId: number): Promise<ExamResults> {
    const exam = await ExamRepositorie.findById(examId);

    if (!exam) {
      throw HttpError.notFound("Cet examen n'existe pas.");
    }

    const [stats, results] = await Promise.all([
      ResultRepositorie.findExamStats(examId),
      ResultRepositorie.findExamResults(examId),
    ]);

    return {
      examId: exam.id,
      examTitle: exam.title,
      courseCode: exam.courseCode,
      courseName: exam.courseName,
      stats,
      results,
    };
  },

  async getMyResults(studentId: number, examId?: number): Promise<StudentResultSummary[]> {
    return ResultRepositorie.findStudentResults(studentId, examId);
  },

  async getMyResultForExam(
    studentId: number,
    examId: number,
  ): Promise<StudentResultSummary | null> {
    const [summary] = await ResultRepositorie.findStudentResults(studentId, examId);

    if (!summary) {
      return null;
    }

    const questions = await QuestionRepositorie.findByExamId(examId);
    const selections = await AttemptRepositorie.findAnswers(summary.attemptId);

    return {
      ...summary,
      questions: questions.map((question) => correct(question, selections)),
    };
  },
};

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
