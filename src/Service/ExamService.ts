import { ExamRepositorie, type ExamFilter } from '../Repositorie/ExamRepositorie';
import { CourseRepositorie } from '../Repositorie/CourseRepositorie';
import { HttpError } from '../Middleware/HttpError';
import type { Exam } from '../Model/Exam';


export interface CreateExamInput {
  courseId: number;
  title: string;
  description?: string;
  availableFrom: Date;
  availableTo: Date;
}

export interface UpdateExamInput {
  courseId?: number;
  title?: string;
  description?: string;
  availableFrom?: Date;
  availableTo?: Date;
}

async function requireExamById(id: number): Promise<Exam> {
  const exam = await ExamRepositorie.findById(id);

  if (!exam) {
    throw HttpError.notFound("Cet examen n'existe pas.");
  }

  return exam;
}

async function requireCourseExists(courseId: number): Promise<void> {
  const course = await CourseRepositorie.findById(courseId);

  if (!course) {
    throw HttpError.notFound(
      `Le cours demandé (identifiant ${courseId}) n'existe pas : impossible d'y rattacher un examen.`,
    );
  }
}

function assertWindowOrdered(availableFrom: Date, availableTo: Date): void {
  if (availableTo.getTime() <= availableFrom.getTime()) {
    throw HttpError.badRequest(
      'La date de fin de disponibilité doit être strictement postérieure à la date de début.',
    );
  }
}

export const ExamService = {
  async list(filter: ExamFilter = {}): Promise<Exam[]> {
    if (filter.courseId !== undefined) {
      await requireCourseExists(filter.courseId);
    }

    return ExamRepositorie.findAll(filter);
  },

  async getById(id: number): Promise<Exam> {
    return requireExamById(id);
  },

  async create(input: CreateExamInput): Promise<Exam> {
    await requireCourseExists(input.courseId);
    assertWindowOrdered(input.availableFrom, input.availableTo);

    return ExamRepositorie.create({
      courseId: input.courseId,
      title: input.title,
      description: input.description ?? '',
      availableFrom: input.availableFrom,
      availableTo: input.availableTo,
    });
  },

  async update(id: number, input: UpdateExamInput): Promise<Exam> {
    const existing = await requireExamById(id);

    if (input.courseId !== undefined && input.courseId !== existing.courseId) {
      await requireCourseExists(input.courseId);
    }

    const resultingFrom = input.availableFrom ?? new Date(existing.availableFrom);
    const resultingTo = input.availableTo ?? new Date(existing.availableTo);
    assertWindowOrdered(resultingFrom, resultingTo);

    const updated = await ExamRepositorie.update(id, input);

    if (!updated) {
      throw HttpError.notFound("Cet examen n'existe pas.");
    }

    return updated;
  },

  async remove(id: number): Promise<Exam> {
    const exam = await requireExamById(id);

    const attemptCount = await ExamRepositorie.countAttempts(id);

    if (attemptCount > 0) {
      throw HttpError.conflict(
        `Cet examen ne peut pas être supprimé : ${attemptCount} tentative(s) y sont enregistrée(s). ` +
          'Supprimer l’examen effacerait les résultats des étudiants concernés.',
      );
    }

    const removed = await ExamRepositorie.remove(id);

    if (!removed) {
      throw HttpError.notFound("Cet examen n'existe pas.");
    }

    return exam;
  },
};
