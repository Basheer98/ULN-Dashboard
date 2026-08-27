import { FINANCE_SETTING_KEYS } from "./finance";

export interface ReceiptOcrFields {
  amount: number | null;
  transactionDate: string | null;
  vendorName: string | null;
  rawText: string;
}

const AMOUNT_LABELS = [
  "amount due",
  "total due",
  "grand total",
  "total",
  "balance due",
  "subtotal",
];

const DATE_PATTERNS = [
  /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/,
  /(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/,
];

function parseMoneyToken(token: string): number | null {
  const cleaned = token.replace(/[^0-9.,-]/g, "");
  if (!cleaned) return null;
  const normalized =
    cleaned.includes(",") && cleaned.includes(".")
      ? cleaned.replace(/,/g, "")
      : cleaned.replace(/,/g, ".");
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value <= 0 || value > 1_000_000) return null;
  return Math.round(value * 100) / 100;
}

function toIsoDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const fullYear = year < 100 ? 2000 + year : year;
  const iso = `${fullYear.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
  const parsed = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return iso;
}

export function parseReceiptDateFromText(text: string): string | null {
  const lower = text.toLowerCase();
  for (const pattern of DATE_PATTERNS) {
    const match = lower.match(pattern);
    if (!match) continue;
    if (match[1]!.length === 4) {
      const iso = toIsoDate(Number(match[1]), Number(match[2]), Number(match[3]));
      if (iso) return iso;
    } else {
      const month = Number(match[1]);
      const day = Number(match[2]);
      const year = Number(match[3]);
      const iso = toIsoDate(year, month, day);
      if (iso) return iso;
    }
  }
  return null;
}

export function parseReceiptAmountFromText(text: string): number | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const labeled: number[] = [];
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (!AMOUNT_LABELS.some((label) => lower.includes(label))) continue;
    const matches = line.match(/\$?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+\.[0-9]{2})/g);
    if (!matches) continue;
    for (const match of matches) {
      const value = parseMoneyToken(match);
      if (value !== null) labeled.push(value);
    }
  }
  if (labeled.length > 0) return Math.max(...labeled);

  const allAmounts: number[] = [];
  const amountRegex = /\$?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+\.[0-9]{2})/g;
  for (const line of lines) {
    for (const match of line.matchAll(amountRegex)) {
      const value = parseMoneyToken(match[0]);
      if (value !== null) allAmounts.push(value);
    }
  }
  if (allAmounts.length === 0) return null;
  return Math.max(...allAmounts);
}

export function parseReceiptVendorFromText(text: string): string | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines.slice(0, 6)) {
    if (line.length < 3 || line.length > 60) continue;
    if (/^\d+$/.test(line)) continue;
    if (/^(receipt|invoice|order|store|tel|phone|www\.|http)/i.test(line)) continue;
    if (/^\d{1,2}[\/\-.]\d{1,2}/.test(line)) continue;
    return line;
  }
  return null;
}

export function parseReceiptText(rawText: string): ReceiptOcrFields {
  const normalized = rawText.replace(/\s+/g, " ").trim();
  return {
    amount: parseReceiptAmountFromText(rawText),
    transactionDate: parseReceiptDateFromText(rawText),
    vendorName: parseReceiptVendorFromText(rawText),
    rawText: normalized,
  };
}

export interface ExpensePolicyContext {
  amount: number;
  expenseStatus: string;
  hasReceipt: boolean;
  receiptRequiredAbove: number;
  expenseReviewAbove: number;
  duplicateCount?: number;
  acknowledgeDuplicate?: boolean;
}

export interface ExpensePolicyResult {
  blocked: boolean;
  blockReason?: string;
  warnings: string[];
  resolvedStatus: string;
  reviewReason: string | null;
}

export function evaluateExpensePolicy(ctx: ExpensePolicyContext): ExpensePolicyResult {
  const warnings: string[] = [];
  let blocked = false;
  let blockReason: string | undefined;
  let resolvedStatus = ctx.expenseStatus;
  let reviewReason: string | null = null;

  const isSubmitting = !["draft", "voided"].includes(ctx.expenseStatus);
  // Don't demote expenses that finance already marked approved/paid/reimbursed.
  // Only escalate when entering the approval queue.
  const canEscalateReview = ["submitted", "pending_review"].includes(ctx.expenseStatus);

  if (
    isSubmitting &&
    ctx.amount >= ctx.receiptRequiredAbove &&
    !ctx.hasReceipt
  ) {
    blocked = true;
    blockReason = `Receipt required for expenses of $${ctx.receiptRequiredAbove.toFixed(2)} or more.`;
  }

  if (canEscalateReview && ctx.amount >= ctx.expenseReviewAbove) {
    resolvedStatus = "pending_review";
    reviewReason = `Amount exceeds review threshold ($${ctx.expenseReviewAbove.toFixed(2)}).`;
    warnings.push(reviewReason);
  }

  if ((ctx.duplicateCount ?? 0) > 0) {
    const duplicateWarning = `Possible duplicate expense detected (${ctx.duplicateCount} similar).`;
    warnings.push(duplicateWarning);
    if (isSubmitting && !ctx.acknowledgeDuplicate) {
      blocked = true;
      blockReason = `${duplicateWarning} Confirm to continue.`;
    }
  }

  return {
    blocked,
    blockReason,
    warnings,
    resolvedStatus,
    reviewReason,
  };
}

export interface CategoryOption {
  id: string;
  name: string;
}

export interface VendorOption {
  id: string;
  name: string;
  defaultCategoryId?: string | null;
}

export interface CategorySuggestion {
  categoryId: string | null;
  vendorId: string | null;
  confidence: "high" | "medium" | "low";
  reason: string;
}

export const CATEGORY_KEYWORD_RULES: Array<{ keywords: string[]; categoryNames: string[] }> = [
  { keywords: ["fuel", "gas", "diesel", "shell", "chevron", "exxon", "bp "], categoryNames: ["Fuel", "Vehicle", "Transportation"] },
  { keywords: ["home depot", "lowes", "lowe's", "hardware", "supply"], categoryNames: ["Materials", "Supplies", "Hardware"] },
  { keywords: ["hotel", "motel", "lodging", "airbnb", "marriott", "hilton"], categoryNames: ["Lodging", "Travel"] },
  { keywords: ["uber", "lyft", "taxi", "parking", "toll"], categoryNames: ["Travel", "Transportation", "Vehicle"] },
  { keywords: ["restaurant", "cafe", "coffee", "starbucks", "mcdonald", "subway"], categoryNames: ["Meals", "Food"] },
  { keywords: ["at&t", "verizon", "t-mobile", "comcast", "internet", "phone bill"], categoryNames: ["Utilities", "Telecom"] },
  { keywords: ["amazon", "staples", "office depot"], categoryNames: ["Office", "Supplies"] },
];

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function findCategoryByNames(categories: CategoryOption[], names: string[]): string | null {
  const normalizedCategories = categories.map((c) => ({
    id: c.id,
    name: normalizeText(c.name),
  }));
  for (const name of names) {
    const target = normalizeText(name);
    const exact = normalizedCategories.find((c) => c.name === target);
    if (exact) return exact.id;
    const partial = normalizedCategories.find((c) => c.name.includes(target) || target.includes(c.name));
    if (partial) return partial.id;
  }
  return null;
}

export function suggestCategory({
  description,
  vendorName,
  vendorId,
  categories,
  vendors,
  history,
}: {
  description?: string | null;
  vendorName?: string | null;
  vendorId?: string | null;
  categories: CategoryOption[];
  vendors: VendorOption[];
  history: Array<{ categoryId: string | null; description: string | null; vendorId: string | null }>;
}): CategorySuggestion {
  const text = normalizeText(`${description ?? ""} ${vendorName ?? ""}`);

  if (vendorId) {
    const vendor = vendors.find((v) => v.id === vendorId);
    if (vendor?.defaultCategoryId) {
      return {
        categoryId: vendor.defaultCategoryId,
        vendorId,
        confidence: "high",
        reason: `Vendor default category (${vendor.name})`,
      };
    }
  }

  if (vendorName) {
    const normalizedVendor = normalizeText(vendorName);
    const vendorMatch = vendors.find((v) => {
      const name = normalizeText(v.name);
      return name === normalizedVendor || name.includes(normalizedVendor) || normalizedVendor.includes(name);
    });
    if (vendorMatch?.defaultCategoryId) {
      return {
        categoryId: vendorMatch.defaultCategoryId,
        vendorId: vendorMatch.id,
        confidence: "high",
        reason: `Matched vendor "${vendorMatch.name}"`,
      };
    }
    if (vendorMatch) {
      return {
        categoryId: null,
        vendorId: vendorMatch.id,
        confidence: "medium",
        reason: `Matched vendor "${vendorMatch.name}"`,
      };
    }
  }

  for (const rule of CATEGORY_KEYWORD_RULES) {
    if (!rule.keywords.some((keyword) => text.includes(keyword))) continue;
    const categoryId = findCategoryByNames(categories, rule.categoryNames);
    if (categoryId) {
      return {
        categoryId,
        vendorId: vendorId ?? null,
        confidence: "medium",
        reason: "Keyword match",
      };
    }
  }

  const historyMatch = history.find((entry) => {
    if (vendorId && entry.vendorId === vendorId && entry.categoryId) return true;
    if (!text || !entry.description) return false;
    const entryText = normalizeText(entry.description);
    return entryText.length > 3 && (text.includes(entryText) || entryText.includes(text));
  });
  if (historyMatch?.categoryId) {
    return {
      categoryId: historyMatch.categoryId,
      vendorId: vendorId ?? historyMatch.vendorId,
      confidence: "medium",
      reason: "Based on your recent expenses",
    };
  }

  return {
    categoryId: null,
    vendorId: vendorId ?? null,
    confidence: "low",
    reason: "No strong category match",
  };
}

export interface ExistingExpense {
  id: string;
  transactionNumber: string;
  amount: number;
  transactionDate: string;
  description: string | null;
  fielderId: string | null;
}

export interface ExpenseDuplicateMatch {
  id: string;
  transactionNumber: string;
  amount: number;
  transactionDate: string;
  description: string | null;
  confidence: "exact" | "likely";
}

function dayDiff(a: string, b: string): number {
  const da = new Date(`${a.slice(0, 10)}T12:00:00Z`).getTime();
  const db = new Date(`${b.slice(0, 10)}T12:00:00Z`).getTime();
  return Math.abs(Math.round((da - db) / (24 * 60 * 60 * 1000)));
}

export function findDuplicateExpenses(
  input: { amount: number; transactionDate: string; fielderId: string | null },
  existing: ExistingExpense[],
  excludeId?: string
): ExpenseDuplicateMatch[] {
  const matches: ExpenseDuplicateMatch[] = [];
  const targetDate = input.transactionDate.slice(0, 10);

  for (const expense of existing) {
    if (excludeId && expense.id === excludeId) continue;
    if (input.fielderId && expense.fielderId !== input.fielderId) continue;
    if (Math.abs(expense.amount - input.amount) > 0.009) continue;

    const diff = dayDiff(targetDate, expense.transactionDate);
    if (diff > 1) continue;

    matches.push({
      id: expense.id,
      transactionNumber: expense.transactionNumber,
      amount: expense.amount,
      transactionDate: expense.transactionDate.slice(0, 10),
      description: expense.description,
      confidence: diff === 0 ? "exact" : "likely",
    });
  }

  return matches.sort((a, b) => {
    if (a.confidence === b.confidence) return 0;
    return a.confidence === "exact" ? -1 : 1;
  });
}

export function parseFinanceThreshold(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export interface ApprovalPriorityInput {
  id: string;
  amount: number;
  status: string | null;
  createdAt: string;
  hasReceipt?: boolean;
  isDuplicate?: boolean;
  receiptPendingVerify?: boolean;
}

export interface ApprovalPriorityResult {
  score: number;
  reasons: string[];
}

/**
 * Higher score = review sooner.
 * Weights: pending_review, missing receipt, duplicate, unverified receipt, dollar amount, age.
 */
export function scoreApprovalPriority(item: ApprovalPriorityInput): ApprovalPriorityResult {
  let score = 0;
  const reasons: string[] = [];

  if (item.status === "pending_review") {
    score += 100;
    reasons.push("Needs review");
  }
  if (item.isDuplicate) {
    score += 80;
    reasons.push("Possible duplicate");
  }
  if (item.hasReceipt === false) {
    score += 70;
    reasons.push("No receipt");
  }
  if (item.receiptPendingVerify) {
    score += 40;
    reasons.push("Receipt unverified");
  }
  if (item.amount >= 200) {
    score += 30;
    reasons.push("High amount");
  } else if (item.amount >= 100) {
    score += 15;
  }

  const ageDays = Math.max(
    0,
    Math.floor((Date.now() - new Date(item.createdAt).getTime()) / (24 * 60 * 60 * 1000))
  );
  score += Math.min(ageDays * 5, 40);
  if (ageDays >= 3) reasons.push(`${ageDays}d waiting`);

  score += Math.min(item.amount / 50, 20);

  return { score, reasons };
}

export function sortByApprovalPriority<T extends ApprovalPriorityInput>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const sa = scoreApprovalPriority(a).score;
    const sb = scoreApprovalPriority(b).score;
    if (sb !== sa) return sb - sa;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export { FINANCE_SETTING_KEYS };
