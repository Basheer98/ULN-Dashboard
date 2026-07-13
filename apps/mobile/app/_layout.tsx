import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { ThemeProvider, DarkTheme } from "@react-navigation/native";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ErrorBoundary } from "../src/components/error-boundary";
import { initSentry } from "../src/lib/sentry";
import { setupPushNotifications, setupNotificationNavigation } from "../src/lib/push";
import { colors } from "../src/lib/theme";
import { fonts } from "../src/lib/fonts";

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent,
    background: colors.background,
    card: colors.background,
    text: colors.foreground,
    border: colors.border,
    notification: colors.accent,
  },
};

const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.foreground,
  headerTitleStyle: {
    fontFamily: fonts.semibold,
    fontSize: 17,
    color: colors.foreground,
  },
  headerShadowVisible: false,
  headerBackTitleVisible: false,
  headerBackTitle: "",
  headerBackButtonDisplayMode: "minimal" as const,
  contentStyle: { backgroundColor: colors.background },
  animation: "slide_from_right" as const,
};

export default function RootLayout() {
  const router = useRouter();
  const [loaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    initSentry();
    if (loaded) {
      setupPushNotifications().catch(() => {});
      const sub = setupNotificationNavigation(router);
      return () => sub.remove();
    }
  }, [loaded, router]);

  if (!loaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider value={navigationTheme}>
          <StatusBar style="light" />
          <Stack screenOptions={stackScreenOptions}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="jobs/[id]" options={{ title: "Job Details" }} />
            <Stack.Screen name="projects/new" options={{ title: "New Project" }} />
            <Stack.Screen name="projects/[id]" options={{ title: "Project Details" }} />
            <Stack.Screen name="projects/[id]/edit" options={{ title: "Edit Project" }} />
            <Stack.Screen name="projects/[id]/assign" options={{ title: "Assign Fielder" }} />
            <Stack.Screen name="clients/index" options={{ title: "Clients" }} />
            <Stack.Screen name="clients/new" options={{ title: "New Client" }} />
            <Stack.Screen name="clients/[id]" options={{ title: "Edit Client" }} />
            <Stack.Screen name="fielders/index" options={{ title: "Fielders" }} />
            <Stack.Screen name="fielders/new" options={{ title: "New Fielder" }} />
            <Stack.Screen name="fielders/[id]" options={{ title: "Edit Fielder" }} />
            <Stack.Screen name="schedule" options={{ title: "Schedule" }} />
            <Stack.Screen name="invoices" options={{ title: "Invoices" }} />
            <Stack.Screen name="payments" options={{ title: "Fielder Payments" }} />
            <Stack.Screen name="finance/index" options={{ title: "Finance" }} />
            <Stack.Screen name="rates" options={{ title: "State Rates" }} />
            <Stack.Screen name="team" options={{ title: "Team" }} />
            <Stack.Screen name="expenses/new" options={{ title: "Submit Expense" }} />
            <Stack.Screen name="expenses/[id]" options={{ title: "Expense Details" }} />
            <Stack.Screen name="mileage" options={{ title: "Mileage History" }} />
            <Stack.Screen name="mileage/new" options={{ title: "Log Mileage" }} />
            <Stack.Screen name="earnings" options={{ title: "Payments & Statement" }} />
            <Stack.Screen name="receipts" options={{ title: "Receipt Gallery" }} />
          </Stack>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
