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

import { isSecureCryptoAvailable } from './crypto-safe'

/**
 * Sentinel-Wert, wenn der SHA-256-Hash nicht berechnet werden konnte, weil
 * `crypto.subtle` fehlt (Non-Secure-Context / HTTP, z.B. Messe-Tablet).
 */
export const CONSENT_HASH_UNAVAILABLE = 'no-subtle-crypto'

/**
 * SHA-256 Hash eines Einwilligungstexts — ermoeglicht spaetere
 * Verifikation, dass der gespeicherte Wortlaut exakt diesem entspricht.
 *
 * WICHTIG (Audit 2026-07-02, CI-CRYPTO-02): `crypto.subtle` existiert nur im
 * Secure Context (HTTPS/localhost). Auf HTTP ist es `undefined` und ein
 * ungeschuetzter Aufruf crasht den Submit-Flow. Der Consent-Hash ist aber nur
 * eine Nice-to-have-Verifikation und darf den Check-in NIE blockieren — daher
 * geben wir bei fehlendem `crypto.subtle` bewusst einen klaren Sentinel-String
 * zurueck (statt zu werfen), damit der Submit weiterlaeuft und im Datensatz
 * erkennbar bleibt, dass der Hash nicht berechnet werden konnte.
 */
export async function hashConsentText(text: string): Promise<string> {
  if (!isSecureCryptoAvailable()) {
    return CONSENT_HASH_UNAVAILABLE
  }
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
