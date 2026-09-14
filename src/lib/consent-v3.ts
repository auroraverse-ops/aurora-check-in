// Einwilligungs-Architektur T6 — Client-Seite des Payload-Vertrags v3.
//
// Gegenstueck zu aurora-v2 `supabase/functions/_shared/checkin/consent-v3.ts`.
// Absichtlich als reine Funktionen ohne React, damit die Regeln pruefbar sind,
// ohne ein Formular zu rendern.
//
// DREI REGELN, DIE HIER UND NUR HIER WOHNEN:
//  1. KEINE VORAUSWAHL. Beide Haken starten leer (Planet49 / BGH I ZR 7/16,
//     Spec E5/A5). Das alte Formular setzte `erinnerung: true` — genau das
//     faellt hier weg.
//  2. Der HASH KOMMT VOM SERVER. Wir berechnen ihn nicht selbst, wir reichen
//     ihn zurueck. Damit ist der Nachweis serverseitig geschlossen und der
//     Sentinel `no-subtle-crypto` (HTTP-Tablet ohne crypto.subtle) kann den
//     Check-in nicht mehr blockieren.
//  3. WhatsApp ist ein UNTERKAESTCHEN, nie ein eigenstaendiger Kanal.

import { CheckinSubmitError, type ConsentConfig, type ConsentKanal } from './checkin-config'

export const KANAL_REIHENFOLGE: ConsentKanal[] = ['email', 'sms', 'whatsapp']

/** Zustand der beiden Haken. Beide starten leer — siehe Regel 1. */
export interface ConsentAuswahl {
  versorgung: boolean
  kanaele: ConsentKanal[]
}

export const LEERE_AUSWAHL: ConsentAuswahl = { versorgung: false, kanaele: [] }

/**
 * Zeigt das Tablet das neue Check-in-Ende? Nur wenn der Mandant auf v3 steht
 * UND alle Pflichttexte freigegeben sind (fail-closed, Spec S4/S5).
 */
export function istV3Aktiv(consent: ConsentConfig | undefined): boolean {
  return !!consent && consent.modell === 'v3' && consent.verfuegbar
}

/**
 * v3 ist geschaltet, aber ein Text fehlt → Wartemeldung statt Ersatztext.
 * Bewusst getrennt von `istV3Aktiv`: „nicht v3" und „v3 kaputt" sind zwei
 * verschiedene Zustaende mit zwei verschiedenen Bildschirmen.
 */
export function zeigeWartemeldung(consent: ConsentConfig | undefined): boolean {
  return !!consent && consent.modell === 'v3' && !consent.verfuegbar
}

/** Kanaele des Betriebs ohne WhatsApp — WhatsApp ist das Unterkaestchen. */
export function hauptKanaele(consent: ConsentConfig): ConsentKanal[] {
  return KANAL_REIHENFOLGE.filter((k) => k !== 'whatsapp' && consent.kanaele.includes(k))
}

/** Ist der Kontakt-Haken gesetzt? Genau dann, wenn ein Hauptkanal gewaehlt ist. */
export function kontaktHakenGesetzt(auswahl: ConsentAuswahl): boolean {
  return auswahl.kanaele.some((k) => k !== 'whatsapp')
}

/**
 * Umschalten des Kontakt-Hakens. Beim Setzen werden alle Hauptkanaele des
 * Betriebs gewaehlt (der Wortlaut nennt sie gesammelt); beim Abwaehlen faellt
 * WhatsApp mit — ein Unterkaestchen ohne Hauptkaestchen waere ein Kanal ohne
 * Erklaerung, und der Server wiese ihn mit 400 ab.
 */
export function kontaktUmschalten(consent: ConsentConfig, auswahl: ConsentAuswahl, an: boolean): ConsentAuswahl {
  if (!an) return { ...auswahl, kanaele: [] }
  return { ...auswahl, kanaele: hauptKanaele(consent) }
}

/** WhatsApp-Unterkaestchen. Ohne gesetzten Kontakt-Haken bleibt es wirkungslos. */
export function whatsappUmschalten(auswahl: ConsentAuswahl, an: boolean): ConsentAuswahl {
  if (!kontaktHakenGesetzt(auswahl)) return auswahl
  const ohne = auswahl.kanaele.filter((k) => k !== 'whatsapp')
  return { ...auswahl, kanaele: an ? [...ohne, 'whatsapp'] : ohne }
}

/** „Jetzt einchecken" bleibt gesperrt, solange Haken 1 fehlt (Spec E8/§10.3). */
export function darfAbsenden(auswahl: ConsentAuswahl): boolean {
  return auswahl.versorgung === true
}

/* ──────────────────────────────────────────────────────────────────────────
 * „Alles auswaehlen" — eine BEDIENHILFE, keine Sammeleinwilligung
 * ──────────────────────────────────────────────────────────────────────────
 * Artur, 14.09.2026: ein Knopf oberhalb der Haken, der beim Druecken alle
 * setzt und beim Abwaehlen alle wieder loest.
 *
 * WARUM DAS ZULAESSIG IST — und wo die Grenze verlaeuft:
 * Regel 1 dieser Datei (KEINE VORAUSWAHL, Planet49) verbietet, dass ein Haken
 * VORGESETZT ist. Sie verbietet nicht, dass der Nutzer mehrere Haken mit einer
 * Handlung setzt. Der Unterschied ist die aktive Handlung:
 *   - vorangekreuzt        -> keine Einwilligung (Planet49)
 *   - ein Klick setzt alle -> Einwilligung, sofern jeder Haken danach
 *                             SICHTBAR gesetzt und EINZELN abwaehlbar ist
 * Genau das leistet diese Funktion: sie schreibt in denselben Zustand, den
 * auch die Einzelhaken schreiben. Es entsteht kein verborgener Sammelwert,
 * keine Ersatz-Zustimmung und kein eigener Nachweis - der Nachweis bleibt der
 * gehashte Wortlaut je Einwilligung.
 *
 * DESHALB IST DER ANFANGSZUSTAND IMMER `false`: Der Sammelknopf selbst darf
 * ebenso wenig vorgesetzt sein wie die Haken darunter.
 */

