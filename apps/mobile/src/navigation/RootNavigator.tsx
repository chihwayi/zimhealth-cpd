import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuthStore } from '../store/auth.store';
import AuthNavigator    from './AuthNavigator';
import AppNavigator     from './AppNavigator';
import CreatorNavigator from './CreatorNavigator';
import CouncilNavigator from './CouncilNavigator';
import { BG, ACCENT } from '../theme';

export default function RootNavigator() {
  const { isBootstrapped, user, bootstrap } = useAuthStore();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  if (!isBootstrapped) {
    return (
      <View style={s.splash}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  if (!user) return <AuthNavigator />;

  // ── Route each role to its own interface ─────────────────────────────────
  if (user.role === 'LEARNER') {
    return <AppNavigator />;
  }

  if (user.role === 'ADMIN' || user.role === 'CONTENT_MANAGER') {
    return <CreatorNavigator />;
  }

  if (user.role === 'NCZ_OFFICER' || user.role === 'COUNCIL_OFFICER') {
    return <CouncilNavigator />;
  }

  // Fallback — unknown role, show learner app
  return <AppNavigator />;
}

const s = StyleSheet.create({
  splash: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
});
