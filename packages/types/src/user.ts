export enum Role {
  ADMIN = 'ADMIN',
  CONTENT_MANAGER = 'CONTENT_MANAGER',
  NCZ_OFFICER = 'NCZ_OFFICER',
  LEARNER = 'LEARNER',
}

export enum Cadre {
  NURSE = 'NURSE',
  MIDWIFE = 'MIDWIFE',
  PHARMACIST = 'PHARMACIST',
  CLINICAL_OFFICER = 'CLINICAL_OFFICER',
  LAB_TECH = 'LAB_TECH',
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  cadre?: Cadre;
  nczRegistrationNumber?: string;
  institution?: string;
  province?: string;
  district?: string;
  phone?: string;
  avatarUrl?: string;
  subscriptionTier: SubscriptionTier;
  subscriptionExpiresAt?: string;
  isActive: boolean;
  createdAt: string;
}

export enum SubscriptionTier {
  FREE = 'FREE',
  STANDARD = 'STANDARD',
  INSTITUTION = 'INSTITUTION',
  DIASPORA = 'DIASPORA',
}
