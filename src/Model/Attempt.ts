import type { QuestionForStudent } from './Question';



export interface AvailableExam {
  id: number;
  courseCode: string;
  courseName: string;
  title: string;
  description: string;
  availableFrom: string;
  availableTo: string;
  questionCount: number;
  totalPoints: number;
}

export interface ExamPaper {
  exam: AvailableExam;
  questions: QuestionForStudent[];
}


export interface SubmittedAnswer {
  questionId: number;
  choiceId: number;
}


export interface CorrectedChoice {
  id: number;
  label: string;
  position: number;
  isCorrect: boolean;
  selected: boolean;
}

export interface CorrectedQuestion {
  id: number;
  statement: string;
  points: number;
  position: number;
  choices: CorrectedChoice[];
  selectedChoiceId: number | null;
  correctChoiceId: number;
  answeredCorrectly: boolean;
  pointsEarned: number;
}

export interface AttemptResult {
  attemptId: number;
  examId: number;
  examTitle: string;
  courseCode: string;
  score: number;
  maxScore: number;
  unansweredCount: number;
  submittedAt: string;
  questions: CorrectedQuestion[];
}

export interface AttemptRecord {
  id: number;
  examId: number;
  studentId: number;
  score: number;
  maxScore: number;
  submittedAt: string;
}
