"use client";

import { useEffect, useState } from "react";
import Switch from "./Switch";
import { requestJson } from "@/lib/request";
import { invalidate } from "@/lib/resourceCache";
import { useToast } from "./ToastProvider";

// Admin Toolbox > Church settings (v71.29):
//   * Church prayer On/Off -- off hides the Home tile and the prayer page,
//     and keeps every request (switch it back on and they're all there).
//   * Service times -- shown on Home's "This Sunday" card. Leave empty to hide.
export default function ChurchSettingsCard() {
  const toast = useToast();
  const [settings, setSettings] = useState(null);
  const [failed, setFailed] = useState("");
  const [times, setTimes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    requestJson("/api/admin/settings")
      .then((d) => {
        setSettings(d.settings);
        setTimes(d.settings.service_times || "");
      })
      .catch((err) => setFailed(err.message || "Couldn't load church settings."));
  }, []);

  const save = async (patch, success) => {
    setBusy(true);
    try {
      const d = await requestJson("/api/admin/settings", { method: "PATCH", body: patch });
      setSettings(d.settings);
      invalidate("home:events-mine"); // Home's cards pick it up right away
      toast.success(success);
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p className="text-xs uppercase tracking-wide text-inkfaint mb-2">Church settings</p>
      <div className="sp-card mb-6 space-y-4">
        {failed && <p className="text-sm text-red-600 dark:text-red-400">{failed}</p>}
        {settings && (
          <>
            <Switch
              checked={Boolean(settings.church_prayer_enabled)}
              onChange={(next) => save({ church_prayer_enabled: next }, next ? "Church prayer is on" : "Church prayer is off")}
              label="Church prayer"
              description="A prayer page for the whole church, opened from Home. Turning it off hides it and keeps every request."
              busy={busy}
            />
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save({ service_times: times }, "Service times saved");
              }}
            >
              <label htmlFor="service-times" className="block text-sm font-medium text-ink">
                Service times
              </label>
              <p className="text-xs text-inkfaint mb-1.5">Shown on Home under “This Sunday”. Leave it empty to hide them.</p>
              <textarea
                id="service-times"
                value={times}
                onChange={(e) => setTimes(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder={"Sunday School 9:45 AM\nMorning Worship 10:45 AM\nSunday Night 6:00 PM"}
                className="sp-textarea mb-2"
              />
              <button
                type="submit"
                disabled={busy || times.trim() === (settings.service_times || "").trim()}
                className="sp-btn-primary text-sm disabled:opacity-60"
              >
                Save service times
              </button>
            </form>
          </>
        )}
      </div>
    </>
  );
}
