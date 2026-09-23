import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { ApiResponse } from "@/types/api";
import api from "@/api/client";
import { useHasPermission } from "@/features/auth/AuthContext";

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
    <div className="position-relative">
      <button
        type="button"
        className="btn btn-outline-secondary btn-sm"
        onClick={() => setOpen((v) => !v)}
      >
        Notifications{unread > 0 ? ` (${unread})` : ""}
      </button>
      {open ? (
        <div
          className="position-absolute end-0 mt-1 border rounded bg-white shadow-sm"
          style={{ zIndex: 40, width: 320, maxHeight: 320, overflowY: "auto" }}
        >
          {query.isLoading ? <div className="p-2 small text-muted">Loading…</div> : null}
          {query.isError ? <div className="p-2 small text-danger">Unable to load</div> : null}
          {!query.isLoading && (query.data?.length ?? 0) === 0 ? (
            <div className="p-2 small text-muted">No notifications</div>
          ) : null}
          {(query.data ?? []).map((item) => (
            <button
              key={item.id}
              type="button"
              className="d-block w-100 text-start border-0 border-bottom px-2 py-2 bg-white"
              onClick={() => {
                if (!item.read) {
                  markRead.mutate(item.id);
                }
              }}
            >
              <div className={`small ${item.read ? "text-muted" : "fw-semibold"}`}>{item.title}</div>
              <div className="small text-muted">{item.message}</div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
