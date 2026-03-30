import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  ToastAndroid,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertCircle, Eye, EyeOff, Lock, Mail } from 'lucide-react-native';

import { useAuth } from '../auth/AuthContext';
import {
  Alert as AlertBanner,
  AlertDescription,
  AlertTitle,
} from '../components/ui/alert';
import { Button } from '../components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
import { Text } from '../components/ui/text';

// const TAGS = ['Water systems', 'Solar energy', 'MRV verification'] as const;

export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
      return;
    }
    Alert.alert('Login', message);
  };

  const onSubmit = async () => {
    setErrorMessage(null);
    if (!email.trim() || !password) {
      const msg = 'Please enter email and password.';
      setErrorMessage(msg);
      showToast(msg);
      return;
    }

    setSubmitting(true);
    try {
      const res = await login(email.trim(), password);
      if (!res.ok) {
        setErrorMessage(res.message);
        showToast(res.message);
        return;
      }
      setErrorMessage(null);
      showToast('Login successful.');
    } catch {
      const msg = 'Unexpected error during login.';
      setErrorMessage(msg);
      showToast(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-muted/40" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: 20,
            paddingVertical: 32,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="w-full max-w-md self-center">
            <View className="border-primary/15 bg-primary/5 mb-6 rounded-2xl border px-5 py-6 shadow-sm shadow-black/5">
              <View className="mb-4 items-center">
                <Image
                  source={require('../assets/prmsc-logo.png')}
                  className="h-28 w-56"
                  resizeMode="contain"
                />
              </View>
              <Text className="text-center text-lg font-bold tracking-tight text-foreground">
                MRV Operator
              </Text>
              <Text className="text-muted-foreground mt-1.5 text-center text-xs leading-relaxed">
                Punjab Rural Municipal Services Company
              </Text>
            </View>

            <Card className="border-border/80 overflow-hidden shadow-md shadow-black/10">
              <CardHeader className="gap-1 pb-2">
                <CardTitle className="text-center text-xl font-bold tracking-tight">
                  Operator login
                </CardTitle>
              </CardHeader>

              <CardContent className="gap-5 pt-0">
                {errorMessage ? (
                  <AlertBanner
                    icon={AlertCircle}
                    variant="destructive"
                    className="border-destructive/30"
                  >
                    <AlertTitle>Could not sign in</AlertTitle>
                    <AlertDescription>{errorMessage}</AlertDescription>
                  </AlertBanner>
                ) : null}

                <View className="gap-4">
                  <View className="gap-2">
                    <Label nativeID="email" className="text-foreground">
                      Email
                    </Label>
                    <View className="relative">
                      <View className="pointer-events-none absolute left-3 top-0 z-[1] h-12 justify-center">
                        <Mail className="text-muted-foreground" size={18} />
                      </View>
                      <Input
                        value={email}
                        onChangeText={t => {
                          setEmail(t);
                          if (errorMessage) setErrorMessage(null);
                        }}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
                        placeholder="you@example.com"
                        className="h-12 border-input bg-background pl-10"
                        accessibilityLabel="Email"
                      />
                    </View>
                  </View>

                  <View className="gap-2">
                    <Label nativeID="password" className="text-foreground">
                      Password
                    </Label>
                    <View className="relative">
                      <View className="pointer-events-none absolute left-3 top-0 z-[1] h-12 justify-center">
                        <Lock className="text-muted-foreground" size={18} />
                      </View>
                      <Input
                        value={password}
                        onChangeText={t => {
                          setPassword(t);
                          if (errorMessage) setErrorMessage(null);
                        }}
                        secureTextEntry={!showPassword}
                        placeholder="Enter your password"
                        className="h-12 border-input bg-background pl-10 pr-12"
                        accessibilityLabel="Password"
                      />
                      <Pressable
                        className="absolute right-1 top-0 z-[1] h-12 justify-center rounded-md px-3"
                        onPress={() => setShowPassword(v => !v)}
                        accessibilityRole="button"
                        accessibilityLabel={
                          showPassword ? 'Hide password' : 'Show password'
                        }
                      >
                        {showPassword ? (
                          <EyeOff className="text-muted-foreground" size={20} />
                        ) : (
                          <Eye className="text-muted-foreground" size={20} />
                        )}
                      </Pressable>
                    </View>
                  </View>
                </View>

                <Separator className="bg-border/60" />

                <Button
                  className="h-12 w-full"
                  onPress={onSubmit}
                  disabled={submitting}
                  accessibilityLabel="Sign in"
                >
                  {submitting ? (
                    <View className="flex-row items-center gap-2">
                      <ActivityIndicator color="#fff" />
                      <Text className="text-primary-foreground font-medium">
                        Signing in…
                      </Text>
                    </View>
                  ) : (
                    <Text className="text-primary-foreground font-medium">
                      Sign in
                    </Text>
                  )}
                </Button>

                <Text className="text-muted-foreground text-center text-[11px] leading-normal">
                  By continuing you agree to use this app only for authorized
                  PRMSC operator activities.
                </Text>
              </CardContent>
            </Card>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
