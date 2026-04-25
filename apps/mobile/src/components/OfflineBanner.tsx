import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const translateY = useRef(new Animated.Value(-40)).current;

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const offline = !(state.isConnected === true && state.isInternetReachable !== false);
      setIsOffline(offline);
      Animated.spring(translateY, {
        toValue: offline ? 0 : -40,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();
    });
    return () => unsub();
  }, [translateY]);

  if (!isOffline) return null;

  return (
    <Animated.View style={[s.banner, { transform: [{ translateY }] }]}>
      <Ionicons name="cloud-offline-outline" size={13} color="#fff" />
      <Text style={s.text}>Offline — progress will sync when you reconnect</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: '#92400e',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 16,
  },
  text: { color: '#fff', fontSize: 12, fontWeight: '600', flex: 1, textAlign: 'center' },
});
