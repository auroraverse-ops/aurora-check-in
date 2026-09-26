import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { fetchCheckinConfig } from "@/lib/checkin-config";

// ph-w0 PH0-02 (Spec aurora-v2 portal-hauptkanal/01, 26.09.2026):
// Datenschutzhinweise DES MANDANTEN aus der Datenbank. Quelle ist dieselbe
// Konfiguration wie beim Formular (checkin-config): sie liefert den Wortlaut nur,
// wenn der Anbieter ihn freigegeben hat und die Stammdaten des Betriebs vollstaendig
// sind. Kein fest eingebauter Ersatztext - fehlt die Freigabe, sagt die Seite das.
// Die feste Seite /privacy bleibt ausschliesslich fuer den AKZ-Bestandsmodus.
// Ziel auch fuer den Link im Buchungs-Widget (PH0-03).

type Zustand =
  | { art: "laedt" }
  | { art: "text"; betrieb: string; wortlaut: string }
  | { art: "nicht_freigegeben"; betrieb: string }
  | { art: "fehler" };

const Datenschutz = () => {
  const { tenant } = useParams<{ tenant: string }>();
  const [zustand, setZustand] = useState<Zustand>({ art: "laedt" });

  useEffect(() => {
    if (!tenant) {
      setZustand({ art: "fehler" });
      return;
    }
    let abgebrochen = false;
    fetchCheckinConfig(tenant)
      .then((config) => {
        if (abgebrochen) return;
        const hinweise = config.consent?.datenschutzhinweise;
        setZustand(
          hinweise?.wortlaut
            ? { art: "text", betrieb: config.tenant_name, wortlaut: hinweise.wortlaut }
            : { art: "nicht_freigegeben", betrieb: config.tenant_name },
        );
      })
      .catch(() => {
        if (!abgebrochen) setZustand({ art: "fehler" });
      });
    return () => {
      abgebrochen = true;
    };
  }, [tenant]);

  return (
    <div className="min-h-screen bg-black">
      <div className="container max-w-2xl mx-auto px-6 py-10">
        {tenant && (
          <Link
            to={`/${tenant}`}
            className="inline-flex items-center gap-2 text-aurora-glow hover:text-white transition-colors mb-8 min-h-12"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Zurück zum Check-in</span>
          </Link>
        )}

        <div className="glass-card p-8 md:p-12">
          {zustand.art === "laedt" && <p className="text-white/70">Datenschutzhinweise werden geladen …</p>}

          {zustand.art === "text" && (
            <>
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-8">
                Datenschutzhinweise {zustand.betrieb}
              </h1>
              <div className="text-white/80 leading-relaxed text-base whitespace-pre-line">{zustand.wortlaut}</div>
            </>
          )}

          {zustand.art === "nicht_freigegeben" && (
            <>
              <h1 className="text-2xl font-bold text-white mb-4">Datenschutzhinweise {zustand.betrieb}</h1>
              <p className="text-white/70 leading-relaxed">
                Die Datenschutzhinweise dieses Betriebs werden gerade aktualisiert. Bitte wenden Sie sich
                direkt an den Betrieb, dort erhalten Sie die Hinweise persönlich.
              </p>
            </>
          )}

          {zustand.art === "fehler" && (
            <p className="text-white/70 leading-relaxed">
              Die Datenschutzhinweise konnten nicht geladen werden. Bitte prüfen Sie die Adresse oder wenden Sie
              sich direkt an den Betrieb.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Datenschutz;
