import { HttpError } from './HttpError';


interface PostgresError extends Error {
  code: string;
  constraint?: string;
  table?: string;
  column?: string;
  detail?: string;
}

export function isPostgresError(error: unknown): error is PostgresError {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  );
}

const CONSTRAINT_MESSAGES: Record<string, { status: number; message: string }> = {
  users_email_unique: {
    status: 409,
    message: 'Cette adresse email est déjà utilisée par un autre compte.',
  },
  users_email_format: {
    status: 400,
    message: "L'adresse email fournie n'est pas valide.",
  },
  users_password_is_hashed: {
    status: 400,
    message: 'Le mot de passe doit être haché avant enregistrement.',
  },
  users_full_name_not_blank: {
    status: 400,
    message: 'Le nom ne doit pas être vide.',
  },

  courses_code_unique: {
    status: 409,
    message: 'Un cours portant ce code existe déjà.',
  },
  courses_code_format: {
    status: 400,
    message:
      'Le code du cours doit comporter de 2 à 20 caractères alphanumériques, tirets ou soulignés.',
  },
  courses_name_not_blank: {
    status: 400,
    message: 'Le nom du cours ne doit pas être vide.',
  },

  exams_course_fk: {
    status: 409,
    message: 'Ce cours possède des examens et ne peut pas être supprimé.',
  },
  exams_window_ordered: {
    status: 400,
    message: 'La date de fin de disponibilité doit être postérieure à la date de début.',
  },
  exams_title_not_blank: {
    status: 400,
    message: "Le titre de l'examen ne doit pas être vide.",
  },

  questions_points_positive: {
    status: 400,
    message: 'Le nombre de points doit être strictement positif.',
  },
  questions_statement_not_blank: {
    status: 400,
    message: "L'énoncé de la question ne doit pas être vide.",
  },
  questions_exam_position_unique: {
    status: 409,
    message: 'Deux questions ne peuvent pas occuper la même position dans un examen.',
  },

  choices_one_correct_per_question_idx: {
    status: 400,
    message: 'Une question ne peut comporter qu’un seul choix correct.',
  },
  choices_position_in_range: {
    status: 400,
    message: 'Une question ne peut pas comporter plus de 6 choix.',
  },
  choices_question_position_unique: {
    status: 409,
    message: 'Deux choix ne peuvent pas occuper la même position dans une question.',
  },
  choices_label_not_blank: {
    status: 400,
    message: "L'intitulé d'un choix ne doit pas être vide.",
  },

  attempts_one_per_student_and_exam: {
    status: 409,
    message: 'Cet examen a déjà été passé : une seule tentative est autorisée.',
  },
  attempts_exam_fk: {
    status: 409,
    message: 'Cet examen possède des tentatives et ne peut pas être supprimé.',
  },
  attempts_student_is_student_fk: {
    status: 409,
    message:
      'Opération impossible : le compte concerné doit être un étudiant, et un étudiant ayant passé un examen ne peut pas être supprimé.',
  },
  attempts_score_in_range: {
    status: 400,
    message: 'La note calculée est incohérente avec le barème de l’examen.',
  },

  answers_one_per_question: {
    status: 400,
    message: 'Une seule réponse par question est autorisée.',
  },
  answers_choice_belongs_to_question_fk: {
    status: 400,
    message: 'Le choix sélectionné n’appartient pas à la question répondue.',
  },
  answers_question_fk: {
    status: 400,
    message: 'La question répondue n’appartient pas à cet examen.',
  },
  answers_attempt_fk: {
    status: 400,
    message: 'La réponse ne correspond pas à la tentative en cours.',
  },
};

const CODE_FALLBACKS: Record<string, { status: number; message: string }> = {
  '23505': { status: 409, message: 'Cette ressource existe déjà.' },
  '23503': { status: 409, message: 'Cette ressource est référencée ailleurs et ne peut pas être modifiée ou supprimée.' },
  '23502': { status: 400, message: 'Un champ obligatoire est manquant.' },
  '23514': { status: 400, message: 'Les données fournies ne respectent pas les règles de l’application.' },
  '23000': { status: 409, message: 'Cette opération est interdite par une règle de l’application.' },
  '23001': { status: 409, message: 'Cette ressource est protégée contre la suppression.' },
  '22P02': { status: 400, message: 'Une valeur fournie n’est pas du type attendu.' },
  '22001': { status: 400, message: 'Une valeur fournie dépasse la longueur autorisée.' },
  '22003': { status: 400, message: 'Une valeur numérique fournie est hors limites.' },
  '40001': { status: 409, message: 'Conflit d’accès concurrent, veuillez réessayer.' },
  '40P01': { status: 409, message: 'Conflit d’accès concurrent, veuillez réessayer.' },
  '57014': { status: 503, message: 'La requête a été interrompue, veuillez réessayer.' },
  '08006': { status: 503, message: 'La base de données est momentanément injoignable.' },
  '08003': { status: 503, message: 'La base de données est momentanément injoignable.' },
  ECONNREFUSED: { status: 503, message: 'La base de données est momentanément injoignable.' },
};

export function translatePostgresError(error: unknown): HttpError | null {
  if (!isPostgresError(error)) return null;

  if (error.constraint) {
    const mapped = CONSTRAINT_MESSAGES[error.constraint];
    if (mapped) return new HttpError(mapped.status, mapped.message);
  }

  if ((error.code === '23514' || error.code === '23000') && !error.constraint) {
    return new HttpError(error.code === '23000' ? 409 : 400, error.message);
  }

  const fallback = CODE_FALLBACKS[error.code];
  if (fallback) return new HttpError(fallback.status, fallback.message);

  return null;
}
