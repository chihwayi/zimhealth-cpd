import { FlatList, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { API_BASE_URL, api } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
import {
  BG, SURFACE, BORDER, TEXT, TEXT2, TEXT3,
  ACCENT, ACCENT_L, ACCENT_BG, WARN, WARN_BG,
} from '../../theme';

type Certificate = {
  id: string;
  certificateUuid: string;
  cycleYear: number;
  totalPoints: number;
  coursesCompleted: string[];
  issuedAt: string;
  pdfUrl: string | null;
  pdfKey: string | null;
};

export default function CertificatesScreen() {
  const user   = useAuthStore((s) => s.user);
  const isFree = !user?.subscriptionTier || user.subscriptionTier === 'FREE';

  const { data: certificates, isLoading, refetch } = useQuery({
    queryKey: ['certificates'],
    queryFn: () => api.get<Certificate[]>('/api/certificates'),
  });

  async function shareCertificate(cert: Certificate) {
    await Share.share({
      title: `ZimHealth CPD Certificate ${cert.cycleYear}`,
      message: `I completed my CPD requirements for ${cert.cycleYear} and earned ${cert.totalPoints} CPD points on ZimHealth!\nVerification code: ${cert.certificateUuid}`,
    });
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* ── Header ── */}
      <View style={s.header}>
        <Text style={s.title}>Certificates</Text>
        <Text style={s.subtitle}>Your completed CPD courses and earned credits.</Text>
      </View>

      {isFree ? (
        <View style={s.upgradeWrap}>
          <View style={s.upgradeIcon}>
            <Ionicons name="ribbon-outline" size={40} color={WARN} />
          </View>
          <Text style={s.upgradeTitle}>Certificate generation is a premium feature</Text>
          <Text style={s.upgradeBody}>
            Upgrade to Standard to download your official CPD certificate and have your
            points automatically submitted to your council.
          </Text>
          <Pressable
            style={s.upgradeBtn}
            onPress={() => void WebBrowser.openBrowserAsync(`${API_BASE_URL}/subscription`)}
          >
            <Ionicons name="rocket-outline" size={16} color="#fff" />
            <Text style={s.upgradeBtnText}>View upgrade options</Text>
          </Pressable>
        </View>
      ) : isLoading ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={s.skeleton} />
          ))}
        </View>
      ) : (
        <FlatList
          data={certificates ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshing={isLoading}
          onRefresh={refetch}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Ionicons name="ribbon-outline" size={56} color={TEXT3} />
              <Text style={s.emptyText}>
                No certificates yet.{'\n'}Complete a course to earn your first one.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={s.card}>
              {/* Decorative top bar */}
              <View style={s.cardTopBar} />

              <View style={s.cardBody}>
                <View style={{ flex: 1, paddingRight: 16 }}>
                  <Text style={s.cardTitle}>CPD Certificate {item.cycleYear}</Text>
                  <Text style={s.cardMeta}>
                    {item.coursesCompleted.length} course{item.coursesCompleted.length !== 1 ? 's' : ''} completed
                  </Text>
                  <Text style={s.cardDate}>
                    Issued {new Date(item.issuedAt).toLocaleDateString('en-ZW', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </Text>
                </View>

                <View style={s.pointsBadge}>
                  <Text style={s.pointsValue}>{item.totalPoints}</Text>
                  <Text style={s.pointsLabel}>CPD pts</Text>
                </View>
              </View>

              <View style={s.cardActions}>
                <Pressable
                  style={s.actionBtn}
                  onPress={() => void shareCertificate(item)}
                >
                  <Ionicons name="share-social-outline" size={16} color={ACCENT_L} />
                  <Text style={s.actionBtnText}>Share</Text>
                </Pressable>

                <View style={s.divider} />

                {item.pdfUrl ? (
                  <Pressable
                    style={s.actionBtn}
                    onPress={() => void WebBrowser.openBrowserAsync(item.pdfUrl!)}
                  >
                    <Ionicons name="cloud-download-outline" size={16} color={ACCENT_L} />
                    <Text style={s.actionBtnText}>Download PDF</Text>
                  </Pressable>
                ) : (
                  <View style={[s.actionBtn, { opacity: 0.35 }]}>
                    <Ionicons name="cloud-download-outline" size={16} color={TEXT3} />
                    <Text style={[s.actionBtnText, { color: TEXT3 }]}>No PDF yet</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  title:    { color: TEXT, fontSize: 26, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { color: TEXT3, fontSize: 13, marginTop: 4 },

  // Upgrade wall
  upgradeWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  upgradeIcon: {
    width: 88, height: 88, borderRadius: 28,
    backgroundColor: WARN_BG,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  upgradeTitle: { color: TEXT, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  upgradeBody:  { color: TEXT2, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  upgradeBtn: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: WARN,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 24,
    shadowColor: WARN,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  upgradeBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Skeleton
  skeleton: { height: 120, backgroundColor: SURFACE, borderRadius: 20 },

  // Empty
  emptyWrap: { alignItems: 'center', paddingVertical: 80 },
  emptyText: { color: TEXT3, fontSize: 13, marginTop: 16, textAlign: 'center', lineHeight: 20 },

  // Certificate card
  card: {
    backgroundColor: SURFACE,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  cardTopBar:  { height: 4, backgroundColor: ACCENT },
  cardBody:    { flexDirection: 'row', alignItems: 'flex-start', padding: 16 },
  cardTitle:   { color: TEXT, fontSize: 15, fontWeight: '700' },
  cardMeta:    { color: TEXT2, fontSize: 12, marginTop: 3 },
  cardDate:    { color: TEXT3, fontSize: 11, marginTop: 3 },
  pointsBadge: {
    backgroundColor: ACCENT_BG,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.2)',
  },
  pointsValue: { color: ACCENT_L, fontSize: 24, fontWeight: '800' },
  pointsLabel: { color: ACCENT_L, fontSize: 10, fontWeight: '600', marginTop: 2 },

  cardActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  actionBtnText: { color: ACCENT_L, fontSize: 13, fontWeight: '600' },
  divider: { width: 1, backgroundColor: BORDER },
});
