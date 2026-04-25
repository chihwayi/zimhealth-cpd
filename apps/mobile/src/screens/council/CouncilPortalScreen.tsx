import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useModal } from '../../context/ModalContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { api, API_BASE_URL } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
import {
  BG, SURFACE, SURFACE2, BORDER, TEXT, TEXT2, TEXT3,
  ACCENT, ACCENT_L, ACCENT_BG, SUCCESS, WARN,
} from '../../theme';

type LearnerListResponse = {
  learners: Array<{
    id: string;
    fullName: string;
    cadre: string | null;
    nczRegistrationNumber: string | null;
    totalPoints?: number;
  }>;
  total: number;
  page: number;
  totalPages: number;
};

type ReviewsResponse = {
  reviews: Array<{
    id: string;
    status: string;
    course: { id: string; title: string; category: string };
    reviewedBy: { fullName: string } | null;
  }>;
};

const STATUS_COLOR: Record<string, string> = {
  APPROVED: SUCCESS,
  PENDING:  WARN,
  REJECTED: '#ef4444',
};

export default function CouncilPortalScreen() {
  const { showConfirm } = useModal();
  const user      = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const { data: learnersData, isLoading: learnersLoading } = useQuery({
    queryKey: ['ncz-learners'],
    queryFn: () => api.get<LearnerListResponse>('/api/ncz/learners?limit=5'),
  });

  const { data: reviewsData, isLoading: reviewsLoading } = useQuery({
    queryKey: ['ncz-reviews'],
    queryFn: () => api.get<ReviewsResponse>('/api/ncz/courses/reviews?limit=5'),
  });

  function handleLogout() {
    showConfirm({
      type: 'danger',
      title: 'Log out',
      message: 'Are you sure you want to log out?',
      confirmLabel: 'Log out',
      onConfirm: () => void clearAuth(),
    });
  }

  const pendingCount = reviewsData?.reviews.filter((r) => r.status === 'PENDING').length ?? 0;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.greeting}>Welcome back,</Text>
            <Text style={s.name} numberOfLines={1}>{user?.fullName}</Text>
            <View style={s.rolePill}>
              <Ionicons name="shield-checkmark-outline" size={11} color="#a855f7" style={{ marginRight: 4 }} />
              <Text style={[s.roleText, { color: '#a855f7' }]}>Council Officer</Text>
            </View>
          </View>
          <Pressable style={s.logoutBtn} onPress={handleLogout} hitSlop={8}>
            <Ionicons name="log-out-outline" size={20} color={TEXT3} />
          </Pressable>
        </View>

        <View style={s.body}>
          {/* ── Web portal CTA ── */}
          <Pressable
            style={[s.webCta, { backgroundColor: '#7c3aed' }]}
            onPress={() => void WebBrowser.openBrowserAsync(API_BASE_URL)}
          >
            <View style={s.webCtaLeft}>
              <Ionicons name="shield-checkmark" size={22} color="#fff" />
              <View>
                <Text style={s.webCtaTitle}>Open Council Portal</Text>
                <Text style={s.webCtaDesc}>Review courses, manage learners, sync certificates</Text>
              </View>
            </View>
            <Ionicons name="open-outline" size={18} color="rgba(255,255,255,0.7)" />
          </Pressable>

          {/* ── Stats ── */}
          <Text style={s.sectionLabel}>Overview</Text>
          <View style={s.statsGrid}>
            <View style={s.statCard}>
              <View style={[s.statIconWrap, { backgroundColor: `${ACCENT_L}1a` }]}>
                <Ionicons name="people-outline" size={20} color={ACCENT_L} />
              </View>
              <Text style={s.statValue}>
                {learnersLoading ? '…' : (learnersData?.total ?? 0)}
              </Text>
              <Text style={s.statLabel}>Registered Professionals</Text>
            </View>

            <View style={s.statCard}>
              <View style={[s.statIconWrap, { backgroundColor: `${WARN}1a` }]}>
                <Ionicons name="time-outline" size={20} color={WARN} />
              </View>
              <Text style={[s.statValue, pendingCount > 0 && { color: WARN }]}>
                {reviewsLoading ? '…' : pendingCount}
              </Text>
              <Text style={s.statLabel}>Pending Reviews</Text>
            </View>
          </View>

          {/* ── Pending course reviews ── */}
          <Text style={s.sectionLabel}>Course Reviews</Text>
          {reviewsLoading ? (
            <View style={{ gap: 8 }}>
              {[1, 2].map((i) => <View key={i} style={s.rowSkeleton} />)}
            </View>
          ) : !reviewsData?.reviews.length ? (
            <View style={[s.card, { alignItems: 'center', paddingVertical: 24 }]}>
              <Ionicons name="checkmark-circle-outline" size={36} color={SUCCESS} />
              <Text style={[s.statLabel, { marginTop: 8, textAlign: 'center' }]}>
                No pending reviews. All courses are up to date.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {reviewsData.reviews.map((review) => (
                <View key={review.id} style={s.reviewRow}>
                  <View style={s.reviewIconWrap}>
                    <Ionicons name="document-text-outline" size={18} color="#a855f7" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.courseTitle} numberOfLines={1}>{review.course.title}</Text>
                    <Text style={s.courseCategory}>{review.course.category}</Text>
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: `${STATUS_COLOR[review.status] ?? TEXT3}1a` }]}>
                    <Text style={[s.statusText, { color: STATUS_COLOR[review.status] ?? TEXT3 }]}>
                      {review.status}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ── Recent learners ── */}
          <Text style={s.sectionLabel}>Recent Professionals</Text>
          {learnersLoading ? (
            <View style={{ gap: 8 }}>
              {[1, 2, 3].map((i) => <View key={i} style={s.rowSkeleton} />)}
            </View>
          ) : !learnersData?.learners.length ? (
            <View style={[s.card, { alignItems: 'center', paddingVertical: 24 }]}>
              <Text style={s.statLabel}>No learners found for your council.</Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {learnersData.learners.map((learner) => (
                <View key={learner.id} style={s.learnerRow}>
                  <View style={s.learnerAvatar}>
                    <Text style={s.learnerInitial}>
                      {learner.fullName.trim().charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.courseTitle} numberOfLines={1}>{learner.fullName}</Text>
                    <Text style={s.courseCategory}>
                      {learner.cadre ?? 'Unknown cadre'}{learner.nczRegistrationNumber ? ` · ${learner.nczRegistrationNumber}` : ''}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ── Quick links ── */}
          <Text style={s.sectionLabel}>Quick Actions</Text>
          <View style={{ gap: 8 }}>
            {[
              { icon: 'people-outline'          as const, label: 'Manage learners',         path: '/ncz' },
              { icon: 'document-text-outline'   as const, label: 'Review courses',           path: '/ncz/courses' },
              { icon: 'ribbon-outline'          as const, label: 'Certificate verification', path: '/verify' },
              { icon: 'sync-outline'            as const, label: 'Sync logs',                path: '/ncz/sync' },
            ].map((item) => (
              <Pressable
                key={item.path}
                style={s.quickRow}
                onPress={() => void WebBrowser.openBrowserAsync(`${API_BASE_URL}${item.path}`)}
              >
                <View style={[s.quickIconWrap, { backgroundColor: 'rgba(168,85,247,0.12)' }]}>
                  <Ionicons name={item.icon} size={18} color="#a855f7" />
                </View>
                <Text style={s.quickLabel}>{item.label}</Text>
                <Ionicons name="open-outline" size={14} color={TEXT3} />
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  greeting: { color: TEXT3, fontSize: 13 },
  name: { color: TEXT, fontSize: 24, fontWeight: '800', letterSpacing: -0.3, marginTop: 2 },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: 'rgba(168,85,247,0.12)',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.25)',
  },
  roleText: { fontSize: 11, fontWeight: '600' },
  logoutBtn: {
    width: 40, height: 40,
    backgroundColor: SURFACE,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },

  body: { paddingHorizontal: 16, paddingTop: 20, gap: 20 },

  webCta: {
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  webCtaLeft:  { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  webCtaTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  webCtaDesc:  { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 2 },

  sectionLabel: { color: TEXT2, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },

  statsGrid: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: SURFACE,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    gap: 6,
  },
  statIconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statValue: { color: TEXT, fontSize: 26, fontWeight: '800' },
  statLabel: { color: TEXT3, fontSize: 12 },

  card: {
    backgroundColor: SURFACE,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
  },
  rowSkeleton: { height: 60, backgroundColor: SURFACE, borderRadius: 16 },

  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: SURFACE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
  },
  reviewIconWrap: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: 'rgba(168,85,247,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  courseTitle:    { color: TEXT, fontSize: 13, fontWeight: '600' },
  courseCategory: { color: TEXT3, fontSize: 11, marginTop: 2 },
  statusBadge:    { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusText:     { fontSize: 10, fontWeight: '700' },

  learnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: SURFACE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
  },
  learnerAvatar: {
    width: 40, height: 40, borderRadius: 14,
    backgroundColor: ACCENT_BG,
    alignItems: 'center', justifyContent: 'center',
  },
  learnerInitial: { color: ACCENT_L, fontSize: 16, fontWeight: '800' },

  quickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: SURFACE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  quickIconWrap: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { flex: 1, color: TEXT, fontSize: 14, fontWeight: '500' },
});