/**
 * Alles, was dieser Mandant ueberhaupt anbietet. Der Sammelknopf darf nichts
 * setzen, was der Betrieb nicht konfiguriert hat - sonst entstuende eine
 * Einwilligung ohne zugehoerigen Wortlaut, und der Server wiese sie ab.
 */
export function alleSetzbaren(consent: ConsentConfig): ConsentKanal[] {
  const haupt = hauptKanaele(consent)
  if (haupt.length === 0) return []
  return consent.whatsapp_option && consent.kanaele.includes('whatsapp')
    ? [...haupt, 'whatsapp']
    : haupt
}

/**
 * Ist gerade ALLES gewaehlt? Der Sammelknopf spiegelt damit den Zustand der
 * Einzelhaken - waehlt jemand unten einen ab, geht er oben von selbst aus.
 * Ohne diese Rueckkopplung behauptete der Knopf etwas, das nicht mehr stimmt.
 */
export function allesGewaehlt(consent: ConsentConfig, auswahl: ConsentAuswahl): boolean {
  if (!auswahl.versorgung) return false
  const setzbar = alleSetzbaren(consent)
  return setzbar.every((k) => auswahl.kanaele.includes(k))
}

/**
 * Umschalten des Sammelknopfes: an setzt alles, aus loest alles.
 *
 * Das Abwaehlen loest AUCH die Versorgungs-Einwilligung - obwohl sie Pflicht
 * ist. Absicht: ein Knopf, der beim Abwaehlen etwas stehen laesst, waere ein
 * Knopf, der nicht tut, was er sagt. Der Absende-Knopf sperrt danach ohnehin
 * (darfAbsenden), und der Nutzer sieht unmittelbar, was fehlt.
 */
export function allesUmschalten(consent: ConsentConfig, auswahl: ConsentAuswahl, an: boolean): ConsentAuswahl {
  if (!an) return { ...LEERE_AUSWAHL }
  return { versorgung: true, kanaele: alleSetzbaren(consent) }
}

/**
 * Ein einziger Ergebnistyp statt einer diskriminierten Union: dieses Projekt
 * faehrt mit `strictNullChecks: false` (tsconfig.app.json), und ohne
 * strictNullChecks verengt TypeScript eine Union an `if (!x.ok)` NICHT — der
 * Zugriff auf `x.fehler` waere dann ein Typfehler. Beide Felder optional zu
 * fuehren ist hier ehrlicher als eine Verengung vorzutaeuschen, die der
 * Compiler in dieser Konfiguration gar nicht leisten kann.
 */
export interface ConsentPayloadErgebnis {
  ok: boolean
  /** nur bei ok === false gesetzt */
  fehler?: string
  /** nur bei ok === true gesetzt */
  felder?: Record<string, unknown>
}

/**
 * Baut die Consent-Felder des v3-Payloads. Fail-closed: fehlt ein
 * Wortlaut-Nachweis, wird nicht gesendet — lieber ein Hinweis als eine
 * Einwilligung ohne belegbaren Text.
 */
export function baueConsentPayload(
  consent: ConsentConfig,
  auswahl: ConsentAuswahl,
): ConsentPayloadErgebnis {
  if (!auswahl.versorgung) return { ok: false, fehler: 'Einwilligung zur Versorgung erforderlich' }
  if (!consent.versorgung) return { ok: false, fehler: 'Einwilligungstext nicht verfuegbar' }

  const kanaele = auswahl.kanaele.filter((k) => consent.kanaele.includes(k))
  const felder: Record<string, unknown> = {
    consent_modell: 'v3',
    versorgung: true,
    // Immer alle drei Schluessel senden: ein weggelassener Kanal und ein
    // abgewaehlter Kanal sind fuer den Server dasselbe (er widerruft nie),
    // aber der ausdrueckliche false-Wert dokumentiert die Entscheidung.
    kontakt: {
      email: kanaele.includes('email'),
      sms: kanaele.includes('sms'),
      whatsapp: kanaele.includes('whatsapp'),
    },
    consent_versorgung_version: consent.versorgung.version,
    consent_versorgung_hash: consent.versorgung.hash,
  }

  if (kanaele.length > 0) {
    if (!consent.kontakt) return { ok: false, fehler: 'Einwilligungstext nicht verfuegbar' }
    felder.consent_kontakt_version = consent.kontakt.version
    felder.consent_kontakt_hash = consent.kontakt.hash
  }

  return { ok: true, felder }
}

/**
 * Erkennt die 409-Antwort `consent_text_veraltet`: der Wortlaut auf dem Tablet
 * ist aelter als der freigegebene. Dann NICHT speichern, sondern die Config neu
 * laden und den Kunden erneut bestaetigen lassen — eine Einwilligung in einen
 * Text, den der Kunde nie gesehen hat, waere kein Nachweis.
 *
 * Geprueft wird der Maschinen-Code, nicht die Fehlermeldung (siehe
 * `CheckinSubmitError`).
 */
export const CONSENT_VERALTET_HINWEIS =
  'Die Einwilligungstexte wurden gerade aktualisiert. Bitte lies sie kurz durch und bestaetige erneut.'

export function istWortlautVeraltet(fehler: unknown): boolean {
  return fehler instanceof CheckinSubmitError && fehler.code === 'consent_text_veraltet'
}
