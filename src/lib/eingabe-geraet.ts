// CHECKIN-PRAXIS-1001 Punkt 5 (aurora-v2 docs/05-development/offene-punkte.md): Auto-Ausfüllen des Browsers.
//
// Auf dem eigenen Handy soll der Browser Name, Telefon und E-Mail vorschlagen. Auf einem gemeinsam genutzten
// Ladentablet darf er das nicht: er schlüge dem nächsten Kunden die Angaben des vorigen vor. Handy und Tablet rufen
// dieselbe Adresse auf (/:tenant/:filiale), die App kann sie nicht unterscheiden. Deshalb entscheidet der Link:
// nur mit ?geraet=handy sind die Kennungen an, sonst steht jedes Personenfeld auf autocomplete="off" (sicherer
// Standard für jedes Tablet, das niemand umgestellt hat).

export const GERAET_PARAMETER = "geraet";
export const GERAET_HANDY = "handy";

export function autofillErlaubt(search: string): boolean {
  return new URLSearchParams(search).get(GERAET_PARAMETER) === GERAET_HANDY;
}

/** Kennung für ein Feld: die passende autocomplete-Kennung, wenn erlaubt, sonst "off". */
export function autofillKennung(erlaubt: boolean, kennung: string): string {
  return erlaubt ? kennung : "off";
}
