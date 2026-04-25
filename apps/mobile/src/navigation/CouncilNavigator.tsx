import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { BG, BORDER, TEXT3 } from '../theme';
import CouncilHomeScreen    from '../screens/council/CouncilHomeScreen';
import CouncilReviewsScreen from '../screens/council/CouncilReviewsScreen';
import RoleProfileScreen    from '../screens/shared/RoleProfileScreen';

export type CouncilTabParamList = {
  CouncilHomeTab:    undefined;
  CouncilReviewsTab: undefined;
  CouncilProfileTab: undefined;
};

const Tab = createBottomTabNavigator<CouncilTabParamList>();

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const PURPLE = '#a855f7';

const TAB_ICONS: Record<keyof CouncilTabParamList, { active: IconName; inactive: IconName }> = {
  CouncilHomeTab:    { active: 'home',              inactive: 'home-outline'              },
  CouncilReviewsTab: { active: 'document-text',     inactive: 'document-text-outline'     },
  CouncilProfileTab: { active: 'person',            inactive: 'person-outline'            },
};

export default function CouncilNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor:   PURPLE,
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
          const icons = TAB_ICONS[route.name as keyof CouncilTabParamList];
          return <Ionicons name={focused ? icons.active : icons.inactive} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="CouncilHomeTab"    component={CouncilHomeScreen}    options={{ title: 'Home'    }} />
      <Tab.Screen name="CouncilReviewsTab" component={CouncilReviewsScreen} options={{ title: 'Reviews' }} />
      <Tab.Screen name="CouncilProfileTab" component={RoleProfileScreen}    options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}
