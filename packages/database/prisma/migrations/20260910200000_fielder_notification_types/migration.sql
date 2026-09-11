-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'payment_pending';
ALTER TYPE "NotificationType" ADD VALUE 'payment_approved';
ALTER TYPE "NotificationType" ADD VALUE 'payment_sent';
ALTER TYPE "NotificationType" ADD VALUE 'expense_approved';
ALTER TYPE "NotificationType" ADD VALUE 'expense_rejected';
ALTER TYPE "NotificationType" ADD VALUE 'expense_reimbursed';
