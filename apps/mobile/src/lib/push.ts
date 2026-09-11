import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import type { Router } from "expo-router";
import { registerPushToken } from "./api";
import { getToken } from "./auth";

function handleNotificationTap(data: Record<string, unknown> | undefined, router: Router) {
  if (!data) return;
  const type = String(data.type ?? "");
  const assignmentId = data.assignmentId ? String(data.assignmentId) : null;

  if (type === "assignment" && assignmentId) {
    router.push(`/jobs/${assignmentId}`);
    return;
  }
  if (type === "job_started" || type === "job_completed") {
    router.push("/(tabs)/inbox");
    return;
  }
  if (type === "expense_submitted" || type === "mileage_submitted") {
    router.push("/(tabs)/approvals");
    return;
  }
  if (type === "payment" || type === "payment_approved" || type === "payment_pending" || type === "payment_sent") {
    router.push("/earnings");
    return;
  }
  if (type.startsWith("expense")) {
    router.push("/(tabs)/expenses");
    return;
  }
  if (type.startsWith("mileage")) {
    router.push("/mileage");
  }
}

export function setupNotificationNavigation(router: Router) {
  const last = Notifications.getLastNotificationResponse();
  if (last) {
    handleNotificationTap(
      last.notification.request.content.data as Record<string, unknown>,
      router
    );
  }

  return Notifications.addNotificationResponseReceivedListener((response) => {
    handleNotificationTap(
      response.notification.request.content.data as Record<string, unknown>,
      router
    );
  });
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function setupPushNotifications() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("jobs", {
      name: "Job Assignments",
      importance: Notifications.AndroidImportance.MAX,
    });
    await Notifications.setNotificationChannelAsync("payments", {
      name: "Payments",
      importance: Notifications.AndroidImportance.HIGH,
    });
    await Notifications.setNotificationChannelAsync("expenses", {
      name: "Expenses & Reimbursements",
      importance: Notifications.AndroidImportance.HIGH,
    });
    await Notifications.setNotificationChannelAsync("operations", {
      name: "Operations Activity",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;

  const tokenData = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );
  const pushToken = tokenData.data;
  const authToken = await getToken();
  if (authToken && pushToken) {
    await registerPushToken(authToken, pushToken);
  }
  return pushToken;
}
