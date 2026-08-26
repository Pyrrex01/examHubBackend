import type { CorrectedQuestion } from './Attempt';



export interface ExamResultRow {
  studentId: number;
  fullName: string;
  email: string;
  isActive: boolean;
  hasAttempted: boolean;
  attemptId: number | null;
  score: number | null;
  maxScore: number | null;
  percentage: number | null;
  submittedAt: string | null;
}

export interface ExamResultStats {
  attemptCount: number;
  studentCount: number;
  average: number | null;
  averagePercentage: number | null;
  lowest: number | null;
  highest: number | null;
  maxScore: number;
}

export interface ExamResults {
  examId: number;
  examTitle: string;
  courseCode: string;
  courseName: string;
  stats: ExamResultStats;
  results: ExamResultRow[];
}


export interface StudentResultSummary {
  attemptId: number;
  examId: number;
  examTitle: string;
  courseCode: string;
  courseName: string;
  score: number;
  maxScore: number;
  percentage: number;
  submittedAt: string;
  questions?: CorrectedQuestion[];
}
