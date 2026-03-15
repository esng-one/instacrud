import { useCallback, useEffect, useMemo, useState } from "react";
import Turnstile from "react-turnstile";
import { useTheme } from "@/context/ThemeContext";

export type TurnstileMode = "normal" | "invisible";

interface UseTurnstileGuardOptions {
  siteKey: string | null;
  enabled: boolean;
  mode: TurnstileMode;

  // external state
  settingsLoaded: boolean;   // when /getSettings has finished
  submitting: boolean;       // true while signup request is in flight
}

export function useTurnstileGuard({
  siteKey,
  enabled,
  mode,
  settingsLoaded,
  submitting,
}: UseTurnstileGuardOptions) {
  const { theme } = useTheme();

  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [widgetKey, setWidgetKey] = useState(0);

  const reset = useCallback(() => {
    setToken(null);
    setReady(false);
    setWidgetKey((k) => k + 1); // force remount of Turnstile widget
  }, []);

  useEffect(() => {
    if (!enabled || !settingsLoaded) return;

    if (mode !== "invisible") {
      reset();  // remount normal widget to apply theme
    }
  }, [settingsLoaded, siteKey, enabled, mode, reset, theme]);
  
  const widget = useMemo(() => {
    if (!enabled || !siteKey) return null;

    return (
      <Turnstile
        key={widgetKey}
        sitekey={siteKey}
        size={mode}
        theme={theme}
        refreshExpired="auto"
        onVerify={(t) => {
          setToken(t);
          setReady(true);
        }}
        onExpire={() => {
          setToken(null);
          setReady(false);
        }}
        onError={() => {
          reset();
        }}
      />
    );
  }, [enabled, siteKey, mode, widgetKey, reset, theme]);

  const canSubmit = useMemo(() => {
    if (!settingsLoaded) return false;      // avoid initial flicker
    if (submitting) return false;          // form in progress

    if (enabled) {
      if (!ready || !token) return false;  // Turnstile not passed
    }

    return true;
  }, [settingsLoaded, submitting, enabled, ready, token]);

  const showVerifying = useMemo(() => {
    return (
      settingsLoaded &&
      enabled &&
      mode === "invisible" &&
      !ready
    );
  }, [settingsLoaded, enabled, mode, ready]);

  return {
    widget,              // JSX to render in the form
    canSubmit,           // whether the submit button should be enabled
    showVerifying,       // whether to show "Verifying..." badge (invisible only)
    reset,               // call after submit to force new token
    token                // the turnstile token  
  };
}
