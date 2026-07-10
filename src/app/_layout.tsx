import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useColorScheme } from "react-native";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import AppTabs from "@/components/app-tabs";
import LoginScreen from "@/components/login-screen";
import { AuthProvider, useAuth } from "@/hooks/use-auth";

SplashScreen.preventAutoHideAsync();

function RootContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <ThemeProvider value={DefaultTheme}>
        <AnimatedSplashOverlay />
      </ThemeProvider>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return <AppTabs />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <RootContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
