// DSGVO Art. 7 — Einwilligungs-Nachweis
// Exakter Wortlaut + Version, der dem Kunden zum Zeitpunkt der Einwilligung
// angezeigt wurde. Wird beim Submit mitgesendet und im Check-in dauerhaft
// gespeichert (kunden_checkins.einwilligungen).
//
// WICHTIG: Bei JEDER Aenderung am Wortlaut:
// 1. VERSION hochzaehlen (v1 -> v2 -> v3 ...)
// 2. UI-Text in CheckInFormDynamic.tsx entsprechend anpassen
// 3. Historische Versionen hier NIE loeschen (Audit-Nachweis)

export interface ConsentTextVersion {
  version: string
  text: string
}

export const CONSENT_TEXTS = {
  datenschutz: {
    version: 'v1',
    text: 'Ich habe die Datenschutzbestimmungen zur Kenntnis genommen und willige in die Verarbeitung meiner Angaben ein.',
  } satisfies ConsentTextVersion,
  recall: {
    version: 'v1',
    text: 'Ja, erinnere mich bitte kostenlos an meinen naechsten Augenvorsorgecheck (via SMS/E-Mail), damit meine Sehkraft optimal bleibt.',
  } satisfies ConsentTextVersion,
}

/**
 * SHA-256 Hash eines Einwilligungstexts — ermoeglicht spaetere
 * Verifikation, dass der gespeicherte Wortlaut exakt diesem entspricht.
 * Crypto.subtle ist in allen modernen Browsern + iOS Safari verfuegbar.
 */
export async function hashConsentText(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
