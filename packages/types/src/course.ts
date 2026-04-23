export enum CourseStatus {
  DRAFT = 'DRAFT',
  UNDER_REVIEW = 'UNDER_REVIEW',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export enum CPDCategory {
  CLINICAL = 'CLINICAL',
  MANAGEMENT = 'MANAGEMENT',
  ETHICS = 'ETHICS',
  RESEARCH = 'RESEARCH',
}

export enum Difficulty {
  FOUNDATION = 'FOUNDATION',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
}

export enum Language {
  ENGLISH = 'ENGLISH',
  SHONA = 'SHONA',
  NDEBELE = 'NDEBELE',
}

export enum ContentType {
  VIDEO = 'VIDEO',
  READING = 'READING',
  AUDIO = 'AUDIO',
  INTERACTIVE = 'INTERACTIVE',
  QUIZ = 'QUIZ',
}

export enum QuestionType {
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  TRUE_FALSE = 'TRUE_FALSE',
  MATCHING = 'MATCHING',
  IMAGE_MCQ = 'IMAGE_MCQ',
}

export interface Course {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  thumbnailUrl?: string;
  promoVideoUrl?: string;
  category: CPDCategory;
  isPublicToAll: boolean;
  targetCadres: string[];
  targetCouncilIds: string[];
  targetTitles: string[];
  specialtyArea?: string;
  difficulty: Difficulty;
  language: Language;
  cpdPoints: number;
  estimatedMinutes: number;
  accreditationBody?: string;
  tags: string[];
  status: CourseStatus;
  expiresAt?: string;
  creatorId: string;
  modules: Module[];
  enrollmentCount: number;
  completionRate: number;
  rating: number;
  createdAt: string;
  updatedAt: string;
}

export interface Module {
  id: string;
  courseId: string;
  title: string;
  order: number;
  isOfflineReady: boolean;
  sections: ContentSection[];
}

export interface ContentSection {
  id: string;
  moduleId: string;
  type: ContentType;
  title: string;
  order: number;
  content: string;
  mediaUrl?: string;
  completionThreshold: number;
}

export interface Quiz {
  id: string;
  moduleId?: string;
  courseId: string;
  title: string;
  passMark: number;
  attemptLimit: number;
  timeLimitMinutes?: number;
  randomiseQuestions: boolean;
  showAnswersAfter: boolean;
  questions: Question[];
}

export interface Question {
  id: string;
  quizId: string;
  type: QuestionType;
  text: string;
  imageUrl?: string;
  options: QuestionOption[];
  points: number;
  difficultyTag?: string;
  topicTag?: string;
}

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
}
