import { query, queryOne, withTransaction } from '../Database/pool';
import type { AttemptRecord, AvailableExam, SubmittedAnswer } from '../Model/Attempt';


interface AvailableExamRow {
  id: number;
  course_code: string;
  course_name: string;
  title: string;
  description: string;
  available_from: Date;
  available_to: Date;
  question_count: string | number;
  total_points: string | number;
}

function toAvailableExam(row: AvailableExamRow): AvailableExam {
  return {
    id: row.id,
    courseCode: row.course_code,
    courseName: row.course_name,
    title: row.title,
    description: row.description,
    availableFrom: row.available_from.toISOString(),
    availableTo: row.available_to.toISOString(),
    questionCount: Number(row.question_count),
    totalPoints: Number(row.total_points),
  };
}

const SELECT_AVAILABLE = `
  SELECT e.id, c.code AS course_code, c.name AS course_name,
         e.title, e.description, e.available_from, e.available_to,
         (SELECT count(*) FROM questions q WHERE q.exam_id = e.id) AS question_count,
         (SELECT COALESCE(sum(q.points), 0) FROM questions q WHERE q.exam_id = e.id) AS total_points
    FROM exams e
    JOIN courses c ON c.id = e.course_id
`;

export type SubmissionRejection =
  | 'EXAM_NOT_FOUND'
  | 'EXAM_HAS_NO_QUESTIONS'
  | 'WINDOW_CLOSED'
  | 'ALREADY_ATTEMPTED'
  | 'INVALID_ANSWER';

export class SubmissionError extends Error {
  constructor(public readonly reason: SubmissionRejection) {
    super(reason);
    this.name = 'SubmissionError';
  }
}

export const AttemptRepositorie = {
  async findAvailableFor(studentId: number): Promise<AvailableExam[]> {
    const rows = await query<AvailableExamRow>(
      `${SELECT_AVAILABLE}
        WHERE now() >= e.available_from
          AND now() <  e.available_to
          AND EXISTS (SELECT 1 FROM questions q WHERE q.exam_id = e.id)
          AND NOT EXISTS (
                SELECT 1 FROM attempts a
                 WHERE a.exam_id = e.id AND a.student_id = $1
              )
        ORDER BY e.available_to, e.id`,
      [studentId],
    );

    return rows.map(toAvailableExam);
  },

  async findExamById(examId: number): Promise<AvailableExam | null> {
    const row = await queryOne<AvailableExamRow>(`${SELECT_AVAILABLE} WHERE e.id = $1`, [examId]);
    return row ? toAvailableExam(row) : null;
  },

  async isWindowOpen(examId: number): Promise<boolean> {
    const row = await queryOne<{ open: boolean }>(
      `SELECT (now() >= available_from AND now() < available_to) AS open
         FROM exams WHERE id = $1`,
      [examId],
    );

    return row?.open ?? false;
  },

  async findAttempt(examId: number, studentId: number): Promise<AttemptRecord | null> {
    const row = await queryOne<{
      id: number;
      exam_id: number;
      student_id: number;
      score: number;
      max_score: number;
      submitted_at: Date;
    }>(
      `SELECT id, exam_id, student_id, score, max_score, submitted_at
         FROM attempts
        WHERE exam_id = $1 AND student_id = $2`,
      [examId, studentId],
    );

    return row
      ? {
          id: row.id,
          examId: row.exam_id,
          studentId: row.student_id,
          score: row.score,
          maxScore: row.max_score,
          submittedAt: row.submitted_at.toISOString(),
        }
      : null;
  },

  async submit(
    examId: number,
    studentId: number,
    answers: readonly SubmittedAnswer[],
  ): Promise<AttemptRecord> {
    return withTransaction(async (client) => {
      const exam = await client.query<{ open: boolean }>(
        `SELECT (now() >= available_from AND now() < available_to) AS open
           FROM exams WHERE id = $1`,
        [examId],
      );

      if (exam.rowCount === 0) throw new SubmissionError('EXAM_NOT_FOUND');
      if (!exam.rows[0]!.open) throw new SubmissionError('WINDOW_CLOSED');

      const existing = await client.query(
        'SELECT 1 FROM attempts WHERE exam_id = $1 AND student_id = $2',
        [examId, studentId],
      );

      if (existing.rowCount && existing.rowCount > 0) {
        throw new SubmissionError('ALREADY_ATTEMPTED');
      }

      const barème = await client.query<{ max_score: string; question_count: string }>(
        `SELECT COALESCE(sum(points), 0) AS max_score, count(*) AS question_count
           FROM questions WHERE exam_id = $1`,
        [examId],
      );
      const maxScore = Number(barème.rows[0]!.max_score);

      if (Number(barème.rows[0]!.question_count) === 0) {
        throw new SubmissionError('EXAM_HAS_NO_QUESTIONS');
      }

      const questionIds = answers.map((answer) => answer.questionId);
      const choiceIds = answers.map((answer) => answer.choiceId);

      const graded = await client.query<{
        question_id: number;
        choice_id: number;
        is_correct: boolean;
        points: number;
      }>(
        `SELECT q.id AS question_id, c.id AS choice_id, c.is_correct, q.points
           FROM unnest($2::int[], $3::int[]) AS submitted(question_id, choice_id)
           JOIN questions q ON q.id = submitted.question_id AND q.exam_id = $1
           JOIN choices   c ON c.id = submitted.choice_id  AND c.question_id = q.id`,
        [examId, questionIds, choiceIds],
      );

      if (graded.rowCount !== answers.length) {
        throw new SubmissionError('INVALID_ANSWER');
      }

      const score = graded.rows.reduce(
        (total, row) => total + (row.is_correct ? row.points : 0),
        0,
      );

      let attempt;
      try {
        attempt = await client.query<{ id: number; submitted_at: Date }>(
          `INSERT INTO attempts (exam_id, student_id, score, max_score)
           VALUES ($1, $2, $3, $4)
           RETURNING id, submitted_at`,
          [examId, studentId, score, maxScore],
        );
      } catch (error) {
        if (
          error instanceof Error &&
          (error as { constraint?: string }).constraint === 'attempts_one_per_student_and_exam'
        ) {
          throw new SubmissionError('ALREADY_ATTEMPTED');
        }
        throw error;
      }

      const attemptId = attempt.rows[0]!.id;

      if (graded.rowCount > 0) {
        await client.query(
          `INSERT INTO answers (attempt_id, exam_id, question_id, choice_id, is_correct)
           SELECT $1, $2, submitted.question_id, submitted.choice_id, submitted.is_correct
             FROM unnest($3::int[], $4::int[], $5::boolean[])
                    AS submitted(question_id, choice_id, is_correct)`,
          [
            attemptId,
            examId,
            graded.rows.map((row) => row.question_id),
            graded.rows.map((row) => row.choice_id),
            graded.rows.map((row) => row.is_correct),
          ],
        );
      }

      return {
        id: attemptId,
        examId,
        studentId,
        score,
        maxScore,
        submittedAt: attempt.rows[0]!.submitted_at.toISOString(),
      };
    });
  },

  async findAnswers(attemptId: number): Promise<Map<number, number>> {
    const rows = await query<{ question_id: number; choice_id: number }>(
      'SELECT question_id, choice_id FROM answers WHERE attempt_id = $1',
      [attemptId],
    );

    return new Map(rows.map((row) => [row.question_id, row.choice_id]));
  },
};
