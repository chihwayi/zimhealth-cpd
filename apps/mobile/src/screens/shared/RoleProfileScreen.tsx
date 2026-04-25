import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useModal } from '../../context/ModalContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useAuthStore } from '../../store/auth.store';
import { API_BASE_URL } from '../../lib/api';
import {
  BG, SURFACE, SURFACE2, BORDER, TEXT, TEXT2, TEXT3,
  ACCENT, ACCENT_L, ACCENT_BG, DANGER, DANGER_BG,
} from '../../theme';

const ROLE_LABEL: Record<string, string> = {
  ADMIN:           'Platform Administrator',
  CONTENT_MANAGER: 'Content Creator',
  NCZ_OFFICER:     'NCZ Officer',
  COUNCIL_OFFICER: 'Council Officer',
};

const ROLE_PORTAL: Record<string, { label: string; path: string; color: string }> = {
  ADMIN:           { label: 'Creator Portal', path: '/creator',  color: ACCENT      },
  CONTENT_MANAGER: { label: 'Creator Portal', path: '/creator',  color: ACCENT      },
  NCZ_OFFICER:     { label: 'Council Portal', path: '/ncz',      color: '#7c3aed'   },
  COUNCIL_OFFICER: { label: 'Council Portal', path: '/ncz',      color: '#7c3aed'   },
};

const ROLE_ICON_COLOR: Record<string, string> = {
  ADMIN:           ACCENT_L,
  CONTENT_MANAGER: ACCENT_L,
  NCZ_OFFICER:     '#a855f7',
  COUNCIL_OFFICER: '#a855f7',
};

export default function RoleProfileScreen() {
  const { showConfirm } = useModal();
  const user      = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const role       = user?.role ?? '';
  const portal     = ROLE_PORTAL[role];
  const iconColor  = ROLE_ICON_COLOR[role] ?? ACCENT_L;

  function handleLogout() {
    showConfirm({
      type: 'danger',
      title: 'Log out',
      message: 'Are you sure you want to log out?',
      confirmLabel: 'Log out',
      onConfirm: () => void clearAuth(),
    });
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ── Avatar + Name ── */}
        <View style={s.hero}>
          <View style={[s.avatar, { borderColor: `${iconColor}33` }]}>
            <Text style={[s.avatarLetter, { color: iconColor }]}>
              {user?.fullName?.trim().charAt(0).toUpperCase() ?? '?'}
            </Text>
          </View>
          <Text style={s.fullName}>{user?.fullName ?? '—'}</Text>
          <Text style={s.email}>{user?.email ?? ''}</Text>
          <View style={[s.rolePill, { backgroundColor: `${iconColor}18`, borderColor: `${iconColor}30` }]}>
            <Ionicons
              name={role === 'NCZ_OFFICER' || role === 'COUNCIL_OFFICER' ? 'shield-checkmark-outline' : 'create-outline'}
              size={11}
              color={iconColor}
              style={{ marginRight: 4 }}
            />
            <Text style={[s.roleText, { color: iconColor }]}>
              {ROLE_LABEL[role] ?? role}
            </Text>
          </View>
        </View>

        <View style={s.body}>
          {/* ── Info rows ── */}
          <View style={s.section}>
            {[
              { icon: 'mail-outline' as const,   label: 'Email',  value: user?.email ?? '—'    },
              { icon: 'person-outline' as const, label: 'Role',   value: ROLE_LABEL[role] ?? role },
            ].map((row) => (
              <View key={row.label} style={s.infoRow}>
                <View style={s.infoIconWrap}>
                  <Ionicons name={row.icon} size={16} color={iconColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.infoLabel}>{row.label}</Text>
                  <Text style={s.infoValue}>{row.value}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* ── Open web portal ── */}
          {portal && (
            <>
              <Text style={s.sectionLabel}>Management</Text>
              <Pressable
                style={[s.portalCta, { backgroundColor: portal.color }]}
                onPress={() => void WebBrowser.openBrowserAsync(`${API_BASE_URL}${portal.path}`)}
              >
                <View style={s.portalCtaLeft}>
                  <Ionicons name="desktop-outline" size={22} color="#fff" />
                  <View>
                    <Text style={s.portalCtaTitle}>Open {portal.label}</Text>
                    <Text style={s.portalCtaDesc}>Full management tools on web</Text>
                  </View>
                </View>
                <Ionicons name="open-outline" size={18} color="rgba(255,255,255,0.7)" />
              </Pressable>
            </>
          )}

          {/* ── Logout ── */}
          <Text style={s.sectionLabel}>Account</Text>
          <Pressable style={s.logoutBtn} onPress={handleLogout}>
            <View style={s.logoutIconWrap}>
              <Ionicons name="log-out-outline" size={18} color={DANGER} />
            </View>
            <Text style={s.logoutText}>Log Out</Text>
            <Ionicons name="chevron-forward" size={16} color={DANGER} />
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

  hero: {
    alignItems: 'center',
    paddingTop: 36,
    paddingBottom: 28,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    gap: 6,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 28,
    backgroundColor: SURFACE,
    borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  avatarLetter: { fontSize: 32, fontWeight: '800' },
  fullName: { color: '#f8fafc', fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  email:    { color: TEXT3, fontSize: 13 },
  rolePill: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 4,
    borderRadius: 100,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1,
  },
  roleText: { fontSize: 11, fontWeight: '600' },

  body: { paddingHorizontal: 16, paddingTop: 24, gap: 18 },

  sectionLabel: { color: TEXT2, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.9 },

  section: {
    backgroundColor: SURFACE,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  infoIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: SURFACE2,
    alignItems: 'center', justifyContent: 'center',
  },
  infoLabel: { color: TEXT3, fontSize: 11 },
  infoValue: { color: TEXT, fontSize: 14, fontWeight: '500', marginTop: 1 },

  portalCta: {
    borderRadius: 20, padding: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  portalCtaLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  portalCtaTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  portalCtaDesc:  { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 2 },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: DANGER_BG,
    borderRadius: 16, borderWidth: 1, borderColor: `${DANGER}30`,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  logoutIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: `${DANGER}18`,
    alignItems: 'center', justifyContent: 'center',
  },
  logoutText: { flex: 1, color: DANGER, fontSize: 14, fontWeight: '600' },
});
