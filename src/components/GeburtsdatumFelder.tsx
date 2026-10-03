import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent, type RefObject } from "react";
import {
  LEERE_TEILE,
  datumAusTeilen,
  teileAusIso,
  teileAusText,
  type DatumTeile,
} from "@/lib/geburtsdatum";
import { autofillKennung } from "@/lib/eingabe-geraet";

// CHECKIN-PRAXIS-1001 Punkt 4: drei Zahlenfelder TT / MM / JJJJ statt der Datumsauswahl des Handys.
// Ziffern-Tastatur (inputMode numeric), Sprung ins nächste Feld, sobald eines voll ist; eine einzelne Ziffer, die
// nicht mehr zweistellig werden kann (Tag 4-9, Monat 2-9), wird zu "0x" ergänzt. Nach außen gibt es nur ein
// vollständiges, gültiges Datum 'YYYY-MM-DD' oder ''.

type Feld = keyof DatumTeile;

interface Props {
  value: string;
  onChange: (iso: string) => void;
  autofill: boolean;
  required?: boolean;
}

const LAENGE: Record<Feld, number> = { tag: 2, monat: 2, jahr: 4 };
const TRENNER = /[./\-\s,]/;

const GeburtsdatumFelder = ({ value, onChange, autofill, required }: Props) => {
  const [teile, setTeile] = useState<DatumTeile>(() => teileAusIso(value));
  const gemeldet = useRef(value);
  const tagRef = useRef<HTMLInputElement>(null);
  const monatRef = useRef<HTMLInputElement>(null);
  const jahrRef = useRef<HTMLInputElement>(null);
  const refs: Record<Feld, RefObject<HTMLInputElement>> = { tag: tagRef, monat: monatRef, jahr: jahrRef };
  const naechstes: Record<Feld, Feld | null> = { tag: "monat", monat: "jahr", jahr: null };
  const voriges: Record<Feld, Feld | null> = { tag: null, monat: "tag", jahr: "monat" };

  // Von außen gesetzt (Zurücksetzen nach dem Absenden): Felder nachziehen. Eigene Meldungen lösen nichts aus.
  useEffect(() => {
    if (value === gemeldet.current) return;
    gemeldet.current = value;
    setTeile(value ? teileAusIso(value) : { ...LEERE_TEILE });
  }, [value]);

  const aendern = (neu: DatumTeile) => {
    setTeile(neu);
    const ergebnis = datumAusTeilen(neu);
    const iso = ergebnis.status === "gueltig" ? ergebnis.iso : "";
    gemeldet.current = iso;
    if (iso !== value) onChange(iso);
  };

  const eingabe = (feld: Feld, roh: string) => {
    let ziffern = roh.replace(/\D/g, "").slice(0, LAENGE[feld]);
    const getrennt = feld !== "jahr" && TRENNER.test(roh) && ziffern.length === 1;
    const kannNichtZweistellig =
      ziffern.length === 1 && ((feld === "tag" && Number(ziffern) > 3) || (feld === "monat" && Number(ziffern) > 1));
    if (getrennt || kannNichtZweistellig) ziffern = `0${ziffern}`;
    aendern({ ...teile, [feld]: ziffern });
    const ziel = naechstes[feld];
    if (ziel && ziffern.length === LAENGE[feld]) refs[ziel].current?.focus();
  };

  const taste = (feld: Feld, e: KeyboardEvent<HTMLInputElement>) => {
    const ziel = voriges[feld];
    if (e.key === "Backspace" && teile[feld] === "" && ziel) {
      e.preventDefault();
      refs[ziel].current?.focus();
    }
  };

  const einfuegen = (e: ClipboardEvent<HTMLInputElement>) => {
    const erkannt = teileAusText(e.clipboardData.getData("text"));
    if (!erkannt) return;
    e.preventDefault();
    aendern(erkannt);
    jahrRef.current?.focus();
  };

  const ergebnis = datumAusTeilen(teile);
  const feld = (name: Feld, beschriftung: string, platzhalter: string, kennung: string) => (
    <div className="glass-input-wrapper">
      <input
        ref={refs[name]}
        id={`geburtsdatum-${name}`}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={LAENGE[name]}
        aria-label={beschriftung}
        aria-invalid={ergebnis.status === "ungueltig"}
        placeholder={platzhalter}
        autoComplete={autofillKennung(autofill, kennung)}
        name={autofill ? kennung : undefined}
        className="glass-input-field text-center"
        value={teile[name]}
        onChange={(e) => eingabe(name, e.target.value)}
        onKeyDown={(e) => taste(name, e)}
        onPaste={einfuegen}
        required={required}
      />
    </div>
  );

  return (
    // Kein space-y am fieldset: der Abstand kommt aus .form-label (mb-3); Ränder fallen bei legend nicht zusammen.
    <fieldset aria-describedby={ergebnis.status === "ungueltig" ? "geburtsdatum-meldung" : undefined}>
      <legend className="form-label">
        Geburtsdatum
        {required && <span className="form-label-required">*</span>}
      </legend>
      <div className="grid grid-cols-[1fr_1fr_1.6fr] gap-3">
        {feld("tag", "Tag", "TT", "bday-day")}
        {feld("monat", "Monat", "MM", "bday-month")}
        {feld("jahr", "Jahr", "JJJJ", "bday-year")}
      </div>
      {ergebnis.status === "ungueltig" && (
        <p id="geburtsdatum-meldung" role="alert" className="mt-3 text-sm text-red-300">
          {ergebnis.meldung}
        </p>
      )}
    </fieldset>
  );
};

export default GeburtsdatumFelder;
