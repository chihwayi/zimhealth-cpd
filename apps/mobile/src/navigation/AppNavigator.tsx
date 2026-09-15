import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { BG, SURFACE2, BORDER, ACCENT_L, TEXT3 } from '../theme';
import DashboardScreen    from '../screens/learner/DashboardScreen';
import CoursesScreen      from '../screens/learner/CoursesScreen';
import CourseDetailScreen from '../screens/learner/CourseDetailScreen';
import CoursePlayerScreen from '../screens/learner/CoursePlayerScreen';
import PointsScreen       from '../screens/learner/PointsScreen';
import CertificatesScreen from '../screens/learner/CertificatesScreen';
import ProfileScreen      from '../screens/learner/ProfileScreen';
import SubscriptionScreen from '../screens/learner/SubscriptionScreen';
import type { AppTabParamList, CoursesStackParamList, ProfileStackParamList } from './types';

const Tab   = createBottomTabNavigator<AppTabParamList>();
const Stack = createNativeStackNavigator<CoursesStackParamList>();
const ProfileStackNav = createNativeStackNavigator<ProfileStackParamList>();

function CoursesStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle:     { backgroundColor: BG },
        headerTintColor: ACCENT_L,
        headerTitleStyle: { fontWeight: '700', color: '#f8fafc' },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="CoursesList"   component={CoursesScreen}      options={{ title: 'Courses' }} />
      <Stack.Screen name="CourseDetail"  component={CourseDetailScreen}  options={{ title: '' }}        />
      <Stack.Screen name="CoursePlayer"  component={CoursePlayerScreen}  options={{ title: 'Player' }} />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <ProfileStackNav.Navigator
      screenOptions={{
        headerStyle:     { backgroundColor: BG },
        headerTintColor: ACCENT_L,
        headerTitleStyle: { fontWeight: '700', color: '#f8fafc' },
        headerShadowVisible: false,
      }}
    >
      <ProfileStackNav.Screen
        name="ProfileHome"
        component={ProfileScreen}
        options={{ title: 'Profile', headerShown: false }}
      />
      <ProfileStackNav.Screen
        name="Subscription"
        component={SubscriptionScreen}
        options={{ title: 'Subscription' }}
      />
    </ProfileStackNav.Navigator>
  );
}

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<keyof AppTabParamList, { active: IconName; inactive: IconName }> = {
  DashboardTab:    { active: 'home',        inactive: 'home-outline'        },
  CoursesTab:      { active: 'book',        inactive: 'book-outline'        },
  PointsTab:       { active: 'trophy',      inactive: 'trophy-outline'      },
  CertificatesTab: { active: 'ribbon',      inactive: 'ribbon-outline'      },
  ProfileTab:      { active: 'person',      inactive: 'person-outline'      },
};

export default function AppNavigator() {
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor:   ACCENT_L,
        tabBarInactiveTintColor: TEXT3,
        tabBarStyle: {
          backgroundColor: BG,
          borderTopColor:  BORDER,
          borderTopWidth:  1,
          paddingBottom:   4,
          height:          60,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name as keyof AppTabParamList];
          return (
            <Ionicons
              name={focused ? icons.active : icons.inactive}
              size={size}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen name="DashboardTab"    component={DashboardScreen}    options={{ title: t('nav.dashboard')      }} />
      <Tab.Screen name="CoursesTab"      component={CoursesStack}        options={{ title: t('nav.browseCourses')  }} />
      <Tab.Screen name="PointsTab"       component={PointsScreen}       options={{ title: t('nav.myPoints')       }} />
      <Tab.Screen name="CertificatesTab" component={CertificatesScreen} options={{ title: t('nav.certificates')   }} />
      <Tab.Screen name="ProfileTab"      component={ProfileStack}       options={{ title: t('nav.profile')        }} />
    </Tab.Navigator>
  );
}
