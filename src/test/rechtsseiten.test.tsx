// ============================================================================
// ra-w4 — Rechtsseiten im Check-in (aurora-v2 Plan 2026-09-27, V4)
// ============================================================================
// Der Check-in verlinkt nur auf die zentralen Seiten des Betriebs. Gesichert
// wird: nur eigene Adressen werden Links, die Sperre greift nur bei einem
// ausdruecklichen `impressum_gueltig: false`, und die Fusszeile rendert beide.
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import RechtsFusszeile from '../components/RechtsFusszeile'
import { rechtsLinks, zeigeRechtsSperre } from '../lib/rechtsseiten'
import type { Rechtsseiten } from '../lib/checkin-config'

const GUELTIG: Rechtsseiten = {
  impressum_url: 'https://mein-test.auroraverse.de/akz-demo/impressum',
  datenschutz_url: 'https://mein-test.auroraverse.de/akz-demo/datenschutz',
  impressum_gueltig: true,
}

describe('rechtsLinks', () => {
  it('liefert beide Adressen des Betriebs', () => {
    expect(rechtsLinks({ rechtsseiten: GUELTIG })).toEqual({
      impressum: GUELTIG.impressum_url,
      datenschutz: GUELTIG.datenschutz_url,
    })
  })

  it('ohne Feld (aeltere Edge) oder mit null keine Links', () => {
    expect(rechtsLinks({})).toBeNull()
    expect(rechtsLinks({ rechtsseiten: null })).toBeNull()
    expect(rechtsLinks(null)).toBeNull()
  })

  it('fremde oder vertauschte Adressen werden keine Links', () => {
    for (const falsch of [
      { impressum_url: 'https://boese.example.com/akz-demo/impressum' },
      { impressum_url: 'http://mein.auroraverse.de/akz-demo/impressum' },
      { impressum_url: 'javascript:alert(1)' },
      { impressum_url: GUELTIG.datenschutz_url },
      { datenschutz_url: 'https://mein.auroraverse.de.boese.de/x/datenschutz' },
    ]) {
      expect(rechtsLinks({ rechtsseiten: { ...GUELTIG, ...falsch } }), JSON.stringify(falsch)).toBeNull()
    }
  })
})

describe('zeigeRechtsSperre', () => {
  it('sperrt nur bei ausdruecklichem impressum_gueltig = false (Stufe S3)', () => {
    expect(zeigeRechtsSperre({ rechtsseiten: { ...GUELTIG, impressum_gueltig: false } })).toBe(true)
  })

  it('laeuft weiter bei gueltig, fehlendem Feld oder null', () => {
    expect(zeigeRechtsSperre({ rechtsseiten: GUELTIG })).toBe(false)
    expect(zeigeRechtsSperre({})).toBe(false)
    expect(zeigeRechtsSperre({ rechtsseiten: null })).toBe(false)
    expect(zeigeRechtsSperre(undefined)).toBe(false)
  })
})

describe('RechtsFusszeile', () => {
  it('verlinkt Impressum und Datenschutz in einem neuen Tab', () => {
    render(<RechtsFusszeile config={{ rechtsseiten: GUELTIG }} />)
    const impressum = screen.getByRole('link', { name: 'Impressum' })
    const datenschutz = screen.getByRole('link', { name: 'Datenschutz' })
    expect(impressum).toHaveAttribute('href', GUELTIG.impressum_url)
    expect(datenschutz).toHaveAttribute('href', GUELTIG.datenschutz_url)
    expect(impressum).toHaveAttribute('target', '_blank')
    expect(impressum).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('rendert ohne gueltige Adressen nichts', () => {
    const { container } = render(<RechtsFusszeile config={{ rechtsseiten: null }} />)
    expect(container).toBeEmptyDOMElement()
  })
})
