import { useState, useEffect, useRef, useCallback, useMemo, type SyntheticEvent } from "react";
import { useParams } from "react-router-dom";
import { fetchCheckinConfig, submitCheckin, type CheckinConfig } from "@/lib/checkin-config";
import CheckInFormDynamic from "@/components/CheckInFormDynamic";

// Aurora-Defaults (Migration 173 in aurora-v2): Neon-Gruen.
const DEFAULT_BRAND_H = 130;
const DEFAULT_BRAND_S = 82;
const DEFAULT_BRAND_L = 49;

// Lightness-Clamping: L zwischen 30 und 70 fuer brauchbare Buttons/Borders.
// Ohne Clamp wuerde z.B. ein dunkles CI-Blau (#0e1353 ~ L=20) Borders unsichtbar machen.
function clampL(l: number): number {
  return Math.max(30, Math.min(70, l));
}

// Kontrast-Farbe (Schwarz/Weiss) fuer Text auf Brand-Background.
// Vereinfachte WCAG-Annaeherung: hellere Brand-Farbe -> schwarzer Text.
function getContrast(h: number, s: number, l: number): string {
  // Heuristik: bei L > 60 (helle Farben) Schwarz, sonst Weiss.
  // Im Aurora-Default (L=49) -> Schwarz (Aurora-Gruen ist hell genug).
  // Wir nutzen aber gewichteten Wert weil reines L bei niedriger Saturation truegt.
  const effectiveL = l + (s / 100) * 5; // grobe Annaeherung an Wahrnehmungs-L
  return effectiveL > 60 ? "#000000" : "#ffffff";
}

// HSL-Triplet -> Hex-String fuer Inline-Drop-Shadow am Logo.
function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const a = sN * Math.min(lN, 1 - lN);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = lN - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Hex-String -> HSL-Triplet (fuer Legacy primary_color, der auch die CSS-Vars
// fuer Buttons/Cards/Borders steuern soll, nicht nur den Logo-Shadow).
function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const match = /^#?([a-f\d]{3}|[a-f\d]{6})$/i.test(hex.trim()) ? hex.trim().replace(/^#/, "") : null;
  if (!match) return null;
  let hStr = match;
  if (hStr.length === 3) {
    hStr = hStr.split("").map((c) => c + c).join("");
  }
  const r = parseInt(hStr.slice(0, 2), 16) / 255;
  const g = parseInt(hStr.slice(2, 4), 16) / 255;
  const b = parseInt(hStr.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lN = (max + min) / 2;
  let hN = 0;
  let sN = 0;
  if (max !== min) {
    const d = max - min;
    sN = lN > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: hN = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: hN = ((b - r) / d + 2); break;
      case b: hN = ((r - g) / d + 4); break;
    }
    hN /= 6;
  }
  return {
    h: Math.round(hN * 360),
    s: Math.round(sN * 100),
    l: Math.round(lN * 100),
  };
}

