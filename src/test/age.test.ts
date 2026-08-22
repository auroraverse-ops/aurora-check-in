// ============================================================================
// AUR-RM-W3B-02 — calculateAge: Altersberechnung im Check-in
// ============================================================================
// Warum das ein Sicherheitsthema ist und nicht nur Arithmetik: das Alter
// steuert im Check-in, ob eine Einwilligung von der Person selbst oder von
// einer sorgeberechtigten Person kommen muss. Ein Fehler um ein Jahr an der
// Grenze fuehrt zu einer Einwilligung, die rechtlich nicht traegt.
//
// Der Modulkopf sagt: "Gibt 0 zurueck bei ungueltigem oder zukuenftigem
// Datum." Das ist ein FAIL-CLOSED-Versprechen — 0 bedeutet im Zweifel
// minderjaehrig, also die strengere Behandlung. Genau das wird hier gemessen.
//
// Alle Faelle nutzen ein FESTES Referenzdatum. Ein Test, der `new Date()`
// verwendet, wird am Geburtstag der Testperson rot und ist damit wertlos.
import { describe, it, expect } from 'vitest'
import { calculateAge } from '../lib/age'

const STICHTAG = new Date('2026-08-22T12:00:00Z')

describe('calculateAge — Normalfaelle', () => {
  it('rechnet volle Jahre', () => {
    expect(calculateAge('1990-08-22', STICHTAG)).toBe(36)
  })

  it('akzeptiert ein Date-Objekt genauso wie einen String', () => {
    expect(calculateAge(new Date('1990-08-22'), STICHTAG)).toBe(36)
  })
})

describe('calculateAge — die Grenze am Geburtstag', () => {
  it('am Geburtstag selbst zaehlt das Jahr bereits', () => {
    expect(calculateAge('2008-08-22', STICHTAG)).toBe(18)
  })

  it('einen Tag VOR dem Geburtstag noch nicht', () => {
    expect(calculateAge('2008-08-23', STICHTAG)).toBe(17)
  })

  it('einen Tag NACH dem Geburtstag weiterhin', () => {
    expect(calculateAge('2008-08-21', STICHTAG)).toBe(18)
  })

  // Monatswechsel ist die klassische Fehlerquelle bei dieser Rechnung.
  it('im Vormonat geboren: Jahr zaehlt', () => {
    expect(calculateAge('2008-07-31', STICHTAG)).toBe(18)
  })

  it('im Folgemonat geboren: Jahr zaehlt noch nicht', () => {
    expect(calculateAge('2008-09-01', STICHTAG)).toBe(17)
  })
})

describe('calculateAge — fail-closed bei ungueltiger Eingabe', () => {
  // 0 heisst im Check-in "im Zweifel minderjaehrig" — die strengere Behandlung.
  it('null ergibt 0', () => { expect(calculateAge(null, STICHTAG)).toBe(0) })
  it('undefined ergibt 0', () => { expect(calculateAge(undefined, STICHTAG)).toBe(0) })
  it('leerer String ergibt 0', () => { expect(calculateAge('', STICHTAG)).toBe(0) })
  it('unlesbares Datum ergibt 0', () => { expect(calculateAge('kein-datum', STICHTAG)).toBe(0) })
  it('Datum in der Zukunft ergibt 0', () => { expect(calculateAge('2030-01-01', STICHTAG)).toBe(0) })

  it('gibt NIE einen negativen Wert zurueck', () => {
    for (const eingabe of ['2099-12-31', '2027-01-01', 'unsinn', '']) {
      expect(calculateAge(eingabe, STICHTAG)).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('calculateAge — Schaltjahr', () => {
  it('29. Februar, Stichtag im Nicht-Schaltjahr am 28.02.', () => {
    expect(calculateAge('2008-02-29', new Date('2026-02-28T12:00:00Z'))).toBe(17)
  })

  it('29. Februar, Stichtag am 01.03.', () => {
    expect(calculateAge('2008-02-29', new Date('2026-03-01T12:00:00Z'))).toBe(18)
  })
})
