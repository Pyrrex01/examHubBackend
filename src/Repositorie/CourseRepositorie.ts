import { query, queryOne } from '../Database/pool';
import type { Course } from '../Model/Course';


interface CourseRow {
  id: number;
  code: string;
  name: string;
  description: string;
  exam_count: string | number;
  created_at: Date;
  updated_at: Date;
}

function toModel(row: CourseRow): Course {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    examCount: Number(row.exam_count),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const SELECT_COURSE = `
  SELECT c.id, c.code, c.name, c.description, c.created_at, c.updated_at,
         (SELECT count(*) FROM exams e WHERE e.course_id = c.id) AS exam_count
    FROM courses c
`;

export interface CreateCourseData {
  code: string;
  name: string;
  description: string;
}

export interface UpdateCourseData {
  code?: string;
  name?: string;
  description?: string;
}

export const CourseRepositorie = {
  async findAll(): Promise<Course[]> {
    const rows = await query<CourseRow>(`${SELECT_COURSE} ORDER BY c.code`);
    return rows.map(toModel);
  },

  async findById(id: number): Promise<Course | null> {
    const row = await queryOne<CourseRow>(`${SELECT_COURSE} WHERE c.id = $1`, [id]);
    return row ? toModel(row) : null;
  },

  async codeTaken(code: string, excludeId?: number): Promise<boolean> {
    const row = await queryOne<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM courses
          WHERE code = $1
            AND ($2::integer IS NULL OR id <> $2::integer)
       ) AS exists`,
      [code, excludeId ?? null],
    );

    return row?.exists ?? false;
  },

  async countExams(courseId: number): Promise<number> {
    const row = await queryOne<{ count: string }>(
      'SELECT count(*) AS count FROM exams WHERE course_id = $1',
      [courseId],
    );

    return Number(row?.count ?? 0);
  },

  async create(data: CreateCourseData): Promise<Course> {
    const inserted = await queryOne<{ id: number }>(
      `INSERT INTO courses (code, name, description)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [data.code, data.name, data.description],
    );

    const course = await this.findById((inserted as { id: number }).id);
    return course as Course;
  },

  async update(id: number, data: UpdateCourseData): Promise<Course | null> {
    const updated = await queryOne<{ id: number }>(
      `UPDATE courses
          SET code        = COALESCE($2::citext, code),
              name        = COALESCE($3::text, name),
              description = COALESCE($4::text, description)
        WHERE id = $1
        RETURNING id`,
      [id, data.code ?? null, data.name ?? null, data.description ?? null],
    );

    return updated ? this.findById(updated.id) : null;
  },

  async remove(id: number): Promise<boolean> {
    const row = await queryOne<{ id: number }>(
      'DELETE FROM courses WHERE id = $1 RETURNING id',
      [id],
    );

    return row !== null;
  },
};
