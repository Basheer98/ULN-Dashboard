import { z } from "zod";

export const FINANCE_SETTING_KEYS = {
  mileageRate: "mileage_rate",
  defaultCurrency: "default_currency",
  fiscalYearStart: "fiscal_year_start",
  receiptRequiredAbove: "receipt_required_above",
  companyName: "company_name",
} as const;

export const DEFAULT_FINANCE_SETTINGS: Record<string, string> = {
  [FINANCE_SETTING_KEYS.mileageRate]: "0.67",
  [FINANCE_SETTING_KEYS.defaultCurrency]: "USD",
  [FINANCE_SETTING_KEYS.fiscalYearStart]: "01-01",
  [FINANCE_SETTING_KEYS.receiptRequiredAbove]: "25",
  [FINANCE_SETTING_KEYS.companyName]: "Urbanlink Networks LLC",
};

export const expenseCategorySchema = z.object({
  name: z.string().min(1),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const expenseSubcategorySchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(1),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const paymentMethodSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["bank", "credit_card", "debit_card", "cash", "other"]),
  accountNickname: z.string().optional(),
  lastFour: z.string().max(4).optional(),
  openingBalance: z.coerce.number().optional(),
  currentBalance: z.coerce.number().optional(),
  includeInDashboard: z.boolean().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().optional(),
});

export const vendorSchema = z.object({
  name: z.string().min(1),
  vendorType: z.enum(["supplier", "contractor", "utility", "government", "other"]),
  contactName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  taxId: z.string().optional(),
  defaultCategoryId: z.string().optional().nullable(),
  defaultPaymentMethodId: z.string().optional().nullable(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const expenseSchema = z.object({
  transactionDate: z.string().min(1),
  amount: z.coerce.number().positive(),
  description: z.string().optional(),
  businessPurpose: z.string().optional(),
  categoryId: z.string().optional().nullable(),
  subcategoryId: z.string().optional().nullable(),
  paymentMethodId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  fielderId: z.string().optional().nullable(),
  vendorId: z.string().optional().nullable(),
  tripId: z.string().optional().nullable(),
  paidBy: z.enum(["company", "employee"]).optional(),
  cardLastFour: z.string().max(4).optional(),
  isReimbursable: z.boolean().optional(),
  isBillable: z.boolean().optional(),
  isTaxDeductible: z.boolean().optional(),
  paymentReference: z.string().optional(),
  notes: z.string().optional(),
  expenseStatus: z
    .enum([
      "draft",
      "submitted",
      "pending_review",
      "approved",
      "rejected",
      "paid",
      "reimbursed",
      "voided",
    ])
    .optional(),
  allocations: z
    .array(
      z.object({
        projectId: z.string().min(1),
        amount: z.coerce.number().positive(),
        percent: z.coerce.number().min(0).max(100).optional(),
      })
    )
    .optional(),
});

export const incomeSchema = z.object({
  transactionDate: z.string().min(1),
  amount: z.coerce.number().positive(),
  description: z.string().optional(),
  incomeCategory: z.enum([
    "client_payment",
    "advance_payment",
    "partial_invoice_payment",
    "travel_reimbursement",
    "expense_reimbursement",
    "loan_proceeds",
    "owner_contribution",
    "refund_received",
    "other_income",
  ]),
  clientId: z.string().optional().nullable(),
  invoiceId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  paymentMethodId: z.string().optional().nullable(),
  paymentReference: z.string().optional(),
  notes: z.string().optional(),
});

export const invoicePaymentSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.coerce.number().positive(),
  paidAt: z.string().min(1),
  paymentMethodId: z.string().optional().nullable(),
  reference: z.string().optional(),
  writeOffRemainder: z.boolean().optional(),
});

export const mileageSchema = z.object({
  date: z.string().min(1),
  vehicleId: z.string().optional().nullable(),
  startLocation: z.string().optional(),
  destination: z.string().optional(),
  startOdometer: z.coerce.number().optional().nullable(),
  endOdometer: z.coerce.number().optional().nullable(),
  totalMiles: z.coerce.number().positive().optional(),
  businessPurpose: z.string().optional(),
  projectId: z.string().optional().nullable(),
  tripId: z.string().optional().nullable(),
  isReimbursable: z.boolean().optional(),
  notes: z.string().optional(),
});

export const tripSchema = z.object({
  name: z.string().min(1),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  state: z.string().optional(),
  city: z.string().optional(),
  purpose: z.string().optional(),
  budget: z.coerce.number().optional().nullable(),
  status: z.enum(["planned", "active", "completed", "cancelled"]).optional(),
  notes: z.string().optional(),
  projectIds: z.array(z.string()).optional(),
});

export const loanSchema = z.object({
  lender: z.string().min(1),
  originalAmount: z.coerce.number().positive(),
  interestRate: z.coerce.number().min(0).optional().nullable(),
  startDate: z.string().optional().nullable(),
  paymentFrequency: z.string().optional(),
  paymentAmount: z.coerce.number().optional().nullable(),
  nextPaymentDate: z.string().optional().nullable(),
  purpose: z.string().optional(),
  notes: z.string().optional(),
});

export const loanPaymentSchema = z.object({
  paidAt: z.string().min(1),
  principalAmount: z.coerce.number().min(0),
  interestAmount: z.coerce.number().min(0),
  feeAmount: z.coerce.number().min(0).optional(),
  reference: z.string().optional(),
  paymentMethodId: z.string().optional().nullable(),
});

export const ownerTransactionSchema = z.object({
  transactionType: z.enum(["owner_draw", "owner_contribution"]),
  transactionDate: z.string().min(1),
  amount: z.coerce.number().positive(),
  description: z.string().optional(),
  paymentMethodId: z.string().optional().nullable(),
  notes: z.string().optional(),
});

export const reconciliationSchema = z.object({
  paymentMethodId: z.string().min(1),
  statementDate: z.string().min(1),
  startingBalance: z.coerce.number(),
  endingBalance: z.coerce.number(),
  notes: z.string().optional(),
});

export const ALLOWED_RECEIPT_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
];

export const MAX_RECEIPT_SIZE = 10 * 1024 * 1024;

export function calculateMileageReimbursement(miles: number, rate: number): number {
  return Math.round(miles * rate * 100) / 100;
}

export function calculateMilesFromOdometer(start: number, end: number): number {
  if (end <= start) throw new Error("End odometer must be greater than start");
  return Math.round((end - start) * 10) / 10;
}

export function sumDecimal(values: number[]): number {
  return values.reduce((s, v) => s + v, 0);
}

export function calculateProjectProfitability(
  revenue: number,
  directExpenses: number,
  allocatedExpenses: number
): { grossProfit: number; margin: number } {
  const grossProfit = revenue - directExpenses - allocatedExpenses;
  const margin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  return { grossProfit, margin: Math.round(margin * 100) / 100 };
}

export function calculateInvoiceBalance(
  totalAmount: number,
  payments: { amount: number }[]
): { paid: number; remaining: number; isOverpaid: boolean } {
  const paid = sumDecimal(payments.map((p) => p.amount));
  const remaining = Math.max(0, totalAmount - paid);
  return { paid, remaining, isOverpaid: paid > totalAmount };
}

export function calculateReconciliationDifference(
  startingBalance: number,
  clearedTotal: number,
  endingBalance: number
): number {
  return Math.round((startingBalance + clearedTotal - endingBalance) * 100) / 100;
}

export type ExpenseInput = z.infer<typeof expenseSchema>;
export type IncomeInput = z.infer<typeof incomeSchema>;
export type MileageInput = z.infer<typeof mileageSchema>;
