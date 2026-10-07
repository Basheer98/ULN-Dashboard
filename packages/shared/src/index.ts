import { z } from "zod";

/** Account emails are stored and matched lowercase, so "Jane@X.com " and "jane@x.com" are one login. */
const accountEmail = z.string().trim().toLowerCase().pipe(z.string().email());

/** Web sessions end after this long with no activity. Mobile sessions are exempt. */
export const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
/** Requests carrying this header (background polling) don't count as activity. */
export const BACKGROUND_REQUEST_HEADER = "x-uln-background";

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_RULES_TEXT = `At least ${PASSWORD_MIN_LENGTH} characters, with a letter and a number`;

const COMMON_PASSWORDS = new Set([
  "password1", "password12", "password123", "password1234", "passw0rd123",
  "1234567890", "12345678910", "qwerty1234", "qwerty12345", "qwertyuiop1",
  "abc1234567", "abcd123456", "iloveyou12", "welcome123", "welcome1234",
  "letmein123", "admin12345", "admin123456", "changeme123", "football123",
  "baseball123", "sunshine123", "monkey12345", "dragon12345", "1q2w3e4r5t",
  "asdfghjkl1", "zaq12wsxcde", "trustno1234", "superman123", "123qweasdzxc",
]);

/**
 * Policy for any newly set password. bcrypt ignores bytes past 72, so longer
 * passwords are rejected rather than silently truncated.
 */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(72, "Password must be 72 characters or fewer")
  .refine((value) => /[a-z]/i.test(value), "Password must include a letter")
  .refine((value) => /\d/.test(value), "Password must include a number")
  .refine((value) => !/^(.)\1+$/.test(value), "Password is too simple")
  .refine((value) => !COMMON_PASSWORDS.has(value.toLowerCase()), "Password is too common — choose another");

export const loginSchema = z.object({
  email: accountEmail,
  password: z.string().min(1).max(200),
});

export const clientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  contactName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  defaultSqftRate: z.coerce.number().min(0),
  billingTerms: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const fielderSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  employmentType: z.enum(["contractor_1099", "w2"]),
  defaultSqftRate: z.coerce.number().min(0),
  region: z.string().optional(),
  skills: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export const projectSchema = z.object({
  projectNumber: z.string().min(1, "Project number is required"),
  clientId: z.string().min(1),
  title: z.string().min(1),
  siteAddress: z.string().min(1),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  jobType: z.string().optional(),
  qfield: z.coerce.number().int().min(1).max(2).optional().nullable(),
  description: z.string().optional(),
  sqft: z.coerce.number().min(0),
  buriedSqft: z.coerce.number().min(0).optional().nullable(),
  aerialSqft: z.coerce.number().min(0).optional().nullable(),
  clientSqftRate: z.coerce.number().min(0).optional(),
  status: z
    .enum([
      "draft",
      "assigned",
      "in_progress",
      "complete",
      "invoiced",
      "paid",
      "cancelled",
    ])
    .optional(),
  dueDate: z.string().optional().nullable(),
  notes: z.string().optional(),
});

export const lineItemSchema = z.object({
  type: z.enum(["client_billing", "fielder_payout"]),
  description: z.string().min(1),
  amount: z.coerce.number(),
  fielderId: z.string().optional().nullable(),
});

export const assignmentSchema = z.object({
  fielderId: z.string().min(1),
  fielderSqftRate: z.coerce.number().min(0).optional(),
  assignedSqft: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
});

export const projectCreateSchema = projectSchema.extend({
  assignment: assignmentSchema.optional(),
});

export const userSchema = z.object({
  email: accountEmail,
  password: passwordSchema.optional(),
  role: z.enum(["admin", "dispatcher", "accountant", "coordinator"]),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const pushTokenSchema = z.object({
  pushToken: z.string().min(1),
});

export const assignmentStatusSchema = z.object({
  status: z.enum(["assigned", "accepted", "in_progress", "complete", "cancelled"]),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ClientInput = z.infer<typeof clientSchema>;
export type FielderInput = z.infer<typeof fielderSchema>;
export type ProjectInput = z.infer<typeof projectSchema>;
export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
export type LineItemInput = z.infer<typeof lineItemSchema>;
export type AssignmentInput = z.infer<typeof assignmentSchema>;

export function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

export function calculateClientTotal(
  sqft: number,
  clientSqftRate: number,
  clientLineItems: { amount: number }[]
): { sqftAmount: number; lineItemsTotal: number; total: number } {
  const sqftAmount = sqft * clientSqftRate;
  const lineItemsTotal = clientLineItems.reduce((sum, item) => sum + item.amount, 0);
  return { sqftAmount, lineItemsTotal, total: sqftAmount + lineItemsTotal };
}

export function calculateFielderTotal(
  sqft: number,
  fielderSqftRate: number,
  fielderLineItems: { amount: number }[]
): { sqftAmount: number; lineItemsTotal: number; total: number } {
  const sqftAmount = sqft * fielderSqftRate;
  const lineItemsTotal = fielderLineItems.reduce((sum, item) => sum + item.amount, 0);
  return { sqftAmount, lineItemsTotal, total: sqftAmount + lineItemsTotal };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatRate(rate: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(rate);
}

export function formatStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export { theme } from "./theme";
export * from "./dates";
export * from "./permissions";
export * from "./states";
export * from "./rates";
export * from "./finance";
export * from "./project-import";
export * from "./sheet-csv";
export * from "./bank-statement";
export * from "./expense-smart";
