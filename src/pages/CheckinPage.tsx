import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { fetchCheckinConfig, submitCheckin, type CheckinConfig } from "@/lib/checkin-config";
import CheckInFormDynamic from "@/components/CheckInFormDynamic";

const CheckinPage = () => {
  const { tenant, filiale } = useParams<{ tenant: string; filiale?: string }>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [config, setConfig] = useState<CheckinConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  // Primärfarbe als CSS-Variable setzen
  const primaryColor = config?.primary_color || "#39E078";

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
    <div className="min-h-screen relative overflow-hidden bg-black" style={{ "--aurora-primary": primaryColor } as React.CSSProperties}>
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

          {config?.logo_url && (
            <div className="relative z-10 flex justify-center mb-8">
              <img
                src={config.logo_url}
                alt={config.tenant_name}
                className="w-72 h-auto object-contain"
                style={{
                  mixBlendMode: "screen",
                  filter: `drop-shadow(0 0 30px ${primaryColor}33)`,
                }}
              />
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
