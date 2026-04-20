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
import { LoginScreen } from '../features/auth/LoginScreen';
import { HomeScreen } from '../features/home/HomeScreen';
import { AssignmentsScreen } from '../features/assignments/AssignmentsScreen';
import { WaterLogScreen } from '../features/logging/WaterLogScreen';
import { DraftsScreen } from '../features/drafts/DraftsScreen';
import { SignatureScreen } from '../features/signature/SignatureScreen';
import { MySubmissionsScreen } from '../features/submissions/MySubmissionsScreen';
import { SubmissionDetailScreen } from '../features/submissions/SubmissionDetailScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const headerLeft = () => <AppHeaderLeft />;
const headerRight = () => <AppHeaderAvatar />;
const headerTitle = () => <AppHeaderTitle />;

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
                  headerLeft,
                  headerRight,
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
                  headerTitle,
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
                name="Assignments"
                component={AssignmentsScreen}
                options={{ title: 'My assignments' }}
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
                name="Drafts"
                component={DraftsScreen}
                options={{ title: 'Saved Drafts' }}
              />
              <Stack.Screen
                name="Signature"
                component={SignatureScreen}
                options={{ title: 'Signature' }}
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
