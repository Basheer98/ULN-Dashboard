import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { router, Stack } from "expo-router";
import { ExpenseListBody, useMyExpenses } from "../../src/components/expense-list";
import { screenStyles } from "../../src/lib/layout";
import { colors } from "../../src/lib/theme";
import { fonts } from "../../src/lib/fonts";
import { View } from "react-native";

export default function MyExpensesScreen() {
  const state = useMyExpenses();

  return (
    <View style={screenStyles.container}>
      <Stack.Screen
        options={{
          title: "My Expenses",
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push("/expenses/new")}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.headerBtn}
            >
              <Text style={styles.headerAction}>Submit</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <ExpenseListBody
        expenses={state.expenses}
        summary={state.summary}
        loading={state.loading}
        refreshing={state.refreshing}
        onRefresh={state.refresh}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerBtn: {
    paddingVertical: 4,
    paddingHorizontal: 2,
    marginRight: 4,
  },
  headerAction: {
    fontFamily: fonts.semibold,
    color: colors.accent,
    fontSize: 16,
    lineHeight: 20,
  },
});
