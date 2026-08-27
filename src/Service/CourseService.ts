import { CourseRepositorie } from '../Repositorie/CourseRepositorie';
import { HttpError } from '../Middleware/HttpError';
import type { Course } from '../Model/Course';


export interface CreateCourseInput {
  code: string;
  name: string;
  description?: string;
}

export interface UpdateCourseInput {
  code?: string;
  name?: string;
  description?: string;
}

async function requireCourseById(id: number): Promise<Course> {
  const course = await CourseRepositorie.findById(id);

  if (!course) {
    throw HttpError.notFound("Ce cours n'existe pas.");
  }

  return course;
}

export const CourseService = {
  async list(): Promise<Course[]> {
    return CourseRepositorie.findAll();
  },

  async getById(id: number): Promise<Course> {
    return requireCourseById(id);
  },

  async create(input: CreateCourseInput): Promise<Course> {
    if (await CourseRepositorie.codeTaken(input.code)) {
      throw HttpError.conflict(
        `Un cours portant le code « ${input.code} » existe déjà.`,
      );
    }

    return CourseRepositorie.create({
      code: input.code,
      name: input.name,
      description: input.description ?? '',
    });
  },

  async update(id: number, input: UpdateCourseInput): Promise<Course> {
    await requireCourseById(id);

    if (input.code !== undefined && (await CourseRepositorie.codeTaken(input.code, id))) {
      throw HttpError.conflict(
        `Un autre cours porte déjà le code « ${input.code} ».`,
      );
    }

    const updated = await CourseRepositorie.update(id, input);

    if (!updated) {
      throw HttpError.notFound("Ce cours n'existe pas.");
    }

    return updated;
  },

  async remove(id: number): Promise<Course> {
    const course = await requireCourseById(id);

    const examCount = await CourseRepositorie.countExams(id);

    if (examCount > 0) {
      throw HttpError.conflict(
        `Ce cours ne peut pas être supprimé : ${examCount} examen(s) y sont rattaché(s). ` +
          'Supprimez ou déplacez ces examens au préalable.',
      );
    }

    const removed = await CourseRepositorie.remove(id);

    if (!removed) {
      throw HttpError.notFound("Ce cours n'existe pas.");
    }

    return course;
  },
};
