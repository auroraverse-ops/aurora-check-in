// ============================================================================
// AUR-RM-W3B-02 — safeRandomUUID: Idempotenz-Kennung (Invariante I-2)
// ============================================================================
// Grundlage: aurora-v2/docs/06-testing/2026-08-22_public-input-invarianten.md
//   I-2: "Derselbe Vorgang wirkt hoechstens einmal fachlich."
//
// Die `request_id` traegt diese Invariante: der Server erkennt daran eine
// Wiederholung. Zwei Dinge muessen deshalb gelten, und beide sind hier
// gemessen statt angenommen:
//   1. Die Kennung ist eindeutig — kollidierende IDs wuerden zwei
//      verschiedene Check-ins als denselben behandeln und einen davon
//      verschlucken.
//   2. Sie entsteht AUCH ohne Web-Crypto. Auf HTTP-Tablets im Laden gibt es
//      weder `randomUUID` noch `getRandomValues`; wirft die Funktion dort,
//      kommt der Kunde nicht durch den Check-in.
//
// AUSDRUECKLICH NICHT GEPRUEFT: kryptografische Qualitaet. Der Modulkopf sagt
// klar, dass Fallback 3 (Math.random) NICHT kryptografisch ist und nur fuer
// die request_id taugt. Ein Test, der hier Zufallsguete behauptete, wuerde
// mehr versprechen als das Modul haelt.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { safeRandomUUID, isSecureCryptoAvailable } from '../lib/crypto-safe'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('safeRandomUUID — drei Fallback-Stufen', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('Stufe 1: nutzt den nativen Generator, wenn vorhanden', () => {
    expect(safeRandomUUID()).toMatch(UUID_V4)
  })

  it('Stufe 2: erzeugt eine gueltige v4-UUID, wenn randomUUID fehlt', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (a: Uint8Array) => { for (let i = 0; i < a.length; i += 1) a[i] = (i * 37) % 256; return a },
    })
    const id = safeRandomUUID()
    expect(id).toMatch(UUID_V4)
    // Version und Variant muessen gesetzt sein, sonst ist es keine v4-UUID.
    expect(id[14]).toBe('4')
    expect('89ab').toContain(id[19])
  })

  // Der Fall, der im Laden zaehlt: HTTP-Tablet ohne jede Web-Crypto.
  it('Stufe 3: wirft NICHT, wenn crypto voellig fehlt', () => {
    vi.stubGlobal('crypto', undefined)
    const id = safeRandomUUID()
    expect(id).toMatch(UUID_V4)
  })

  it('auch ohne crypto sind aufeinanderfolgende Kennungen verschieden', () => {
    vi.stubGlobal('crypto', undefined)
    const menge = new Set(Array.from({ length: 200 }, () => safeRandomUUID()))
    expect(menge.size).toBe(200)
  })

  it('mit nativem Generator sind 500 Kennungen kollisionsfrei', () => {
    const menge = new Set(Array.from({ length: 500 }, () => safeRandomUUID()))
    expect(menge.size).toBe(500)
  })
})

describe('isSecureCryptoAvailable — Weiche fuer den Consent-Hash', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('meldet true, wenn crypto.subtle vorhanden ist', () => {
    expect(isSecureCryptoAvailable()).toBe(true)
  })

  it('meldet false ohne crypto.subtle (Non-Secure-Context)', () => {
    vi.stubGlobal('crypto', { getRandomValues: () => new Uint8Array(16) })
    expect(isSecureCryptoAvailable()).toBe(false)
  })

  it('meldet false, wenn crypto ganz fehlt', () => {
    vi.stubGlobal('crypto', undefined)
    expect(isSecureCryptoAvailable()).toBe(false)
  })
})
