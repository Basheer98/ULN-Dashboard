import { Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";

export async function canUseBiometrics(): Promise<boolean> {
  try {
    const [hasHardware, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return hasHardware && enrolled;
  } catch {
    return false;
  }
}

export async function getBiometricLabel(): Promise<string> {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return "Face ID";
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return Platform.OS === "ios" ? "Touch ID" : "Fingerprint";
    }
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      return "Iris";
    }
  } catch {
    // Fall through to a generic label.
  }
  return "Biometrics";
}

export async function authenticateWithBiometrics(promptMessage: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: "Cancel",
      fallbackLabel: "Use Passcode",
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}
