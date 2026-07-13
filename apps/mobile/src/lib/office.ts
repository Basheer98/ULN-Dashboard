import { apiRequest } from "./api";

export interface OfficeApproval {
  id: string;
  type: "expense" | "mileage" | "payment";
  title: string;
  subtitle: string;
  amount: number;
  status: string | null;
  createdAt: string;
  category: string | null;
  projectNumber: string | null;
}

export interface OfficeSummary {
  counts: {
    activeProjects: number;
    completedToday: number;
    pendingExpenses: number;
    pendingMileage: number;
    pendingPayments: number;
    unreadNotifications: number;
  };
  recentProjects: Array<{
    id: string;
    projectNumber: string;
    title: string;
    status: string;
    clientName: string;
    dueDate: string | null;
    fielders: string[];
  }>;
  approvals: {
    expenses: OfficeApproval[];
    mileage: OfficeApproval[];
    payments: OfficeApproval[];
  };
}

export interface OfficeNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  isUnread: boolean;
  isOpen: boolean;
}

export interface OfficeNotificationResponse {
  notifications: OfficeNotification[];
  unreadCount: number;
  openCount: number;
}

export function loadOfficeSummary(token: string) {
  return apiRequest<OfficeSummary>("/mobile/office/summary", { token });
}

export function loadOfficeNotifications(token: string) {
  return apiRequest<OfficeNotificationResponse>("/notifications?limit=50", {
    token,
  });
}

export function updateNotification(
  token: string,
  id: string,
  action: "read" | "resolve"
) {
  return apiRequest<OfficeNotification>(`/notifications/${id}`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ action }),
  });
}

export function actOnApproval(
  token: string,
  item: OfficeApproval,
  action: "approve" | "reject" | "paid",
  reason?: string
) {
  if (item.type === "payment") {
    return apiRequest(`/payments/${item.id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ status: action === "paid" ? "paid" : "approved" }),
    });
  }

  const endpointAction = action === "paid" ? "reimburse" : action;
  return apiRequest(`/finance/${item.type === "expense" ? "expenses" : "mileage"}/${item.id}/${endpointAction}`, {
    method: "POST",
    token,
    body: action === "reject" ? JSON.stringify({ reason: reason || "Rejected by admin" }) : undefined,
  });
}
