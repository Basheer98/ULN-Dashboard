import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getUser, type MobileUser } from "../../src/lib/auth";
import { hasPermission } from "../../src/lib/permissions";
import { colors } from "../../src/lib/theme";
import { fonts } from "../../src/lib/fonts";
import { screenStyles, textStyles } from "../../src/lib/layout";

interface MenuItem {
  title: string;
  desc: string;
  route: string;
  permission?: Parameters<typeof hasPermission>[1];
}

const MENU: MenuItem[] = [
  { title: "Clients", desc: "View and manage client accounts", route: "/clients", permission: "clients:read" },
  { title: "Fielders", desc: "View and manage field technicians", route: "/fielders", permission: "fielders:read" },
  { title: "Schedule", desc: "Upcoming ECD calendar", route: "/schedule", permission: "schedule:read" },
  { title: "Invoices", desc: "Client billing and invoice status", route: "/invoices", permission: "invoices:read" },
  { title: "Fielder Payments", desc: "Payouts and payment status", route: "/payments", permission: "payments:read" },
  { title: "Finance", desc: "Expenses, income, and cashflow", route: "/finance", permission: "finance:read" },
  { title: "State Rates", desc: "SQFT rate overrides by state", route: "/rates", permission: "rates:read" },
  { title: "Team", desc: "Office user accounts", route: "/team", permission: "users:read" },
  { title: "Add Spending", desc: "Record company expense with receipt", route: "/expenses/new" },
  { title: "Settings", desc: "Account and sign out", route: "/(tabs)/settings" },
];

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  title: {
    fontFamily: fonts.semibold,
    color: colors.foreground,
    fontSize: 16,
    lineHeight: 22,
  },
  desc: {
    fontFamily: fonts.regular,
    color: colors.mutedForeground,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
});

export default function MoreScreen() {
  const [user, setUser] = useState<MobileUser | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      getUser().then((u) => {
        setUser(u);
        setLoading(false);
      });
    }, [])
  );

  if (loading) {
    return (
      <View style={screenStyles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const items = MENU.filter(
    (item) => !item.permission || hasPermission(user?.role, item.permission)
  );

  return (
    <ScrollView style={screenStyles.container} contentContainerStyle={screenStyles.content}>
      <Text style={textStyles.heading}>Office tools</Text>
      <Text style={[textStyles.subheading, { marginBottom: 18 }]}>
        Full dashboard features on mobile.
      </Text>
      {items.map((item) => (
        <TouchableOpacity
          key={item.route}
          style={styles.card}
          onPress={() => router.push(item.route as never)}
          activeOpacity={0.8}
        >
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.desc}>{item.desc}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}
