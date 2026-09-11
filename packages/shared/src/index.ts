import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
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
  clientSqftRate: z.coerce.number().min(0),
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
  fielderSqftRate: z.coerce.number().min(0),
  assignedSqft: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
});

export const projectCreateSchema = projectSchema.extend({
  assignment: assignmentSchema.optional(),
});

export const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).optional(),
  role: z.enum(["admin", "dispatcher", "accountant"]),
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
