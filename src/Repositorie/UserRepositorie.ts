import { queryOne } from '../Database/pool';
import type { UserRole, UserWithPassword } from '../Model/User';


interface UserRow {
  id: number;
  full_name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  is_active: boolean;
  created_at: Date;
}

function toModel(row: UserRow): UserWithPassword {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at.toISOString(),
  };
}

const SELECT_COLUMNS = `
  id, full_name, email, password_hash, role, is_active, created_at
`;

export const UserRepositorie = {
  async findByEmail(email: string): Promise<UserWithPassword | null> {
    const row = await queryOne<UserRow>(
      `SELECT ${SELECT_COLUMNS} FROM users WHERE email = $1`,
      [email],
    );

    return row ? toModel(row) : null;
  },

  async findById(id: number): Promise<UserWithPassword | null> {
    const row = await queryOne<UserRow>(
      `SELECT ${SELECT_COLUMNS} FROM users WHERE id = $1`,
      [id],
    );

    return row ? toModel(row) : null;
  },
};
