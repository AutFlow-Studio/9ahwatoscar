import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/10 text-primary hover:bg-primary/20",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive/10 text-destructive hover:bg-destructive/20",
        outline: "text-foreground",
        success: "border-transparent bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20",
        warning: "border-transparent bg-amber-500/10 text-amber-500 hover:bg-amber-500/20",
        info: "border-transparent bg-blue-500/10 text-blue-500 hover:bg-blue-500/20",
        neutral: "border-transparent bg-slate-500/10 text-slate-500 hover:bg-slate-500/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function StatusBadge({ className, variant, ...props }: StatusBadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

// Helpers for specific statuses
export function getClientStatusVariant(status: string): VariantProps<typeof badgeVariants>["variant"] {
  switch (status.toLowerCase()) {
    case "active": return "success";
    case "inactive": return "neutral";
    case "prospect": return "info";
    case "churned": return "destructive";
    case "at_risk": return "warning";
    case "past": return "neutral";
    default: return "default";
  }
}

export function getProjectStatusVariant(status: string): VariantProps<typeof badgeVariants>["variant"] {
  switch (status.toLowerCase()) {
    case "planning": return "neutral";
    case "waiting": return "warning";
    case "design": return "info";
    case "development": return "default";
    case "testing": return "warning";
    case "review": return "info";
    case "delivered": return "success";
    case "paused": return "neutral";
    case "cancelled": return "destructive";
    default: return "default";
  }
}

export function getProjectPriorityVariant(priority: string): VariantProps<typeof badgeVariants>["variant"] {
  switch (priority.toLowerCase()) {
    case "low": return "neutral";
    case "medium": return "info";
    case "high": return "warning";
    case "urgent": return "destructive";
    default: return "default";
  }
}

export function getPaymentStatusVariant(status: string): VariantProps<typeof badgeVariants>["variant"] {
  switch (status.toLowerCase()) {
    case "paid": return "success";
    case "pending": return "warning";
    case "overdue": return "destructive";
    case "cancelled": return "neutral";
    default: return "default";
  }
}

export function getTaskStatusVariant(status: string): VariantProps<typeof badgeVariants>["variant"] {
  switch (status.toLowerCase()) {
    case "todo": return "neutral";
    case "in_progress": return "default";
    case "in_review": return "info";
    case "review": return "info";
    case "done": return "success";
    case "completed": return "success";
    default: return "default";
  }
}
