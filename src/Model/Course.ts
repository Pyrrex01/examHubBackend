
export interface Course {
  id: number;
  code: string;
  name: string;
  description: string;
  examCount: number;
  createdAt: string;
  updatedAt: string;
}

export const COURSE_CODE_PATTERN = /^[A-Za-z0-9_-]{2,20}$/;

export const COURSE_CODE_RULE =
  'doit comporter de 2 à 20 caractères, uniquement lettres, chiffres, tirets ou soulignés';
