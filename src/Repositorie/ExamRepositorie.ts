import { query, queryOne } from '../Database/pool';
import type { Exam, ExamWindowStatus } from '../Model/Exam';


interface ExamRow {
  id: number;
  course_id: number;
  course_code: string;
  course_name: string;
  title: string;
  description: string;
  available_from: Date;
  available_to: Date;
  status: ExamWindowStatus;
  question_count: string | number;
  total_points: string | number;
  attempt_count: string | number;
  created_at: Date;
  updated_at: Date;
}

function toModel(row: ExamRow): Exam {
  return {
    id: row.id,
    courseId: row.course_id,
    courseCode: row.course_code,
    courseName: row.course_name,
    title: row.title,
    description: row.description,
    availableFrom: row.available_from.toISOString(),
    availableTo: row.available_to.toISOString(),
    status: row.status,
    questionCount: Number(row.question_count),
    totalPoints: Number(row.total_points),
    attemptCount: Number(row.attempt_count),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const SELECT_EXAM = `
  SELECT e.id, e.course_id, c.code AS course_code, c.name AS course_name,
         e.title, e.description, e.available_from, e.available_to,
         CASE
           WHEN now() < e.available_from THEN 'UPCOMING'
           WHEN now() >= e.available_to  THEN 'CLOSED'
           ELSE 'OPEN'
         END AS status,
         (SELECT count(*)             FROM questions q WHERE q.exam_id = e.id) AS question_count,
         (SELECT COALESCE(sum(q.points), 0) FROM questions q WHERE q.exam_id = e.id) AS total_points,
         (SELECT count(*)             FROM attempts  a WHERE a.exam_id = e.id) AS attempt_count,
         e.created_at, e.updated_at
    FROM exams e
    JOIN courses c ON c.id = e.course_id
`;

export interface ExamFilter {
  courseId?: number;
}

export interface CreateExamData {
  courseId: number;
  title: string;
  description: string;
  availableFrom: Date;
  availableTo: Date;
}

export interface UpdateExamData {
  courseId?: number;
  title?: string;
  description?: string;
  availableFrom?: Date;
  availableTo?: Date;
}

export const ExamRepositorie = {
  async findAll(filter: ExamFilter = {}): Promise<Exam[]> {
    const rows = await query<ExamRow>(
      `${SELECT_EXAM}
        WHERE ($1::integer IS NULL OR e.course_id = $1::integer)
        ORDER BY e.available_from DESC, e.id DESC`,
      [filter.courseId ?? null],
    );

    return rows.map(toModel);
  },

  async findById(id: number): Promise<Exam | null> {
    const row = await queryOne<ExamRow>(`${SELECT_EXAM} WHERE e.id = $1`, [id]);
    return row ? toModel(row) : null;
  },

  async countAttempts(examId: number): Promise<number> {
    const row = await queryOne<{ count: string }>(
      'SELECT count(*) AS count FROM attempts WHERE exam_id = $1',
      [examId],
    );

    return Number(row?.count ?? 0);
  },

  async create(data: CreateExamData): Promise<Exam> {
    const inserted = await queryOne<{ id: number }>(
      `INSERT INTO exams (course_id, title, description, available_from, available_to)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [data.courseId, data.title, data.description, data.availableFrom, data.availableTo],
    );

    return (await this.findById((inserted as { id: number }).id)) as Exam;
  },

  async update(id: number, data: UpdateExamData): Promise<Exam | null> {
    const updated = await queryOne<{ id: number }>(
      `UPDATE exams
          SET course_id      = COALESCE($2::integer, course_id),
              title          = COALESCE($3::text, title),
              description    = COALESCE($4::text, description),
              available_from = COALESCE($5::timestamptz, available_from),
              available_to   = COALESCE($6::timestamptz, available_to)
        WHERE id = $1
        RETURNING id`,
      [
        id,
        data.courseId ?? null,
        data.title ?? null,
        data.description ?? null,
        data.availableFrom ?? null,
        data.availableTo ?? null,
      ],
    );

    return updated ? this.findById(updated.id) : null;
  },

  async remove(id: number): Promise<boolean> {
    const row = await queryOne<{ id: number }>(
      'DELETE FROM exams WHERE id = $1 RETURNING id',
      [id],
    );

    return row !== null;
  },
};
