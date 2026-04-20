import type { Cadre } from '@prisma/client';

// Points required per annual cycle by cadre
export const REQUIRED_POINTS: Record<string, number> = {
  NURSE: 12,
  MIDWIFE: 12,
  PHARMACIST: 15,
  CLINICAL_OFFICER: 12,
  LAB_TECH: 10,
  DEFAULT: 12,
};

// Points awarded per activity type (defaults — Admin can override via platform config)
export const ACTIVITY_POINTS: Record<string, number> = {
  VIDEO_WATCH: 1,
  QUIZ_PASS: 3, // per course completion
  READING: 1,
  WEBINAR: 2,
  WHATSAPP_QUIZ: 1,
};

export function getRequiredPoints(cadre?: string | null): number {
  if (!cadre) return REQUIRED_POINTS.DEFAULT;
  return REQUIRED_POINTS[cadre] ?? REQUIRED_POINTS.DEFAULT;
}

export function getCurrentCycleYear(): number {
  return new Date().getFullYear();
}

