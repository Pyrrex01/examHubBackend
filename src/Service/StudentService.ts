import { StudentRepositorie, type StudentFilter } from '../Repositorie/StudentRepositorie';
import { HttpError } from '../Middleware/HttpError';
import { hashPassword } from '../Security/password';
import type { PublicUser } from '../Model/User';


export interface CreateStudentInput {
  fullName: string;
  email: string;
  password: string;
}

export interface UpdateStudentInput {
  fullName?: string;
  email?: string;
  password?: string;
  isActive?: boolean;
}

async function requireStudentById(id: number): Promise<PublicUser> {
  const student = await StudentRepositorie.findById(id);

  if (!student) {
    throw HttpError.notFound("Cet étudiant n'existe pas.");
  }

  return student;
}

export const StudentService = {
  async list(filter: StudentFilter = {}): Promise<PublicUser[]> {
    return StudentRepositorie.findAll(filter);
  },

  async getById(id: number): Promise<PublicUser> {
    return requireStudentById(id);
  },

  async create(input: CreateStudentInput): Promise<PublicUser> {
    if (await StudentRepositorie.emailTaken(input.email)) {
      throw HttpError.conflict('Cette adresse email est déjà utilisée par un autre compte.');
    }

    const passwordHash = await hashPassword(input.password);

    return StudentRepositorie.create({
      fullName: input.fullName,
      email: input.email,
      passwordHash,
    });
  },

  async update(id: number, input: UpdateStudentInput): Promise<PublicUser> {
    await requireStudentById(id);

    if (input.email !== undefined && (await StudentRepositorie.emailTaken(input.email, id))) {
      throw HttpError.conflict('Cette adresse email est déjà utilisée par un autre compte.');
    }

    const passwordHash =
      input.password === undefined ? undefined : await hashPassword(input.password);

    const updated = await StudentRepositorie.update(id, {
      fullName: input.fullName,
      email: input.email,
      passwordHash,
      isActive: input.isActive,
    });

    if (!updated) {
      throw HttpError.notFound("Cet étudiant n'existe pas.");
    }

    return updated;
  },

  async resetPassword(id: number, newPassword: string): Promise<PublicUser> {
    return this.update(id, { password: newPassword });
  },

  async deactivate(id: number): Promise<PublicUser> {
    await requireStudentById(id);

    const deactivated = await StudentRepositorie.deactivate(id);

    if (!deactivated) {
      throw HttpError.notFound("Cet étudiant n'existe pas.");
    }

    return deactivated;
  },
};
