import { createGoogleJwtAuth } from "./google-credentials";
import { parseReceiptText, type ReceiptOcrFields } from "@uln/shared";

const VISION_SCOPE = "https://www.googleapis.com/auth/cloud-vision";

export type ReceiptOcrResult = ReceiptOcrFields & {
  ok: boolean;
  error: string | null;
};

function visionErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") return "OCR failed";
  const err = error as {
    message?: string;
    response?: { data?: { error?: { message?: string; status?: string } } };
  };
  const apiMessage = err.response?.data?.error?.message || err.message || "OCR failed";

  if (/billing/i.test(apiMessage)) {
    return "Cloud Vision requires billing enabled on the Google Cloud project. Enable billing, wait a few minutes, then retry.";
  }
  if (/PERMISSION_DENIED|403|API has not been used|not been enabled/i.test(apiMessage)) {
    return "Cloud Vision API access denied. Confirm the API is enabled for this service account's project.";
  }
  if (/credentials|GOOGLE_/i.test(apiMessage)) {
    return "Google credentials are missing or invalid for OCR.";
  }
  return apiMessage;
}

export async function extractTextFromReceiptImage(buffer: Buffer): Promise<{
  text: string;
  error: string | null;
}> {
  try {
    const { google } = await import("googleapis");
    const auth = await createGoogleJwtAuth([VISION_SCOPE]);
    const vision = google.vision({ version: "v1", auth });

    const response = await vision.images.annotate({
      requestBody: {
        requests: [
          {
            image: { content: buffer.toString("base64") },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }, { type: "TEXT_DETECTION" }],
          },
        ],
      },
    });

    const first = response.data.responses?.[0];
    if (first?.error?.message) {
      return { text: "", error: visionErrorMessage({ message: first.error.message }) };
    }

    const text =
      first?.fullTextAnnotation?.text?.trim() ||
      first?.textAnnotations?.[0]?.description?.trim() ||
      "";

    if (!text) {
      return {
        text: "",
        error: "No text detected on this receipt. Try a clearer photo or enter details manually.",
      };
    }

    return { text, error: null };
  } catch (error) {
    console.warn("Google Vision OCR unavailable:", error);
    return { text: "", error: visionErrorMessage(error) };
  }
}

export async function scanReceiptImage(buffer: Buffer): Promise<ReceiptOcrResult> {
  const { text, error } = await extractTextFromReceiptImage(buffer);
  if (!text) {
    return {
      ok: false,
      error,
      amount: null,
      transactionDate: null,
      vendorName: null,
      rawText: "",
    };
  }

  const parsed = parseReceiptText(text);
  const missingFields = !parsed.amount && !parsed.transactionDate && !parsed.vendorName;
  return {
    ok: true,
    error: missingFields
      ? "Text found, but amount/date/vendor could not be parsed automatically. Fill in manually."
      : null,
    ...parsed,
  };
}
