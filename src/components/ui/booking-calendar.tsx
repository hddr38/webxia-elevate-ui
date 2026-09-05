import { useEffect, useRef, useCallback } from "react";
import { useTheme } from "@/lib/theme-context";
import { useLocale } from "@/lib/locale-context";

interface BookingCalendarProps {
  username?: string;
  eventType?: string;
}

export function BookingCalendar({
  username = "webxia",
  eventType = "30min",
}: BookingCalendarProps) {
  const { theme } = useTheme();
  const { t } = useLocale();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isMountedRef = useRef(false);

  const updateIframeSrc = useCallback(
    (t: "light" | "dark") => {
      if (iframeRef.current) {
        const src = `https://cal.com/${username}/${eventType}?embed&theme=${t}`;
        if (iframeRef.current.src !== src) {
          iframeRef.current.src = src;
        }
      }
    },
    [username, eventType],
  );

  useEffect(() => {
    isMountedRef.current = true;
    updateIframeSrc(theme);
    return () => {
      isMountedRef.current = false;
    };
  }, [theme, updateIframeSrc]);

  return (
    <div className="h-full min-h-[600px]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-semibold tracking-tight">{t("booking.title")}</h3>
          <p className="text-sm text-muted-foreground">{t("booking.subtitle")}</p>
        </div>
      </div>

      <div
        className="overflow-hidden rounded-2xl bg-card border border-border"
        style={{ height: "600px" }}
      >
        <iframe
          ref={iframeRef}
          src={`https://cal.com/${username}/${eventType}?embed&theme=${theme}`}
          className="w-full h-full border-0 bg-transparent"
          title="Cal.com Booking Widget"
          allow="clipboard-write; fullscreen"
          loading="lazy"
        />
      </div>
    </div>
  );
}
