// CHECKIN-PRAXIS-1001 Punkt 4 (aurora-v2 docs/05-development/offene-punkte.md, Entscheidung Artur 01.10.2026):
// Das Geburtsdatum wird in drei Zahlenfeldern TT / MM / JJJJ erfasst statt mit der Datumsauswahl des Handys
// (iPhone-Rädchen, sieht auf jedem Gerät anders aus). Hier liegt die reine Logik: aus drei Teilen ein Datum
// 'YYYY-MM-DD' oder eine verständliche Meldung, und das Zerlegen eines eingefügten Datums ("12.03.1980").

export interface DatumTeile {
  tag: string;
  monat: string;
  jahr: string;
}

export const LEERE_TEILE: DatumTeile = { tag: "", monat: "", jahr: "" };

export type DatumErgebnis =
  | { status: "leer" }
  | { status: "unvollstaendig" }
  | { status: "ungueltig"; meldung: string }
  | { status: "gueltig"; iso: string };

const FRUEHESTES_JAHR = 1900;

function zweistellig(n: number): string {
  return String(n).padStart(2, "0");
}

function lokalesIso(d: Date): string {
  return `${d.getFullYear()}-${zweistellig(d.getMonth() + 1)}-${zweistellig(d.getDate())}`;
}

/** Drei Teile -> Datum. Erst wenn alle drei vollständig sind, gibt es eine Meldung; vorher nur "unvollständig". */
export function datumAusTeilen(t: DatumTeile, heute: Date = new Date()): DatumErgebnis {
  if (!t.tag && !t.monat && !t.jahr) return { status: "leer" };
  if (!t.tag || !t.monat || t.jahr.length < 4) return { status: "unvollstaendig" };

  const tag = Number(t.tag);
  const monat = Number(t.monat);
  const jahr = Number(t.jahr);
  if (![tag, monat, jahr].every(Number.isInteger)) {
    return { status: "ungueltig", meldung: "Bitte nur Ziffern eingeben." };
  }
  if (monat < 1 || monat > 12) {
    return { status: "ungueltig", meldung: "Den Monat gibt es nicht (01 bis 12)." };
  }
  if (jahr < FRUEHESTES_JAHR) {
    return { status: "ungueltig", meldung: "Bitte das Geburtsjahr prüfen." };
  }
  const tageImMonat = new Date(Date.UTC(jahr, monat, 0)).getUTCDate();
  if (tag < 1 || tag > tageImMonat) {
    return { status: "ungueltig", meldung: "Diesen Tag gibt es in dem Monat nicht." };
  }
  const iso = `${t.jahr}-${zweistellig(monat)}-${zweistellig(tag)}`;
  if (iso > lokalesIso(heute)) {
    return { status: "ungueltig", meldung: "Das Geburtsdatum liegt in der Zukunft." };
  }
  return { status: "gueltig", iso };
}

/** 'YYYY-MM-DD' -> Teile; alles andere -> leere Teile. */
export function teileAusIso(iso: string): DatumTeile {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? { tag: m[3], monat: m[2], jahr: m[1] } : { ...LEERE_TEILE };
}

/** Eingefügter Text ("12.03.1980", "1.3.1980", "12031980", "1980-03-12") -> Teile, sonst null. */
export function teileAusText(text: string): DatumTeile | null {
  const s = text.trim();
  const deutsch = /^(\d{1,2})[./\-\s]+(\d{1,2})[./\-\s]+(\d{4})$/.exec(s);
  if (deutsch) return { tag: deutsch[1].padStart(2, "0"), monat: deutsch[2].padStart(2, "0"), jahr: deutsch[3] };
  const acht = /^(\d{2})(\d{2})(\d{4})$/.exec(s);
  if (acht) return { tag: acht[1], monat: acht[2], jahr: acht[3] };
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) return { tag: iso[3], monat: iso[2], jahr: iso[1] };
  return null;
}
