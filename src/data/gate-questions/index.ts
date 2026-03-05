// ═══════════════════════════════════════════════════════════
// WARRIOR OS — GATE Questions: Barrel Export
// ═══════════════════════════════════════════════════════════

export { OS_QUESTIONS } from './os';
export { DBMS_QUESTIONS } from './dbms';
export { CN_QUESTIONS } from './cn';
export { TOC_QUESTIONS } from './toc';
export { DS_QUESTIONS } from './ds';
export { DAA_QUESTIONS } from './daa';
export {
  DISCRETE_MATH_QUESTIONS,
  DIGITAL_LOGIC_QUESTIONS,
  COMPILER_DESIGN_QUESTIONS,
  COA_QUESTIONS,
  ENGINEERING_MATH_QUESTIONS,
  C_PROGRAMMING_QUESTIONS,
} from './other-subjects';

import type { Question, GateSubject } from '@/types/gate';
import { OS_QUESTIONS } from './os';
import { DBMS_QUESTIONS } from './dbms';
import { CN_QUESTIONS } from './cn';
import { TOC_QUESTIONS } from './toc';
import { DS_QUESTIONS } from './ds';
import { DAA_QUESTIONS } from './daa';
import {
  DISCRETE_MATH_QUESTIONS,
  DIGITAL_LOGIC_QUESTIONS,
  COMPILER_DESIGN_QUESTIONS,
  COA_QUESTIONS,
  ENGINEERING_MATH_QUESTIONS,
  C_PROGRAMMING_QUESTIONS,
} from './other-subjects';

/** All questions combined */
export const ALL_QUESTIONS: Question[] = [
  ...OS_QUESTIONS,
  ...DBMS_QUESTIONS,
  ...CN_QUESTIONS,
  ...TOC_QUESTIONS,
  ...DS_QUESTIONS,
  ...DAA_QUESTIONS,
  ...DISCRETE_MATH_QUESTIONS,
  ...DIGITAL_LOGIC_QUESTIONS,
  ...COMPILER_DESIGN_QUESTIONS,
  ...COA_QUESTIONS,
  ...ENGINEERING_MATH_QUESTIONS,
  ...C_PROGRAMMING_QUESTIONS,
];

/** Get questions by subject */
export function getQuestionsBySubject(subject: GateSubject): Question[] {
  return ALL_QUESTIONS.filter((q) => q.subject === subject);
}

/** Get questions by topic within a subject */
export function getQuestionsByTopic(subject: GateSubject, topic: string): Question[] {
  return ALL_QUESTIONS.filter((q) => q.subject === subject && q.topic === topic);
}

/** Get all unique topics for a subject */
export function getTopicsForSubject(subject: GateSubject): string[] {
  const topics = new Set(ALL_QUESTIONS.filter((q) => q.subject === subject).map((q) => q.topic));
  return Array.from(topics);
}

/** Get all subjects that have questions */
export function getAvailableSubjects(): GateSubject[] {
  const subjects = new Set(ALL_QUESTIONS.map((q) => q.subject));
  return Array.from(subjects);
}
