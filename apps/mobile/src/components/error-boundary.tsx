import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { captureError } from "../lib/sentry";
import { colors } from "../lib/theme";
import { fonts } from "../lib/fonts";

type Props = { children: React.ReactNode };
type State = { hasError: boolean; message?: string };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error) {
    captureError(error);
    console.error("Mobile app error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body}>
            This screen hit an error. Go back or try again — the rest of the app should still work.
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => this.setState({ hasError: false, message: undefined })}
          >
            <Text style={styles.buttonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 20,
    color: colors.foreground,
    marginBottom: 8,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  button: {
    backgroundColor: colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.background,
  },
});
