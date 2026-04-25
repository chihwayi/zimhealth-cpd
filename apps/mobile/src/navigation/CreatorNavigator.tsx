import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { BG, BORDER, ACCENT_L, TEXT3 } from '../theme';
import CreatorHomeScreen    from '../screens/creator/CreatorHomeScreen';
import CreatorCoursesScreen from '../screens/creator/CreatorCoursesScreen';
import RoleProfileScreen    from '../screens/shared/RoleProfileScreen';

export type CreatorTabParamList = {
  CreatorHomeTab:    undefined;
  CreatorCoursesTab: undefined;
  CreatorProfileTab: undefined;
};

const Tab = createBottomTabNavigator<CreatorTabParamList>();

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<keyof CreatorTabParamList, { active: IconName; inactive: IconName }> = {
  CreatorHomeTab:    { active: 'home',          inactive: 'home-outline'          },
  CreatorCoursesTab: { active: 'library',       inactive: 'library-outline'       },
  CreatorProfileTab: { active: 'person',        inactive: 'person-outline'        },
};

export default function CreatorNavigator() {
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
          const icons = TAB_ICONS[route.name as keyof CreatorTabParamList];
          return <Ionicons name={focused ? icons.active : icons.inactive} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="CreatorHomeTab"    component={CreatorHomeScreen}    options={{ title: 'Home'    }} />
      <Tab.Screen name="CreatorCoursesTab" component={CreatorCoursesScreen} options={{ title: 'Courses' }} />
      <Tab.Screen name="CreatorProfileTab" component={RoleProfileScreen}    options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}
