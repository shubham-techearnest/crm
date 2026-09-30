import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { ApiResponse } from "@/types/api";
import api from "@/api/client";
import { ToolbarIcon } from "@/components/ToolbarIcon/ToolbarIcon";
import { useNavigate } from "react-router-dom";
import { useAuth, useHasPermission } from "@/features/auth/AuthContext";
import { RECORD_ROUTES, recordHref, recordModuleForEntityType } from "@/components/RecordLink";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  read: boolean;
  createdAt: string;
}

async function listNotifications(unreadOnly = false): Promise<NotificationItem[]> {
  const { data } = await api.get<ApiResponse<NotificationItem[]>>("/notifications", {
    params: { unreadOnly, size: 20 },
  });
  if (!data.data) {
    throw new Error(data.message ?? "Unable to load notifications");
  }
  return data.data;
}

async function markNotificationRead(id: string): Promise<void> {
  await api.post(`/notifications/${id}/read`);
}

export function NotificationsMenu() {
  const canView = useHasPermission("NOTIFICATION_VIEW");
  const user = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listNotifications(false),
    enabled: canView && open,
  });

  const markRead = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  if (!canView) {
    return null;
  }

  const unread = (query.data ?? []).filter((n) => !n.read).length;

  return (
    <div className="notifications-menu position-relative">
      <button
        type="button"
        className="app-topbar-icon-btn"
        onClick={() => setOpen((v) => !v)}
        title="Notifications"
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
      >
        <ToolbarIcon name="bell" />
        {unread > 0 ? <span className="app-topbar-badge">{unread > 9 ? "9+" : unread}</span> : null}
      </button>
      {open ? (
        <div className="notifications-panel topbar-panel">
          {query.isLoading ? <div className="topbar-panel-empty">Loading…</div> : null}
          {query.isError ? <div className="topbar-panel-empty text-danger">Unable to load</div> : null}
          {!query.isLoading && (query.data?.length ?? 0) === 0 ? (
            <div className="topbar-panel-empty">No notifications</div>
          ) : null}
          {(query.data ?? []).map((item) => (
            <button
              key={item.id}
              type="button"
              className={`notifications-item${item.read ? " is-read" : ""}`}
              onClick={() => {
                if (!item.read) {
                  markRead.mutate(item.id);
                }
                const module = recordModuleForEntityType(item.entityType);
                if (module && item.entityId && user.permissions.includes(RECORD_ROUTES[module].permission)) {
                  setOpen(false);
                  navigate(recordHref(module, item.entityId));
                }
              }}
            >
              <div className="notifications-item-title">{item.title}</div>
              <div className="notifications-item-message">{item.message}</div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
