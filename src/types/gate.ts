// ═══════════════════════════════════════════════════════════
// WARRIOR OS — GATE Types
// ═══════════════════════════════════════════════════════════

export type GateSubject =
  | 'DBMS'
  | 'OS'
  | 'CN'
  | 'TOC'
  | 'COA'
  | 'DAA'
  | 'Compiler Design'
  | 'Digital Logic'
  | 'Discrete Math'
  | 'Engineering Math'
  | 'C Programming'
  | 'Data Structures';

export type QuestionType = 'mcq' | 'numerical' | 'msq';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Question {
  id: string;
  subject: GateSubject;
  topic: string;
  type: QuestionType;
  question: string;
  options: string[];
  answer: number | number[] | string; // index for mcq, indices for msq, value for numerical
  explanation: string;
  difficulty: Difficulty;
  year?: number; // GATE previous year
  marks: 1 | 2;
}

export interface QuizSession {
  id: string;
  subject: GateSubject;
  questions: Question[];
  answers: Record<string, number | number[] | string>;
  score: number;
  totalMarks: number;
  startedAt: string;
  completedAt?: string;
  timeTaken?: number; // seconds
}

export interface SubjectProgress {
  subject: GateSubject;
  totalAttempted: number;
  correctAnswers: number;
  accuracy: number;
  lastAttemptDate: string;
  topicsCompleted: string[];
}
