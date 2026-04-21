import { db } from '../lib/db';
import { getLearnerCPDSummary } from './cpd-engine';

export type SubscriptionTier = 'FREE' | 'STANDARD' | 'DIASPORA' | 'INSTITUTION';

export type LearnerEntitlements = {
  learnerId: string;
  subscriptionTier: SubscriptionTier;
  premiumWebAccess: boolean;
  certificateEligible: boolean;
  aiTutorAllowed: boolean;
  whatsappPointsCap: number;
  whatsappPointsEarnedThisCycle: number;
  remainingWhatsappPoints: number;
};

const FREE_WHATSAPP_POINTS_CAP = 12;

function tierAllowsPremiumWeb(tier: SubscriptionTier): boolean {
  return tier !== 'FREE';
}

function tierAllowsCertificates(tier: SubscriptionTier): boolean {
  return tier !== 'FREE';
}

function tierAllowsAiTutor(tier: SubscriptionTier): boolean {
  return tier !== 'FREE';
}

export async function getLearnerEntitlements(learnerId: string): Promise<LearnerEntitlements> {
  const user = await db.user.findUnique({
    where: { id: learnerId },
    select: { id: true, subscriptionTier: true },
  });
  if (!user) throw new Error('Learner not found');

  const tier = user.subscriptionTier as SubscriptionTier;
  const summary = await getLearnerCPDSummary(learnerId);

  const whatsappCap = tier === 'FREE' ? FREE_WHATSAPP_POINTS_CAP : Number.POSITIVE_INFINITY;
  const whatsappEarned = await db.cPDRecord.aggregate({
    where: { learnerId, cycleYear: summary.cycleYear, activityType: 'WHATSAPP_QUIZ' },
    _sum: { pointsEarned: true },
  });
  const earned = whatsappEarned._sum.pointsEarned ?? 0;
  const remaining = whatsappCap === Number.POSITIVE_INFINITY ? whatsappCap : Math.max(0, whatsappCap - earned);

  return {
    learnerId,
    subscriptionTier: tier,
    premiumWebAccess: tierAllowsPremiumWeb(tier),
    certificateEligible: tierAllowsCertificates(tier),
    aiTutorAllowed: tierAllowsAiTutor(tier),
    whatsappPointsCap: whatsappCap === Number.POSITIVE_INFINITY ? FREE_WHATSAPP_POINTS_CAP : whatsappCap,
    whatsappPointsEarnedThisCycle: earned,
    remainingWhatsappPoints: remaining === Number.POSITIVE_INFINITY ? 999999 : remaining,
  };
}

export async function canUseAiTutor(learnerId: string): Promise<boolean> {
  const ent = await getLearnerEntitlements(learnerId);
  return ent.aiTutorAllowed;
}

export async function canGenerateCertificate(learnerId: string, _cycleYear: number): Promise<boolean> {
  const ent = await getLearnerEntitlements(learnerId);
  return ent.certificateEligible;
}

export async function canEarnWhatsAppPoints(learnerId: string, _cycleYear: number): Promise<boolean> {
  const ent = await getLearnerEntitlements(learnerId);
  return ent.subscriptionTier !== 'FREE' ? true : ent.remainingWhatsappPoints > 0;
}

export async function canAccessPremiumCourse(learnerId: string, _courseId: string): Promise<boolean> {
  const ent = await getLearnerEntitlements(learnerId);
  return ent.premiumWebAccess;
}

