import { useEffect, useState } from "react";
import { SystemService } from "@/api/services/SystemService";
import { useTurnstileGuard, TurnstileMode } from "@/hooks/useTurnstileGuard";

interface UseTurnstileSettingsOptions {
  submitting: boolean;
}

export function useTurnstileSettings({ submitting }: UseTurnstileSettingsOptions) {
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settings, setSettings] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const s = await SystemService.getSettingsGetSettingsGet();
        setSettings(s);
      } catch (error) {
        console.error("Failed to fetch settings:", error);
      } finally {
        setSettingsLoaded(true);
      }
    };
    fetchSettings();
  }, []);

  const turnstileEnabled = settings?.TURNSTILE_ENABLED === true;
  const turnstileSiteKey: string | null = settings?.TURNSTILE_SITE_KEY ?? null;
  const turnstileMode: TurnstileMode = (settings?.TURNSTILE_MODE as TurnstileMode) ?? "normal";
  const effectiveTurnstileEnabled = turnstileEnabled && Boolean(turnstileSiteKey);

  const turnstile = useTurnstileGuard({
    siteKey: turnstileSiteKey,
    enabled: effectiveTurnstileEnabled,
    mode: turnstileMode,
    settingsLoaded,
    submitting,
  });

  return {
    ...turnstile,
    effectiveTurnstileEnabled,
    settingsLoaded,
    settings,
  };
}
