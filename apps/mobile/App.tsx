import 'react-native-url-polyfill/auto';
import './src/i18n';
import './global.css';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import OfflineBanner from './src/components/OfflineBanner';
import { ModalProvider } from './src/context/ModalContext';
import { initOfflineDB } from './src/lib/offlineDB';
import { useOnlineStatus } from './src/hooks/useOnlineStatus';
import { registerBackgroundSyncAsync } from './src/lib/backgroundSync';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5,
    },
  },
});

function AppShell() {
  useEffect(() => {
    initOfflineDB();
    void registerBackgroundSyncAsync();
  }, []);

  useOnlineStatus();

  return (
    <NavigationContainer>
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <ModalProvider>
          <AppShell />
          <OfflineBanner />
          <StatusBar style="auto" />
        </ModalProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