const CheckinPage = () => {
  const { tenant, filiale } = useParams<{ tenant: string; filiale?: string }>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [config, setConfig] = useState<CheckinConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [logoFailed, setLogoFailed] = useState(false);

  // Config laden
  const loadConfig = useCallback(async () => {
    if (!tenant) return;
    try {
      setLoading(true);
      setError(null);
      const cfg = await fetchCheckinConfig(tenant, filiale);
      setConfig(cfg);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Konfiguration konnte nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, [tenant, filiale]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Token alle 12 Minuten erneuern (TTL = 15 Min, Refresh bei 80%)
  useEffect(() => {
    if (!config) return;
    const interval = setInterval(() => {
      loadConfig();
    }, 12 * 60 * 1000);
    return () => clearInterval(interval);
  }, [config, loadConfig]);

  // Video-Geschwindigkeit
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = 0.6;
  }, []);

  // Submit-Handler
  const handleSubmit = async (data: Record<string, unknown>) => {
    if (!config) throw new Error("Konfiguration nicht geladen");
    return submitCheckin(config.submit_url, config.submit_token, data);
  };

  // Welle 9 (2026-04-28): Markenfarbe aus tenant_theme aufloesen.
  // Reihenfolge: legacy primary_color (Hex-Override) -> brand_color (HSL) -> Default.
  // Wenn legacy primary_color als Hex gesetzt ist, parsen wir ihn zu HSL und
  // nutzen ihn fuer ALLE Akzente (nicht nur Logo-Shadow). So bleibt Bestand-
  // Konfig wirksam, gewinnt aber konsistent in der gesamten App.
  // Setzt CSS-Variablen --brand-h/-s/-l/-contrast am documentElement, sodass
  // ALLE Aurora-Akzente (Buttons, Cards, Borders, Glows, Chips) automatisch folgen.
  const brandHsl = useMemo(() => {
    if (!config) {
      return {
        h: DEFAULT_BRAND_H,
        s: DEFAULT_BRAND_S,
        l: DEFAULT_BRAND_L,
        legacyHex: null as string | null,
      };
    }
    // 1. Legacy Hex hat Vorrang wenn gesetzt
    if (config.primary_color) {
      const fromHex = hexToHsl(config.primary_color);
      if (fromHex) {
        return {
          h: fromHex.h,
          s: fromHex.s,
          l: clampL(fromHex.l),
          legacyHex: config.primary_color,
        };
      }
      // Hex unparsbar -> ignorieren, weiter mit brand_color
    }
    // 2. Tenant-Theme HSL aus Edge-Function
    const h = config.brand_color?.h ?? DEFAULT_BRAND_H;
    const s = config.brand_color?.s ?? DEFAULT_BRAND_S;
    const l = clampL(config.brand_color?.l ?? DEFAULT_BRAND_L);
    return {
      h,
      s,
      l,
      legacyHex: null,
    };
  }, [config]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--brand-h", String(brandHsl.h));
    root.style.setProperty("--brand-s", `${brandHsl.s}%`);
    root.style.setProperty("--brand-l", `${brandHsl.l}%`);
    root.style.setProperty(
      "--brand-contrast",
      getContrast(brandHsl.h, brandHsl.s, brandHsl.l),
    );
  }, [brandHsl]);

  // Hex-Wert fuer Inline-Drop-Shadow am Logo.
  // Legacy primary_color (falls gesetzt) gewinnt, sonst aus HSL berechnet.
  const primaryColor = brandHsl.legacyHex
    || hslToHex(brandHsl.h, brandHsl.s, brandHsl.l);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-white/60 text-lg animate-pulse">Laden...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black px-6">
        <div className="text-center space-y-4">
          <p className="text-white/80 text-lg">{error}</p>
          <button
            onClick={loadConfig}
            className="px-6 py-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition"
          >
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      {/* Video Background */}
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        className="fixed inset-0 w-screen h-screen object-cover z-0"
        poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Crect fill='%23000'/%3E%3C/svg%3E"
      >
        <source src="/aurora.mp4" type="video/mp4" />
      </video>

      {/* Dark Overlay */}
      <div className="fixed inset-0 bg-black/40 z-[1]" />

      <div className="relative z-10 container max-w-md mx-auto px-6 py-10 pb-16 min-h-screen">
        {/* Header */}
        <header className="text-center mb-16 relative">
          <div className="logo-glow" />

          {config?.logo_url && !logoFailed && (
            <div className="relative z-10 flex justify-center mb-8">
              <img
                src={config.logo_url}
                alt={config.tenant_name}
                className="w-72 h-auto object-contain"
                style={{
                  filter: `drop-shadow(0 0 30px ${primaryColor}33)`,
                }}
                onError={() => setLogoFailed(true)}
              />
            </div>
          )}

          {/* Fallback: Tenant-Name als Text wenn kein Logo */}
          {(!config?.logo_url || logoFailed) && (
            <div className="relative z-10 mb-8">
              <h2 className="text-3xl font-bold text-white tracking-wide">{config?.tenant_name}</h2>
            </div>
          )}

          <p className="text-white/90 text-xl font-medium tracking-widest uppercase">
            {config?.welcome_text || `Willkommen bei ${config?.tenant_name}`}
          </p>
          {config?.filiale_name && (
            <p className="text-white/50 text-base mt-1 tracking-wide">
              {config.filiale_name}
            </p>
          )}
          <p className="text-white/40 text-base mt-2 tracking-wide">
            Smart Check-in für deinen Besuch
          </p>
        </header>

        {/* Hero */}
        <section className="text-center mb-14">
          <h1 className="text-5xl md:text-6xl font-extrabold text-white tracking-tight mb-4 leading-tight">
            Smart Check-in
          </h1>
          <p className="text-white/35 text-base tracking-wide">
            Dauert nur 60 Sekunden.
          </p>
        </section>

        {/* Formular */}
        <CheckInFormDynamic
          config={config!}
          onSubmit={handleSubmit}
        />

        <div className="h-12" />
      </div>
    </div>
  );
};

export default CheckinPage;
