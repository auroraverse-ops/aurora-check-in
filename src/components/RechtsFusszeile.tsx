import type { CheckinConfig } from "@/lib/checkin-config";
import { rechtsLinks } from "@/lib/rechtsseiten";

// ra-w4: Fusszeile mit Impressum und Datenschutz des Betriebs (zentrale Seiten).
// Neuer Tab, damit ein halb ausgefuelltes Formular nicht verloren geht.
// Ohne gueltige Adressen vom Server: keine Fusszeile statt falscher Links.
const RechtsFusszeile = ({ config }: { config: Pick<CheckinConfig, "rechtsseiten"> | null }) => {
  const links = rechtsLinks(config);
  if (!links) return null;
  return (
    <footer className="relative z-10 flex justify-center gap-6 py-6 text-sm text-white/50">
      <a
        href={links.impressum}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center min-h-12 px-2 hover:text-white transition-colors"
      >
        Impressum
      </a>
      <a
        href={links.datenschutz}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center min-h-12 px-2 hover:text-white transition-colors"
      >
        Datenschutz
      </a>
    </footer>
  );
};

export default RechtsFusszeile;
