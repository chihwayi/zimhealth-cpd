import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../store/auth.store';
import AuthNavigator from './AuthNavigator';
import AppNavigator  from './AppNavigator';

export default function RootNavigator() {
  const { isBootstrapped, user, bootstrap } = useAuthStore();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  if (!isBootstrapped) {
    return (
      <View className="flex-1 bg-primary-500 items-center justify-center">
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return user ? <AppNavigator /> : <AuthNavigator />;
}
