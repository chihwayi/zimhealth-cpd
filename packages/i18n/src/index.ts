// Baseline English UI strings — the single source of truth for what a
// translation file needs to cover. Embedded at build time in the web app
// (always available, no network dependency) and used by the backend to
// generate the fill-in-the-blank CSV template for new languages.
//
// Scope: learner-facing chrome only (nav, auth, courses, subscription,
// common actions) — admin/creator/council back-office UI stays English-only
// for now, per Sprint 09's non-goals.
export const en: Record<string, string> = {
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.submit': 'Submit',
  'common.loading': 'Loading...',
  'common.search': 'Search',
  'common.download': 'Download',
  'common.upload': 'Upload',
  'common.logout': 'Log out',
  'common.back': 'Back',
  'common.continue': 'Continue',
  'common.yes': 'Yes',
  'common.no': 'No',
  'common.error': 'Something went wrong',
  'common.retry': 'Retry',

  'nav.dashboard': 'Dashboard',
  'nav.browseCourses': 'Browse Courses',
  'nav.myLearning': 'My Learning',
  'nav.myPoints': 'My Points',
  'nav.certificates': 'Certificates',
  'nav.subscription': 'Subscription',
  'nav.profile': 'Profile',
  'nav.reportIssue': 'Report an issue',
  'nav.myInstitution': 'My Institution',

  'auth.login': 'Log in',
  'auth.register': 'Register',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.forgotPassword': 'Forgot password?',
  'auth.welcomeBack': 'Welcome back',
  'auth.dontHaveAccount': "Don't have an account?",
  'auth.alreadyHaveAccount': 'Already have an account?',

  'courses.enrollNow': 'Enrol Now — Free',
  'courses.continueLearning': 'Continue Learning',
  'courses.completedReview': 'Completed — Review',
  'courses.cpdPoints': 'CPD points',
  'courses.minutes': 'min',
  'courses.modules': 'modules',
  'courses.enrolled': 'enrolled',
  'courses.availableOffline': 'Available offline',
  'courses.allCategories': 'All categories',
  'courses.allTracks': 'All tracks',

  'subscription.currentPlan': 'Current plan',
  'subscription.upgrade': 'Upgrade',
  'subscription.redeemVoucher': 'Redeem a voucher',
  'subscription.expiresOn': 'Expires on',

  'points.earned': 'Earned',
  'points.required': 'Required',
  'points.renewalDeadline': 'Renewal deadline',
};

export type TranslationKey = keyof typeof en;
