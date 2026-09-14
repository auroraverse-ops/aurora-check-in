import { useState } from "react";
import AuroraCheckbox from "./AuroraCheckbox";
import type { ConsentConfig } from "@/lib/checkin-config";
import {
  allesGewaehlt,
  allesUmschalten,
  hauptKanaele,
  kontaktHakenGesetzt,
  kontaktUmschalten,
  whatsappUmschalten,
  type ConsentAuswahl,
} from "@/lib/consent-v3";

// Einwilligungs-Architektur T6 — das neue Check-in-Ende (Spec §11.1).
//
// Zwei Haken, beide LEER: Versorgung (Pflicht, Art. 9 Abs. 2 lit. a) und
// Kontakt (freiwillig, Kanaele je Mandant, WhatsApp als Unterkaestchen).
//
// SAEMTLICHE TEXTE KOMMEN VOM SERVER. In dieser Datei steht kein
// Einwilligungs-Wortlaut — das ist Absicht: der Wortlaut ist der Nachweis
// (Art. 7), er gehoert zum gehashten Text des Mandanten in `einwilligungs_texte`
// und nicht in ein Frontend-Bundle, das jeder Deploy still veraendern koennte.
// Die drei Informationsebenen (Spec §13.1) sind: Kurztext am Haken, Detailtext
// im Aufklapper, Datenschutzhinweise im Aufklapper darunter.

interface Props {
  consent: ConsentConfig;
  auswahl: ConsentAuswahl;
  onChange: (auswahl: ConsentAuswahl) => void;
}

const KANAL_LABEL: Record<string, string> = {
  email: "E-Mail",
  sms: "SMS",
  whatsapp: "WhatsApp",
};

/** Aufklappbarer Detailbereich (Ebene 2 bzw. 3). Standardmaessig zu. */
const Aufklapper = ({ titel, text, id }: { titel: string; text: string; id: string }) => {
  const [offen, setOffen] = useState(false);
  return (
    <div className="mt-2">
      <button
        type="button"
        aria-expanded={offen}
        aria-controls={`${id}-inhalt`}
        onClick={(e) => {
          e.stopPropagation();
          setOffen((v) => !v);
        }}
        className="text-sm text-aurora-glow underline hover:text-white transition-colors min-h-12 py-1"
      >
        {titel}
      </button>
      {offen && (
        <div
          id={`${id}-inhalt`}
          className="mt-2 max-h-64 overflow-y-auto rounded-xl bg-black/40 border border-white/10 p-4 text-sm text-white/70 whitespace-pre-line leading-relaxed"
        >
          {text}
        </div>
      )}
    </div>
  );
};

