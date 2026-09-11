interface EmailAttachment {
  filename: string;
  content: string; // base64
  contentType?: string;
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}

export async function sendEmail({ to, subject, html, attachments }: EmailOptions) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "ULN Operations <notifications@urbanlinknetworks.com>";

  if (apiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to,
          subject,
          html,
          ...(attachments?.length
            ? {
                attachments: attachments.map((a) => ({
                  filename: a.filename,
                  content: a.content,
                  content_type: a.contentType,
                })),
              }
            : {}),
        }),
      });
      return { ok: res.ok };
    } catch (err) {
      console.error("Email send failed:", err);
      return { ok: false };
    }
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[email:dev]", {
      to,
      subject,
      html: html.slice(0, 200),
      attachments: attachments?.map((a) => a.filename),
    });
  }
  return { ok: false, skipped: true };
}

export async function notifyOfficeByEmail(
  subject: string,
  body: string,
  href?: string
) {
  const officeEmail = process.env.OFFICE_NOTIFICATION_EMAIL;
  if (!officeEmail) return;

  const html = `
    <div style="font-family:sans-serif;max-width:560px">
      <p>${body}</p>
      ${href ? `<p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? ""}${href}">View in dashboard</a></p>` : ""}
    </div>
  `;
  await sendEmail({ to: officeEmail, subject: `ULN: ${subject}`, html });
}

export async function notifyUserByEmail(
  email: string | null | undefined,
  subject: string,
  body: string
) {
  if (!email) return;
  await sendEmail({
    to: email,
    subject: `ULN: ${subject}`,
    html: `<div style="font-family:sans-serif"><p>${body}</p></div>`,
  });
}
