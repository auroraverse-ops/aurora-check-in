// ============================================================================
// AUR-RM-W3B-02 — Einwilligungstexte und Consent-Hash (Invariante I-3)
// ============================================================================
// Grundlage: aurora-v2/docs/06-testing/2026-08-22_public-input-invarianten.md
//   I-3: "Ein Vorgang mit unvollstaendiger, widerrufener oder versionslos
//         protokollierter Einwilligung erzeugt keine Wirkung."
//
// Der Wortlaut IST der Nachweis (DSGVO Art. 7). Diese Tests sichern drei
// Dinge, die im Modulkopf als Pflicht stehen, bisher aber nur als Kommentar:
//   1. Jeder Text hat eine Version — ohne sie ist der Nachweis wertlos.
//   2. Der Wortlaut ist eingefroren. Aendert ihn jemand ohne Versionswechsel,
//      faellt dieser Test — genau das ist der Zweck.
//   3. Der Hash blockiert den Check-in NIE, auch nicht ohne crypto.subtle.
//
// WARUM DER WORTLAUT HIER WOERTLICH STEHT
//   Ein Test, der nur `text.length > 0` prueft, wuerde eine stille Aenderung
//   durchlassen — und damit genau den Fall, gegen den Art. 7 schuetzt. Der
//   Preis ist, dass dieser Test bei jeder Textaenderung angefasst werden muss.
//   Das ist gewollt: er ist die Bremse, nicht die Buchhaltung.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { CONSENT_TEXTS, CONSENT_HASH_UNAVAILABLE, hashConsentText } from '../lib/consent-texts'

describe('CONSENT_TEXTS — Wortlaut und Version sind der Nachweis', () => {
  it('jeder Einwilligungstext traegt eine Version', () => {
    for (const [schluessel, eintrag] of Object.entries(CONSENT_TEXTS)) {
      expect(eintrag.version, `${schluessel} ohne Version`).toMatch(/^v\d+$/)
    }
  })

  it('jeder Einwilligungstext ist nicht leer und kein Platzhalter', () => {
    for (const [schluessel, eintrag] of Object.entries(CONSENT_TEXTS)) {
      expect(eintrag.text.trim().length, `${schluessel} zu kurz`).toBeGreaterThan(40)
      expect(eintrag.text.toLowerCase(), `${schluessel} ist Platzhalter`).not.toContain('lorem')
      expect(eintrag.text, `${schluessel} enthaelt TODO`).not.toMatch(/TODO|FIXME|XXX/)
    }
  })

  // Der eigentliche Nachweis: eine Textaenderung OHNE Versionswechsel faellt hier.
  it('Datenschutz-Wortlaut v1 ist eingefroren', () => {
    expect(CONSENT_TEXTS.datenschutz.version).toBe('v1')
    expect(CONSENT_TEXTS.datenschutz.text).toBe(
      'Ich habe die Datenschutzbestimmungen zur Kenntnis genommen und willige in die Verarbeitung meiner Angaben ein.',
    )
  })

  it('Recall-Wortlaut v1 ist eingefroren', () => {
    expect(CONSENT_TEXTS.recall.version).toBe('v1')
    expect(CONSENT_TEXTS.recall.text).toBe(
      'Ja, erinnere mich bitte kostenlos an meinen naechsten Augenvorsorgecheck (via SMS/E-Mail), damit meine Sehkraft optimal bleibt.',
    )
  })

  // Werbliche Einwilligung braucht eine erkennbare Freiwilligkeit (Art. 7 Abs. 4).
  it('der Recall-Text ist als freiwillige Zusage formuliert', () => {
    expect(CONSENT_TEXTS.recall.text).toMatch(/^Ja,/)
  })
})

describe('hashConsentText — darf den Check-in NIE blockieren', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('berechnet einen SHA-256-Hex-Hash, wenn crypto.subtle vorhanden ist', async () => {
    const hash = await hashConsentText(CONSENT_TEXTS.datenschutz.text)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('derselbe Text ergibt denselben Hash (sonst waere er als Nachweis wertlos)', async () => {
    const a = await hashConsentText(CONSENT_TEXTS.datenschutz.text)
    const b = await hashConsentText(CONSENT_TEXTS.datenschutz.text)
    expect(a).toBe(b)
  })

  it('verschiedene Texte ergeben verschiedene Hashes', async () => {
    const a = await hashConsentText(CONSENT_TEXTS.datenschutz.text)
    const b = await hashConsentText(CONSENT_TEXTS.recall.text)
    expect(a).not.toBe(b)
  })

  // Befund CI-CRYPTO-02: auf HTTP-Tablets ist crypto.subtle undefined. Ein
  // ungeschuetzter Aufruf crasht den Submit — der Kunde kaeme nicht durch.
  it('gibt den Sentinel zurueck statt zu werfen, wenn crypto.subtle fehlt', async () => {
    vi.stubGlobal('crypto', { getRandomValues: () => new Uint8Array(16) })
    await expect(hashConsentText('beliebig')).resolves.toBe(CONSENT_HASH_UNAVAILABLE)
  })

  it('der Sentinel ist von einem echten Hash unterscheidbar', () => {
    expect(CONSENT_HASH_UNAVAILABLE).not.toMatch(/^[0-9a-f]{64}$/)
  })
})
