import { apiRequest } from "./api";

export interface Client {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  defaultSqftRate: number;
  billingTerms: string | null;
  notes: string | null;
  isActive: boolean;
}

export interface Fielder {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  employmentType: string;
  defaultSqftRate: number;
  region: string | null;
  isActive: boolean;
  skills: string | null;
  certifications: string | null;
}

export interface ProjectListItem {
  id: string;
  projectNumber: string;
  title: string;
  status: string;
  siteAddress: string;
  city: string | null;
  state: string | null;
  sqft: number;
  dueDate: string | null;
  qfield: number | null;
  client: { id: string; name: string };
  assignments: Array<{
    id: string;
    status: string;
    fielder: { id: string; firstName: string; lastName: string };
  }>;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  status: string;
  totalAmount: number;
  dueAt: string | null;
  project: { id: string; projectNumber: string; title: string };
  client: { name: string };
}

export interface Payment {
  id: string;
  status: string;
  totalAmount: number;
  project: { id: string; projectNumber: string; title: string } | null;
  fielder: { firstName: string; lastName: string };
}

export interface RateResolve {
  clientSqftRate: number;
  fielderSqftRate: number;
}

export interface StateRate {
  state: string;
  clientSqftRate: number;
  fielderSqftRate: number;
  notes: string | null;
}

export interface OfficeUser {
  id: string;
  email: string;
  role: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
}

export function loadProjects(token: string) {
  return apiRequest<ProjectListItem[]>("/projects", { token });
}

export function loadClients(token: string) {
  return apiRequest<Client[]>("/clients", { token });
}

export function loadFielders(token: string) {
  return apiRequest<Fielder[]>("/fielders", { token });
}

export function loadInvoices(token: string) {
  return apiRequest<Invoice[]>("/invoices", { token });
}

export function loadPayments(token: string) {
  return apiRequest<Payment[]>("/payments", { token });
}

export function resolveRates(
  token: string,
  params: { clientId?: string; state?: string; fielderId?: string }
) {
  const qs = new URLSearchParams();
  if (params.clientId) qs.set("clientId", params.clientId);
  if (params.state) qs.set("state", params.state);
  if (params.fielderId) qs.set("fielderId", params.fielderId);
  return apiRequest<RateResolve>(`/rates/resolve?${qs}`, { token });
}

export function loadSchedule(token: string, from?: string, to?: string) {
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  const query = qs.toString();
  return apiRequest<ProjectListItem[]>(`/schedule${query ? `?${query}` : ""}`, { token });
}

export function loadStateRates(token: string) {
  return apiRequest<StateRate[]>("/state-rates", { token });
}

export function loadOfficeUsers(token: string) {
  return apiRequest<OfficeUser[]>("/users", { token });
}

export function loadFinanceDashboard(token: string) {
  return apiRequest<{
    income: number;
    expenses: number;
    netIncome: number;
    pendingReimbursements: number;
    outstandingInvoices: number;
    ownerDraws: number;
    cashOnHand: number;
  }>("/finance/dashboard", { token });
}
