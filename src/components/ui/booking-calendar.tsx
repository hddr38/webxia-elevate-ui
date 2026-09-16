import { useEffect, useRef, useCallback, useState } from "react";
import { Calendar } from "lucide-react";
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
  const [loaded, setLoaded] = useState(false);

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
    if (loaded) updateIframeSrc(theme);
  }, [theme, loaded, updateIframeSrc]);

  return (
    <div className="h-full min-h-[480px]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-semibold tracking-tight">{t("booking.title")}</h3>
          <p className="text-sm text-muted-foreground">{t("booking.subtitle")}</p>
        </div>
      </div>

      {loaded ? (
        <div className="h-[65svh] min-h-[480px] overflow-hidden rounded-2xl border border-border bg-card">
          <iframe
            ref={iframeRef}
            src={`https://cal.com/${username}/${eventType}?embed&theme=${theme}`}
            className="h-full w-full border-0 bg-transparent"
            title="Cal.com Booking Widget"
            allow="clipboard-write; fullscreen"
            loading="lazy"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setLoaded(true)}
          className="flex min-h-[420px] w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-background/40 p-6 text-center transition-colors hover:border-brand/40 hover:text-brand"
        >
          <Calendar className="size-8 opacity-60" aria-hidden="true" />
          <span className="font-medium">{t("form.calendly")}</span>
          <span className="text-xs text-muted-foreground">
            cal.com/{username}/{eventType}
          </span>
        </button>
      )}
    </div>
  );
}
