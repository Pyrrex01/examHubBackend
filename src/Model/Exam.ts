
export type ExamWindowStatus = 'UPCOMING' | 'OPEN' | 'CLOSED';

export interface Exam {
  id: number;
  courseId: number;
  courseCode: string;
  courseName: string;
  title: string;
  description: string;
  availableFrom: string;
  availableTo: string;
  status: ExamWindowStatus;
  questionCount: number;
  totalPoints: number;
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
}
