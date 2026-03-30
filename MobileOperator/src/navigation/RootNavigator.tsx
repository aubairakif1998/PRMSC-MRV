import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '../auth/AuthContext';
import {
  AppDrawerProvider,
  AppHeaderAvatar,
  AppHeaderLeft,
  AppHeaderTitle,
} from './AppDrawer';
import { navigationRef } from './navigationRef';
import type { RootStackParamList } from './types';
import { LoginScreen } from '../screens/LoginScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { WaterSystemRegisterScreen } from '../screens/WaterSystemRegisterScreen';
import { SolarSystemRegisterScreen } from '../screens/SolarSystemRegisterScreen';
import { WaterLogScreen } from '../screens/WaterLogScreen';
import { SolarLogScreen } from '../screens/SolarLogScreen';
import { DraftsScreen } from '../screens/DraftsScreen';
import { MySubmissionsScreen } from '../screens/MySubmissionsScreen';
import { SubmissionDetailScreen } from '../screens/SubmissionDetailScreen';
import { PickFacilityScreen } from '../screens/PickFacilityScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { token, loading } = useAuth();

  if (loading) return null;

  return (
    <NavigationContainer ref={navigationRef}>
      <AppDrawerProvider>
        <Stack.Navigator
          screenOptions={
            token
              ? {
                  headerLeft: () => <AppHeaderLeft />,
                  headerRight: () => <AppHeaderAvatar />,
                  headerTitleAlign: 'center',
                }
              : undefined
          }
        >
          {!token ? (
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
          ) : (
            <>
              <Stack.Screen
                name="Home"
                component={HomeScreen}
                options={{
                  headerTitle: () => <AppHeaderTitle />,
                  headerTitleAlign: 'center',
                  // headerTitleContainerStyle: {
                  //   position: 'absolute',
                  //   left: 0,
                  //   right: 0,
                  //   alignItems: 'center',
                  //   justifyContent: 'center',
                  // },
                }}
              />
              <Stack.Screen
                name="WaterSystemRegister"
                component={WaterSystemRegisterScreen}
                options={{ title: 'Register water system' }}
              />
              <Stack.Screen
                name="SolarSystemRegister"
                component={SolarSystemRegisterScreen}
                options={{ title: 'Register solar site' }}
              />
              <Stack.Screen
                name="PickFacility"
                component={PickFacilityScreen}
                options={({ route }) => ({
                  title:
                    route.params.kind === 'water'
                      ? 'Quick log — water'
                      : 'Quick log — solar',
                })}
              />
              <Stack.Screen
                name="WaterLog"
                component={WaterLogScreen}
                options={{ title: 'Water monthly log' }}
                getId={({ params }) =>
                  params?.systemId != null && params.systemId !== ''
                    ? `water-log-sys-${String(params.systemId)}`
                    : params?.draftId
                    ? `water-log-draft-${params.draftId}`
                    : 'water-log-new'
                }
              />
              <Stack.Screen
                name="SolarLog"
                component={SolarLogScreen}
                options={{ title: 'Solar monthly log' }}
                getId={({ params }) =>
                  params?.systemId != null && params.systemId !== ''
                    ? `solar-log-sys-${String(params.systemId)}`
                    : params?.draftId
                    ? `solar-log-draft-${params.draftId}`
                    : 'solar-log-new'
                }
              />
              <Stack.Screen
                name="Drafts"
                component={DraftsScreen}
                options={{ title: 'Saved Drafts' }}
              />
              <Stack.Screen
                name="MySubmissions"
                component={MySubmissionsScreen}
                options={{ title: 'My Submissions' }}
              />
              <Stack.Screen
                name="SubmissionDetail"
                component={SubmissionDetailScreen}
                options={{ title: 'Submission details' }}
              />
            </>
          )}
        </Stack.Navigator>
      </AppDrawerProvider>
    </NavigationContainer>
  );
}
