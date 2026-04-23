import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import DashboardScreen    from '../screens/learner/DashboardScreen';
import CoursesScreen      from '../screens/learner/CoursesScreen';
import CourseDetailScreen from '../screens/learner/CourseDetailScreen';
import CoursePlayerScreen from '../screens/learner/CoursePlayerScreen';
import CertificatesScreen from '../screens/learner/CertificatesScreen';
import ProfileScreen      from '../screens/learner/ProfileScreen';
import type { AppTabParamList, CoursesStackParamList } from './types';

const Tab   = createBottomTabNavigator<AppTabParamList>();
const Stack = createNativeStackNavigator<CoursesStackParamList>();

function CoursesStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle:     { backgroundColor: '#fff' },
        headerTintColor: '#0f766e',
        headerTitleStyle: { fontWeight: '700', color: '#0f172a' },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="CoursesList"   component={CoursesScreen}      options={{ title: 'Courses' }} />
      <Stack.Screen name="CourseDetail"  component={CourseDetailScreen}  options={{ title: '' }}        />
      <Stack.Screen name="CoursePlayer"  component={CoursePlayerScreen}  options={{ title: 'Player' }} />
    </Stack.Navigator>
  );
}

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<keyof AppTabParamList, { active: IconName; inactive: IconName }> = {
  DashboardTab:    { active: 'home',        inactive: 'home-outline'        },
  CoursesTab:      { active: 'book',        inactive: 'book-outline'        },
  CertificatesTab: { active: 'ribbon',      inactive: 'ribbon-outline'      },
  ProfileTab:      { active: 'person',      inactive: 'person-outline'      },
};

export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor:   '#0d9488',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor:  '#f1f5f9',
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
      <Tab.Screen name="DashboardTab"    component={DashboardScreen}    options={{ title: 'Home'         }} />
      <Tab.Screen name="CoursesTab"      component={CoursesStack}        options={{ title: 'Courses'      }} />
      <Tab.Screen name="CertificatesTab" component={CertificatesScreen} options={{ title: 'Certificates' }} />
      <Tab.Screen name="ProfileTab"      component={ProfileScreen}      options={{ title: 'Profile'      }} />
    </Tab.Navigator>
  );
}
