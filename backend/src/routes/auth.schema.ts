import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2),
  councilId: z.string().min(3),
  professionalTitle: z.string().min(2).max(100),
  registrationNumber: z.string().min(3).max(80),
  cadre: z.enum(['NURSE', 'MIDWIFE', 'PHARMACIST', 'CLINICAL_OFFICER', 'LAB_TECH']).optional(),
  nczRegistrationNumber: z.string().optional(),
  institution: z.string().optional(),
  province: z.string().optional(),
  district: z.string().optional(),
  phone: z.string().optional(),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const emptyToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);

const CADRE_ENUM = z.enum(['NURSE', 'MIDWIFE', 'PHARMACIST', 'CLINICAL_OFFICER', 'LAB_TECH']);

export const UpdateProfileSchema = z
  .object({
    fullName: z.string().min(2).max(120).optional(),
    phone: z.preprocess(emptyToNull, z.union([z.string().max(30), z.null()]).optional()),
    institution: z.preprocess(emptyToNull, z.union([z.string().max(200), z.null()]).optional()),
    province: z.preprocess(emptyToNull, z.union([z.string().max(100), z.null()]).optional()),
    district: z.preprocess(emptyToNull, z.union([z.string().max(100), z.null()]).optional()),
    councilId: z.preprocess(emptyToNull, z.union([z.string().max(100), z.null()]).optional()),
    professionalTitle: z.preprocess(emptyToNull, z.union([z.string().max(100), z.null()]).optional()),
    registrationNumber: z.preprocess(emptyToNull, z.union([z.string().max(80), z.null()]).optional()),
    cadre: z.preprocess(emptyToNull, z.union([CADRE_ENUM, z.null()]).optional()),
    nczRegistrationNumber: z.preprocess(emptyToNull, z.union([z.string().max(50), z.null()]).optional()),
    avatarUrl: z.preprocess(emptyToNull, z.union([z.string().url(), z.null()]).optional()),
    specialtyArea: z.preprocess(emptyToNull, z.union([z.string().max(100), z.null()]).optional()),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'No profile fields to update' });

export const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
