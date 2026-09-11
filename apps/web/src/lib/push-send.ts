export async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
) {
  if (!pushToken.startsWith("ExponentPushToken")) {
    return { ok: false, reason: "invalid token" };
  }

  const channelId = data?.channelId;
  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        to: pushToken,
        title,
        body,
        data: data ?? {},
        sound: "default",
        ...(channelId ? { channelId } : {}),
      }),
    });

    const json = await res.json();
    return { ok: res.ok, result: json };
  } catch (err) {
    console.error("Push notification failed:", err);
    return { ok: false, reason: "network error" };
  }
}
