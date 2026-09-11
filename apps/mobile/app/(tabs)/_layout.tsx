import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/lib/theme";
import { fonts } from "../../src/lib/fonts";
import { getUser, type MobileUser } from "../../src/lib/auth";

function tabIcon(name: keyof typeof Ionicons.glyphMap, focused: boolean) {
  return (
    <Ionicons
      name={name}
      size={22}
      color={focused ? colors.foreground : colors.mutedForeground}
    />
  );
}

export default function TabsLayout() {
  const [user, setUser] = useState<MobileUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getUser().then((savedUser) => {
      setUser(savedUser);
      setReady(true);
    });
  }, []);

  if (!ready) return null;

  const isFielder = user?.role === "fielder";
  const canApprove = user?.role === "admin" || user?.role === "accountant";

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerTitleStyle: {
          fontFamily: fonts.semibold,
          fontSize: 17,
          color: colors.foreground,
        },
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: Platform.OS === "ios" ? 84 : 64,
          paddingTop: 6,
          paddingBottom: Platform.OS === "ios" ? 24 : 8,
        },
        tabBarActiveTintColor: colors.foreground,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: {
          fontFamily: fonts.medium,
          fontSize: 10,
          lineHeight: 12,
          marginTop: 2,
        },
        tabBarIconStyle: {
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
      }}
    >
      <Tabs.Screen
        name="jobs"
        options={{
          title: "My Jobs",
          href: isFielder ? undefined : null,
          tabBarIcon: ({ focused }) =>
            tabIcon(focused ? "briefcase" : "briefcase-outline", focused),
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: "Expenses",
          href: isFielder ? undefined : null,
          tabBarIcon: ({ focused }) =>
            tabIcon(focused ? "receipt" : "receipt-outline", focused),
        }}
      />
      <Tabs.Screen
        name="monitor"
        options={{
          title: "Home",
          href: isFielder ? null : undefined,
          tabBarIcon: ({ focused }) =>
            tabIcon(focused ? "home" : "home-outline", focused),
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: "Projects",
          href: isFielder ? null : undefined,
          tabBarIcon: ({ focused }) =>
            tabIcon(focused ? "folder" : "folder-outline", focused),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: "Inbox",
          tabBarIcon: ({ focused }) =>
            tabIcon(focused ? "notifications" : "notifications-outline", focused),
        }}
      />
      <Tabs.Screen
        name="approvals"
        options={{
          title: "Approve",
          href: canApprove ? undefined : null,
          tabBarIcon: ({ focused }) =>
            tabIcon(focused ? "checkmark-done-circle" : "checkmark-done-circle-outline", focused),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          href: isFielder ? null : undefined,
          tabBarIcon: ({ focused }) =>
            tabIcon(focused ? "grid" : "grid-outline", focused),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: user?.role === "admin" ? "Owner" : "Settings",
          href: isFielder ? undefined : null,
          tabBarIcon: ({ focused }) =>
            tabIcon(focused ? "person-circle" : "person-circle-outline", focused),
        }}
      />
    </Tabs>
  );
}
