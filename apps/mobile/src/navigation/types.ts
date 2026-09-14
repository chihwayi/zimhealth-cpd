import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';

// ─── Stacks ──────────────────────────────────────────────────────────────────

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type CoursesStackParamList = {
  CoursesList: undefined;
  CourseDetail: { courseId: string };
  CoursePlayer: { enrollmentId: string; courseId: string };
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
  Subscription: undefined;
};

// ─── Bottom Tabs ─────────────────────────────────────────────────────────────

export type AppTabParamList = {
  DashboardTab:     undefined;
  CoursesTab:       undefined;
  PointsTab:        undefined;
  CertificatesTab:  undefined;
  ProfileTab:       undefined;
};

export type CreatorTabParamList = {
  CreatorHomeTab:    undefined;
  CreatorCoursesTab: undefined;
  CreatorProfileTab: undefined;
};

export type CouncilTabParamList = {
  CouncilHomeTab:    undefined;
  CouncilReviewsTab: undefined;
  CouncilProfileTab: undefined;
};

// ─── Screen props ─────────────────────────────────────────────────────────────

export type LoginScreenProps    = NativeStackScreenProps<AuthStackParamList, 'Login'>;
export type RegisterScreenProps = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export type CoursesListScreenProps = CompositeScreenProps<
  NativeStackScreenProps<CoursesStackParamList, 'CoursesList'>,
  BottomTabScreenProps<AppTabParamList>
>;
export type CourseDetailScreenProps = NativeStackScreenProps<CoursesStackParamList, 'CourseDetail'>;
export type CoursePlayerScreenProps = NativeStackScreenProps<CoursesStackParamList, 'CoursePlayer'>;
export type ProfileScreenProps = NativeStackScreenProps<ProfileStackParamList, 'ProfileHome'>;
