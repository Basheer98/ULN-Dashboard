import type { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "ULN Field",
  slug: "uln-field",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "dark",
  backgroundColor: "#09090b",
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#09090b",
  },
  scheme: "uln-field",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.urbanlinknetworks.field",
    buildNumber: "1",
    infoPlist: {
      NSCameraUsageDescription:
        "ULN Field uses the camera to photograph expense receipts in the field.",
      NSPhotoLibraryUsageDescription:
        "ULN Field accesses your photo library so you can attach receipt images to expenses.",
      NSFaceIDUsageDescription:
        "ULN Field uses Face ID so fielders and office staff can sign in without typing a password.",
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: "com.urbanlinknetworks.field",
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#09090b",
    },
    permissions: [
      "android.permission.CAMERA",
      "android.permission.READ_MEDIA_IMAGES",
      "android.permission.POST_NOTIFICATIONS",
      "android.permission.USE_BIOMETRIC",
      "android.permission.USE_FINGERPRINT",
    ],
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-local-authentication",
      {
        faceIDPermission:
          "ULN Field uses Face ID so fielders and office staff can sign in without typing a password.",
      },
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/icon.png",
        color: "#2dd4bf",
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission:
          "Allow ULN Field to access photos for expense receipts.",
        cameraPermission:
          "Allow ULN Field to take photos of expense receipts.",
      },
    ],
    "expo-font",
  ],
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
    eas: {
      // Required for production Expo push tokens. Set via `eas init` or EAS_PROJECT_ID.
      projectId: process.env.EAS_PROJECT_ID,
    },
  },
  // Privacy policy URL for store listings (update when live)
  // privacy: "https://urbanlinknetworks.com/privacy",
});
