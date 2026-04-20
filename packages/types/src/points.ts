export enum ActivityType {
  VIDEO_WATCH = 'VIDEO_WATCH',
  QUIZ_PASS = 'QUIZ_PASS',
  READING = 'READING',
  WEBINAR = 'WEBINAR',
  WHATSAPP_QUIZ = 'WHATSAPP_QUIZ',
}

export interface CPDRecord {
  id: string;
  learnerId: string;
  courseId?: string;
  activityType: ActivityType;
  pointsEarned: number;
  quizScore?: number;
  completedAt: string;
  cycleYear: number;
  syncedToNcz: boolean;
  nczSyncedAt?: string;
}

export interface Certificate {
  id: string;
  learnerId: string;
  certificateUuid: string;
  cycleYear: number;
  totalPoints: number;
  coursesCompleted: string[];
  issuedAt: string;
  pdfUrl: string;
  verificationUrl: string;
}

export interface CPDSummary {
  learnerId: string;
  cycleYear: number;
  totalPoints: number;
  requiredPoints: number;
  percentComplete: number;
  renewalDeadline: string;
  records: CPDRecord[];
  certificates: Certificate[];
}
