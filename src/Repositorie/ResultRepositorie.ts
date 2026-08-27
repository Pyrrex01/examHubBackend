import { query, queryOne } from '../Database/pool';
import type { ExamResultRow, ExamResultStats, StudentResultSummary } from '../Model/Result';


function round1(value: number | null): number | null {
  return value === null ? null : Math.round(value * 10) / 10;
}


interface ExamResultRowRaw {
  student_id: number;
  full_name: string;
  email: string;
  is_active: boolean;
  attempt_id: number | null;
  score: number | null;
  max_score: number | null;
  submitted_at: Date | null;
}

export const ResultRepositorie = {
  async findExamResults(examId: number): Promise<ExamResultRow[]> {
    const rows = await query<ExamResultRowRaw>(
      `SELECT u.id AS student_id, u.full_name, u.email, u.is_active,
              a.id AS attempt_id, a.score, a.max_score, a.submitted_at
         FROM users u
         LEFT JOIN attempts a ON a.student_id = u.id AND a.exam_id = $1
        WHERE u.role = 'STUDENT'
          AND (u.is_active OR a.id IS NOT NULL)
        ORDER BY a.score DESC NULLS LAST, u.full_name, u.id`,
      [examId],
    );

    return rows.map((row) => ({
      studentId: row.student_id,
      fullName: row.full_name,
      email: row.email,
      isActive: row.is_active,
      hasAttempted: row.attempt_id !== null,
      attemptId: row.attempt_id,
      score: row.score,
      maxScore: row.max_score,
      percentage:
        row.score !== null && row.max_score !== null && row.max_score > 0
          ? round1((row.score / row.max_score) * 100)
          : row.score !== null
            ? 0
            : null,
      submittedAt: row.submitted_at ? row.submitted_at.toISOString() : null,
    }));
  },

  async findExamStats(examId: number): Promise<ExamResultStats> {
    const row = await queryOne<{
      attempt_count: string;
      student_count: string;
      average: string | null;
      lowest: number | null;
      highest: number | null;
      max_score: string;
    }>(
      `SELECT
         (SELECT count(*) FROM attempts a WHERE a.exam_id = $1) AS attempt_count,
         (SELECT count(*) FROM users u
           WHERE u.role = 'STUDENT'
             AND (u.is_active
                  OR EXISTS (SELECT 1 FROM attempts a
                              WHERE a.student_id = u.id AND a.exam_id = $1))
         ) AS student_count,
         (SELECT avg(a.score) FROM attempts a WHERE a.exam_id = $1) AS average,
         (SELECT min(a.score) FROM attempts a WHERE a.exam_id = $1) AS lowest,
         (SELECT max(a.score) FROM attempts a WHERE a.exam_id = $1) AS highest,
         (SELECT COALESCE(sum(q.points), 0) FROM questions q WHERE q.exam_id = $1) AS max_score`,
      [examId],
    );

    const maxScore = Number(row?.max_score ?? 0);
    const average = row?.average === null || row?.average === undefined ? null : Number(row.average);

    return {
      attemptCount: Number(row?.attempt_count ?? 0),
      studentCount: Number(row?.student_count ?? 0),
      average: round1(average),
      averagePercentage:
        average !== null && maxScore > 0 ? round1((average / maxScore) * 100) : null,
      lowest: row?.lowest ?? null,
      highest: row?.highest ?? null,
      maxScore,
    };
  },


  async findStudentResults(studentId: number, examId?: number): Promise<StudentResultSummary[]> {
    const rows = await query<{
      attempt_id: number;
      exam_id: number;
      exam_title: string;
      course_code: string;
      course_name: string;
      score: number;
      max_score: number;
      submitted_at: Date;
    }>(
      `SELECT a.id AS attempt_id, e.id AS exam_id, e.title AS exam_title,
              c.code AS course_code, c.name AS course_name,
              a.score, a.max_score, a.submitted_at
         FROM attempts a
         JOIN exams   e ON e.id = a.exam_id
         JOIN courses c ON c.id = e.course_id
        WHERE a.student_id = $1
          AND ($2::integer IS NULL OR a.exam_id = $2::integer)
        ORDER BY a.submitted_at DESC`,
      [studentId, examId ?? null],
    );

    return rows.map((row) => ({
      attemptId: row.attempt_id,
      examId: row.exam_id,
      examTitle: row.exam_title,
      courseCode: row.course_code,
      courseName: row.course_name,
      score: row.score,
      maxScore: row.max_score,
      percentage: row.max_score > 0 ? round1((row.score / row.max_score) * 100)! : 0,
      submittedAt: row.submitted_at.toISOString(),
    }));
  },
};
