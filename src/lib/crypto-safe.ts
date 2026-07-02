// Secure-Context-sichere Crypto-Helfer fuer die Check-in App.
//
// Hintergrund (Audit 2026-07-02, CI-CRYPTO-01/02, Messe-Incident-Klasse):
// - `crypto.randomUUID()` existiert auf iOS Safari erst ab 15.4 UND nur im
//   Secure Context (HTTPS oder localhost). Auf HTTP am Messe-Tablet wirft der
//   Aufruf -> React-Render bricht ab -> weisser Bildschirm.
// - `crypto.subtle` ist ebenfalls nur im Secure Context vorhanden; bei HTTP
//   ist `crypto.subtle` schlicht `undefined`.
//
// Diese App hat kein `@aurora-v2/shared`, daher sind die Helfer hier lokal.

/**
 * Liefert eine UUID v4 (RFC4122) mit robusten Fallbacks:
 *   1. `crypto.randomUUID()`     — falls verfuegbar (Secure Context, iOS >= 15.4)
 *   2. `crypto.getRandomValues()` — RFC4122-v4 aus 16 Zufalls-Bytes zusammengesetzt
 *   3. `Math.random()`-Muster    — letzter Notnagel
 *
 * ACHTUNG zur Sicherheitsbewertung: Fallback 3 ist NICHT kryptografisch stark.
 * Das ist hier bewusst akzeptabel, weil `safeRandomUUID()` in dieser App
 * ausschliesslich fuer die harmlose `request_id` (reine Idempotenz beim Submit)
 * verwendet wird — NICHT fuer Tokens, Schluessel oder sonst etwas
 * Sicherheitsrelevantes. Fuer sicherheitskritische Werte NICHT verwenden.
 */
export function safeRandomUUID(): string {
  // Fallback 1: nativer Generator (bevorzugt)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID()
    } catch {
      // Manche aeltere WebViews haben die Funktion, werfen aber im
      // Non-Secure-Context — dann weiter zu Fallback 2.
    }
  }

  // Fallback 2: RFC4122 v4 aus 16 CSPRNG-Bytes
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    // Version (4) und Variant (10xx) setzen
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
    return (
      hex.slice(0, 4).join('') +
      '-' +
      hex.slice(4, 6).join('') +
      '-' +
      hex.slice(6, 8).join('') +
      '-' +
      hex.slice(8, 10).join('') +
      '-' +
      hex.slice(10, 16).join('')
    )
  }

  // Fallback 3: Math.random-basiertes UUID-aehnliches Muster (nur Notnagel,
  // NICHT kryptografisch — siehe Sicherheitshinweis oben; nur fuer request_id).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * True, wenn die Web-Crypto-Subtle-API verfuegbar ist (nur im Secure Context).
 * Wird genutzt, um `crypto.subtle`-Aufrufe (z.B. SHA-256 des Consent-Texts)
 * vor einem Crash auf HTTP-Tablets zu schuetzen.
 */
export function isSecureCryptoAvailable(): boolean {
  return typeof crypto !== 'undefined' && !!crypto.subtle
}
