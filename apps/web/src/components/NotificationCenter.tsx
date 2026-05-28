import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { supabase, type Run } from "../lib/supabase";
import { formatRelative } from "../lib/format";
import {
  deriveActivities,
  loadReadSet,
  saveReadSet,
  type Activity,
} from "../lib/activity";
import { useToast } from "./Toast";

export function NotificationCenter({
  email,
  onJump,
}: {
  email: string;
  onJump?: (section: "overview" | "train" | "models" | "storage") => void;
}) {
  const [open, setOpen] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [readSet, setReadSet] = useState<Set<string>>(() => loadReadSet(email));
  const prevIdsRef = useRef<Set<string>>(new Set());
  const { push } = useToast();
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setReadSet(loadReadSet(email));
  }, [email]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [{ data: runs }, { data: versions }, { data: deployments }] = await Promise.all([
        supabase.from("runs").select("*").order("updated_at", { ascending: false }).limit(50),
        supabase.from("versions").select("id,semver,created_at").order("created_at", { ascending: false }).limit(20),
        supabase.from("channel_deployments").select("id,channel_name,version_id,status,is_default,deployed_at").order("deployed_at", { ascending: false }).limit(20),
      ]);
      if (cancelled) return;
      const next = deriveActivities({
        runs: (runs ?? []) as Run[],
        versions: (versions ?? []) as any,
        deployments: (deployments ?? []) as any,
      });

      // Detect NEW activities (not seen previously) → fire toasts for success/failure
      const prevIds = prevIdsRef.current;
      const firstRun = prevIds.size === 0;
      for (const a of next) {
        if (!firstRun && !prevIds.has(a.id) && (a.tone === "success" || a.tone === "danger")) {
          push({ tone: a.tone, title: a.title, detail: a.detail });
        }
      }
      prevIdsRef.current = new Set(next.map((a) => a.id));
      setActivities(next);
    }
    load();
    const ch = supabase
      .channel("notifications-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "runs" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "versions" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "channel_deployments" }, () => load())
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [push]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!popoverRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const unread = activities.filter((a) => !readSet.has(a.id)).length;

  function markAllRead() {
    const all = new Set(activities.map((a) => a.id));
    setReadSet(all);
    saveReadSet(email, all);
  }

  function click(a: Activity) {
    if (!readSet.has(a.id)) {
      const next = new Set(readSet);
      next.add(a.id);
      setReadSet(next);
      saveReadSet(email, next);
    }
    if (a.section) onJump?.(a.section);
    setOpen(false);
  }

  return (
    <div className="notif-wrap">
      <button
        type="button"
        className="notif-bell"
        onClick={() => setOpen((x) => !x)}
        aria-label={`Notifications (${unread} unread)`}
      >
        <Bell size={16} aria-hidden="true" />
        {unread > 0 && <span className="notif-badge">{unread > 99 ? "99+" : unread}</span>}
      </button>

      {open && (
        <div className="notif-popover" ref={popoverRef}>
          <header className="notif-header">
            <strong>Activity</strong>
            <button onClick={markAllRead} disabled={unread === 0} className="link-button">
              Mark all read
            </button>
          </header>
          <ul className="notif-list">
            {activities.length === 0 && <li className="muted">No activity yet.</li>}
            {activities.map((a) => (
              <li
                key={a.id}
                className={`notif-item notif-${a.tone}${readSet.has(a.id) ? "" : " unread"}`}
                onClick={() => click(a)}
              >
                <div className="notif-row">
                  <span className="notif-title">{a.title}</span>
                  <span className="notif-time">{formatRelative(a.ts)}</span>
                </div>
                <div className="notif-detail">{a.detail}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

