
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { Provider } from 'react-redux';

import { store } from '@s/utils';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ThemeProvider from '@c/ThemeProvider';
import { useAuthState } from '@s/selectors';
import LoadingScreen from '@c/Loading';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <Provider store={store}>
          <SafeAreaProvider>
            <ThemeProvider>
              <RootStack />
            </ThemeProvider>
          </SafeAreaProvider>
      </Provider>
    </GestureHandlerRootView>
  );
}

const RootStack = () => {
  const [fontsLoaded] = useFonts({
    'FiraSans-Light': require('@a/fonts/FiraSans-Light.otf'),
    'FiraSans-Regular': require('@a/fonts/FiraSans-Regular.otf'),
    'FiraSans-Medium': require('@a/fonts/FiraSans-Medium.otf'),
    'FiraSans-SemiBold': require('@a/fonts/FiraSans-SemiBold.otf'),
    'FiraSans-Bold': require('@a/fonts/FiraSans-Bold.otf'),
    'FiraSans-LightItalic': require('@a/fonts/FiraSans-LightItalic.otf'),
    'FiraSans-Italic': require('@a/fonts/FiraSans-Italic.otf'),
    'FiraSans-MediumItalic': require('@a/fonts/FiraSans-MediumItalic.otf'),
    'FiraSans-SemiBoldItalic': require('@a/fonts/FiraSans-SemiBoldItalic.otf'),
    'FiraSans-BoldItalic': require('@a/fonts/FiraSans-BoldItalic.otf'),
    'Rubik-Light': require('@a/fonts/Rubik-Light.ttf'),
    'Rubik-Regular': require('@a/fonts/Rubik-Regular.ttf'),
    'Rubik-Medium': require('@a/fonts/Rubik-Medium.ttf'),
    'Rubik-Bold': require('@a/fonts/Rubik-Bold.ttf'),
    'Rubik-LightItalic': require('@a/fonts/Rubik-LightItalic.ttf'),
    'Rubik-Italic': require('@a/fonts/Rubik-Italic.ttf'),
    'Rubik-MediumItalic': require('@a/fonts/Rubik-MediumItalic.ttf'),
    'Rubik-BoldItalic': require('@a/fonts/Rubik-BoldItalic.ttf'),
    SpaceMono: require('@a/fonts/SpaceMono-Regular.ttf'),
  });

  const { loading, initialAuthCheckComplete } = useAuthState();

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="signout" />
        <Stack.Screen name="home" />
        <Stack.Screen name="+not-found" />
        <Stack.Screen name="measurement" />
        <Stack.Screen name="habit" />
      </Stack>
      {loading || !initialAuthCheckComplete ? <LoadingScreen /> : null}
    </>
  )
};