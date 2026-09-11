import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import { ExpenseListBody, useMyExpenses } from "../../src/components/expense-list";
import { PendingSyncBanner } from "../../src/components/pending-sync-banner";
import { layout, screenStyles } from "../../src/lib/layout";
import { colors } from "../../src/lib/theme";
import { fonts } from "../../src/lib/fonts";

export default function ExpensesTabScreen() {
  const state = useMyExpenses();

  return (
    <View style={screenStyles.container}>
      <PendingSyncBanner />
      <ExpenseListBody
        expenses={state.expenses}
        summary={state.summary}
        loading={state.loading}
        refreshing={state.refreshing}
        onRefresh={state.refresh}
        listHeader={
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={() => router.push("/expenses/new")}
            activeOpacity={0.85}
          >
            <Text style={styles.submitText}>Submit expense</Text>
          </TouchableOpacity>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  submitBtn: {
    backgroundColor: colors.accent,
    borderRadius: layout.borderRadiusSm,
    minHeight: layout.buttonMinHeight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    paddingHorizontal: 16,
  },
  submitText: {
    fontFamily: fonts.semibold,
    color: colors.accentForeground,
    fontSize: 15,
    lineHeight: 20,
  },
});
