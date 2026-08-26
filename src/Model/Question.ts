
export interface Choice {
  id: number;
  label: string;
  isCorrect: boolean;
  position: number;
}

export interface Question {
  id: number;
  examId: number;
  statement: string;
  points: number;
  position: number;
  choices: Choice[];
}

export interface ExamQuestions {
  examId: number;
  examTitle: string;
  locked: boolean;
  attemptCount: number;
  totalPoints: number;
  questions: Question[];
}


export interface ChoiceForStudent {
  id: number;
  label: string;
  position: number;
}

export interface QuestionForStudent {
  id: number;
  statement: string;
  points: number;
  position: number;
  choices: ChoiceForStudent[];
}

export function toQuestionForStudent(question: Question): QuestionForStudent {
  return {
    id: question.id,
    statement: question.statement,
    points: question.points,
    position: question.position,
    choices: question.choices.map((choice) => ({
      id: choice.id,
      label: choice.label,
      position: choice.position,
    })),
  };
}

export const MIN_CHOICES = 2;
export const MAX_CHOICES = 6;
