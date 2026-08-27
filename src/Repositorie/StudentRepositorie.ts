import { query, queryOne } from '../Database/pool';
import type { PublicUser } from '../Model/User';


interface StudentRow {
  id: number;
  full_name: string;
  email: string;
  role: 'STUDENT';
  is_active: boolean;
  created_at: Date;
}

function toModel(row: StudentRow): PublicUser {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at.toISOString(),
  };
}

const PUBLIC_COLUMNS = 'id, full_name, email, role, is_active, created_at';

export interface StudentFilter {
  isActive?: boolean;
}

export interface CreateStudentData {
  fullName: string;
  email: string;
  passwordHash: string;
}

export interface UpdateStudentData {
  fullName?: string;
  email?: string;
  passwordHash?: string;
  isActive?: boolean;
}

export const StudentRepositorie = {
  async findAll(filter: StudentFilter = {}): Promise<PublicUser[]> {
    const rows = await query<StudentRow>(
      `SELECT ${PUBLIC_COLUMNS}
         FROM users
        WHERE role = 'STUDENT'
          AND ($1::boolean IS NULL OR is_active = $1::boolean)
        ORDER BY full_name, id`,
      [filter.isActive ?? null],
    );

    return rows.map(toModel);
  },

  async findById(id: number): Promise<PublicUser | null> {
    const row = await queryOne<StudentRow>(
      `SELECT ${PUBLIC_COLUMNS}
         FROM users
        WHERE id = $1 AND role = 'STUDENT'`,
      [id],
    );

    return row ? toModel(row) : null;
  },

  async emailTaken(email: string, excludeId?: number): Promise<boolean> {
    const row = await queryOne<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM users
          WHERE email = $1
            AND ($2::integer IS NULL OR id <> $2::integer)
       ) AS exists`,
      [email, excludeId ?? null],
    );

    return row?.exists ?? false;
  },

  async create(data: CreateStudentData): Promise<PublicUser> {
    const row = await queryOne<StudentRow>(
      `INSERT INTO users (full_name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, 'STUDENT', TRUE)
       RETURNING ${PUBLIC_COLUMNS}`,
      [data.fullName, data.email, data.passwordHash],
    );

    return toModel(row as StudentRow);
  },

  async update(id: number, data: UpdateStudentData): Promise<PublicUser | null> {
    const row = await queryOne<StudentRow>(
      `UPDATE users
          SET full_name     = COALESCE($2::text, full_name),
              email         = COALESCE($3::citext, email),
              password_hash = COALESCE($4::text, password_hash),
              is_active     = COALESCE($5::boolean, is_active)
        WHERE id = $1 AND role = 'STUDENT'
        RETURNING ${PUBLIC_COLUMNS}`,
      [
        id,
        data.fullName ?? null,
        data.email ?? null,
        data.passwordHash ?? null,
        data.isActive ?? null,
      ],
    );

    return row ? toModel(row) : null;
  },

  async deactivate(id: number): Promise<PublicUser | null> {
    const row = await queryOne<StudentRow>(
      `UPDATE users
          SET is_active = FALSE
        WHERE id = $1 AND role = 'STUDENT'
        RETURNING ${PUBLIC_COLUMNS}`,
      [id],
    );

    return row ? toModel(row) : null;
  },
};
