import { FlatList, Pressable, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';

type Certificate = {
  id: string;
  issuedAt: string;
  cpdPoints: number;
  verifyCode: string;
  course: { title: string; category: string };
};

export default function CertificatesScreen() {
  const { data: certificates, isLoading, refetch } = useQuery({
    queryKey: ['certificates'],
    queryFn: () => api.get<Certificate[]>('/api/certificates/my'),
  });

  async function shareCertificate(cert: Certificate) {
    await Share.share({
      title: `ZimHealth Certificate — ${cert.course.title}`,
      message: `I completed "${cert.course.title}" and earned ${cert.cpdPoints} CPD points on ZimHealth!\nVerification code: ${cert.verifyCode}`,
    });
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {/* ── Header ── */}
      <View className="bg-white px-5 pt-5 pb-4 border-b border-slate-100">
        <Text className="text-2xl font-bold text-slate-900">Certificates</Text>
        <Text className="text-sm text-slate-500 mt-1">
          Your completed CPD courses and earned credits.
        </Text>
      </View>

      {isLoading ? (
        <View className="px-4 pt-4 gap-y-3">
          {[1, 2, 3].map((i) => (
            <View key={i} className="h-28 bg-slate-200 rounded-3xl" />
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
            <View className="items-center py-20">
              <Ionicons name="ribbon-outline" size={56} color="#cbd5e1" />
              <Text className="text-slate-400 text-sm mt-4 text-center">
                No certificates yet.{'\n'}Complete a course to earn your first one.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Card className="gap-y-3">
              {/* Decorative top bar */}
              <View className="h-1.5 bg-primary-500 rounded-full -mt-1" />

              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-4">
                  <Badge label={item.course.category} variant="teal" />
                  <Text className="text-base font-bold text-slate-900 mt-2 leading-5">
                    {item.course.title}
                  </Text>
                  <Text className="text-xs text-slate-400 mt-1">
                    Issued {new Date(item.issuedAt).toLocaleDateString('en-ZW', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </Text>
                </View>

                <View className="items-center bg-primary-50 rounded-2xl px-3 py-2">
                  <Text className="text-2xl font-bold text-primary-600">
                    {item.cpdPoints}
                  </Text>
                  <Text className="text-xs text-primary-500 font-medium">CPD pts</Text>
                </View>
              </View>

              <View className="flex-row gap-x-2 pt-1 border-t border-slate-100">
                <Pressable
                  onPress={() => void shareCertificate(item)}
                  className="flex-1 flex-row items-center justify-center gap-x-1.5 py-2"
                >
                  <Ionicons name="share-social-outline" size={16} color="#0d9488" />
                  <Text className="text-primary-600 text-sm font-semibold">Share</Text>
                </Pressable>

                <View className="w-px bg-slate-100" />

                <Pressable className="flex-1 flex-row items-center justify-center gap-x-1.5 py-2">
                  <Ionicons name="cloud-download-outline" size={16} color="#0d9488" />
                  <Text className="text-primary-600 text-sm font-semibold">Download PDF</Text>
                </Pressable>
              </View>
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  );
}
