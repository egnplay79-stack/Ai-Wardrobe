import type { ReactNode } from "react";

export function EmptyState({ lead, rest, action }: { lead: string; rest?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <p>
        {lead} {rest && <span>{rest}</span>}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
}