const ConsentBlockV3 = ({ consent, auswahl, onChange }: Props) => {
  const kanaele = hauptKanaele(consent);
  const kontaktAn = kontaktHakenGesetzt(auswahl);
  const kanalListe = kanaele.map((k) => KANAL_LABEL[k] ?? k).join(" und ");

  // Der Sammelknopf lohnt sich erst ab zwei Haken. Gibt es nur die
  // Versorgungs-Einwilligung (Betrieb ohne Kontaktkanaele), waere er ein
  // zweiter Weg zum selben einen Klick - und damit nur Rauschen.
  const allesAn = allesGewaehlt(consent, auswahl);
  const mehrAlsEinHaken = kanaele.length > 0 && !!consent.kontakt;

  return (
    <div className="space-y-6 pt-4">
      {/* „Alles auswaehlen" — Bedienhilfe, kein eigener Einwilligungstatbestand.
          Artur, 14.09.2026: ein Knopf oben, der alle Haken setzt und beim
          Abwaehlen alle wieder loest.

          Er traegt BEWUSST keinen Einwilligungs-Wortlaut: Er willigt in nichts
          ein, er bedient nur die Haken darunter. Der Nachweis bleibt der
          gehashte Wortlaut je Einwilligung; im Payload taucht dieser Knopf
          nicht auf.

          `allesGewaehlt` spiegelt den Zustand der Einzelhaken: waehlt jemand
          unten einen ab, geht der Knopf oben von selbst aus. Ohne diese
          Rueckkopplung behauptete er etwas, das nicht mehr stimmt.

          Nur sichtbar, wenn es ueberhaupt mehr als einen Haken gibt - bei einem
          einzigen waere eine Sammelbedienung nur ein zweiter Weg zum selben
          Klick. */}
      {mehrAlsEinHaken && (
        <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-3">
          <AuroraCheckbox
            id="consent-alles"
            checked={allesAn}
            onChange={(checked) => onChange(allesUmschalten(consent, auswahl, checked))}
            label="Alles auswählen"
          />
          <p className="pl-12 mt-1 text-xs text-white/40">
            Setzt alle Haken unten. Sie können jeden einzeln wieder abwählen.
          </p>
        </div>
      )}

      {/* Haken 1 — Versorgung. Pflicht: ohne ihn bleibt der Knopf gesperrt. */}
      <div>
        <AuroraCheckbox
          id="consent-versorgung"
          checked={auswahl.versorgung}
          onChange={(checked) => onChange({ ...auswahl, versorgung: checked })}
          label={consent.versorgung?.wortlaut ?? ""}
          required
        />
        {consent.versorgung?.detailtext && (
          <div className="pl-12">
            <Aufklapper
              id="detail-versorgung"
              titel="Details zur Versorgung"
              text={consent.versorgung.detailtext}
            />
          </div>
        )}
      </div>

      {/* Haken 2 — Kontakt. Freiwillig, eigene abgesetzte Erklaerung
          (BGH „Payback"), keine Warnfarbe wenn er leer bleibt. */}
      {kanaele.length > 0 && consent.kontakt && (
        <div className="border-t border-white/10 pt-6">
          <AuroraCheckbox
            id="consent-kontakt"
            checked={kontaktAn}
            onChange={(checked) => onChange(kontaktUmschalten(consent, auswahl, checked))}
            label={consent.kontakt.wortlaut}
          />

          {/* WhatsApp ist ein Unterkaestchen — nur wenn der Betrieb den Kanal
              anbietet, und nur zusammen mit dem Kontakt-Haken (sonst weist der
              Server den Payload mit 400 ab). */}
          {consent.whatsapp_option && (
            <div className={`pl-12 mt-4 transition-opacity ${kontaktAn ? "" : "opacity-40"}`}>
              <AuroraCheckbox
                id="consent-whatsapp"
                checked={auswahl.kanaele.includes("whatsapp")}
                onChange={(checked) => onChange(whatsappUmschalten(auswahl, checked))}
                label="auch per WhatsApp (Hinweis: Dienst von Meta, Verarbeitung in den USA)"
              />
            </div>
          )}

          {consent.kontakt.detailtext && (
            <div className="pl-12">
              <Aufklapper
                id="detail-kontakt"
                titel="Details zu Erinnerungen und Angeboten"
                text={consent.kontakt.detailtext}
              />
            </div>
          )}

          {kanalListe && (
            <p className="pl-12 mt-2 text-xs text-white/40">
              Betrifft: {kanalListe}. Post und Kundenportal siehe Details.
            </p>
          )}
        </div>
      )}

      {/* Ebene 3 — Datenschutzhinweise des Betriebs. Ersetzt die frueher
          fest eingebaute Seite /privacy, die den Text EINES Mandanten zeigte. */}
      {consent.datenschutzhinweise && (
        <div className="border-t border-white/10 pt-4">
          <Aufklapper
            id="datenschutzhinweise"
            titel="Datenschutzhinweise"
            text={consent.datenschutzhinweise.wortlaut}
          />
        </div>
      )}
    </div>
  );
};

export default ConsentBlockV3;
