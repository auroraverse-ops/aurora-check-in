// ============================================================================
// T6 — Das Check-in-Ende, wie der Kunde es sieht (Spec §11.1)
// ============================================================================
// Die Logik-Tests in `consent-v3.test.ts` sichern die Regeln. Hier wird
// gemessen, ob die Oberflaeche sie auch WIRKLICH umsetzt — eine korrekte
// Funktion nuetzt nichts, wenn die Komponente sie nicht aufruft oder den
// Haken doch vorbelegt rendert.
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ConsentBlockV3 from '../components/ConsentBlockV3'
import { LEERE_AUSWAHL, type ConsentAuswahl } from '../lib/consent-v3'
import type { ConsentConfig } from '../lib/checkin-config'

const VERSORGUNG_TEXT = 'Ich willige ausdruecklich ein, dass dieser Betrieb meine Gesundheitsdaten verarbeitet.'
const KONTAKT_TEXT = 'Ja, dieser Betrieb darf mich an Kontrollen erinnern.'

function config(over: Partial<ConsentConfig> = {}): ConsentConfig {
  return {
    modell: 'v3',
    verfuegbar: true,
    grund: null,
    kanaele: ['email'],
    whatsapp_option: false,
    versorgung: { version: 2, wortlaut: VERSORGUNG_TEXT, detailtext: 'Detailtext Versorgung', hash: 'a'.repeat(64) },
    kontakt: { version: 2, wortlaut: KONTAKT_TEXT, detailtext: 'Detailtext Kontakt', hash: 'b'.repeat(64) },
    datenschutzhinweise: { version: 3, wortlaut: 'Datenschutzhinweise des Betriebs' },
    ...over,
  }
}

function zeichne(c: ConsentConfig, auswahl: ConsentAuswahl = LEERE_AUSWAHL) {
  const onChange = vi.fn()
  render(<ConsentBlockV3 consent={c} auswahl={auswahl} onChange={onChange} />)
  return { onChange }
}

describe('Beide Haken sind beim Oeffnen leer', () => {
  it('rendert Versorgung und Kontakt unangehakt', () => {
    zeichne(config())
    expect(document.getElementById('consent-versorgung')).toHaveAttribute('aria-checked', 'false')
    expect(document.getElementById('consent-kontakt')).toHaveAttribute('aria-checked', 'false')
  })
})

describe('Die Texte kommen vom Server, nicht aus dem Bundle', () => {
  it('zeigt den Wortlaut des Mandanten am Haken', () => {
    zeichne(config())
    expect(screen.getByText(VERSORGUNG_TEXT)).toBeInTheDocument()
    expect(screen.getByText(KONTAKT_TEXT)).toBeInTheDocument()
  })

  it('zeigt Detailtext und Datenschutzhinweise erst nach dem Aufklappen (Ebene 2 und 3)', () => {
    zeichne(config())
    expect(screen.queryByText('Detailtext Versorgung')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Details zur Versorgung' }))
    expect(screen.getByText('Detailtext Versorgung')).toBeInTheDocument()

    expect(screen.queryByText('Datenschutzhinweise des Betriebs')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Datenschutzhinweise' }))
    expect(screen.getByText('Datenschutzhinweise des Betriebs')).toBeInTheDocument()
  })
})

describe('Kanaele werden je Mandant gezeigt', () => {
  it('blendet den Kontakt-Haken aus, wenn der Betrieb keinen Kanal anbietet', () => {
    zeichne(config({ kanaele: [] }))
    expect(document.getElementById('consent-versorgung')).toBeInTheDocument()
    expect(document.getElementById('consent-kontakt')).not.toBeInTheDocument()
  })

  it('zeigt das WhatsApp-Unterkaestchen nur, wenn der Kanal aktiv ist', () => {
    zeichne(config())
    expect(document.getElementById('consent-whatsapp')).not.toBeInTheDocument()

    zeichne(config({ kanaele: ['email', 'whatsapp'], whatsapp_option: true }))
    expect(document.getElementById('consent-whatsapp')).toBeInTheDocument()
  })

  it('benennt die betroffenen Kanaele unter dem Kontakt-Haken', () => {
    zeichne(config({ kanaele: ['email', 'sms'] }))
    expect(screen.getByText(/Betrifft: E-Mail und SMS/)).toBeInTheDocument()
  })
})

describe('Der Klick erzeugt genau die erwartete Auswahl', () => {
  it('setzt beim Versorgungs-Haken nur die Versorgung', () => {
    const { onChange } = zeichne(config())
    fireEvent.click(document.getElementById('consent-versorgung')!)
    expect(onChange).toHaveBeenCalledWith({ versorgung: true, kanaele: [] })
  })

  it('waehlt beim Kontakt-Haken alle Hauptkanaele des Betriebs', () => {
    const { onChange } = zeichne(config({ kanaele: ['email', 'sms'] }), { versorgung: true, kanaele: [] })
    fireEvent.click(document.getElementById('consent-kontakt')!)
    expect(onChange).toHaveBeenCalledWith({ versorgung: true, kanaele: ['email', 'sms'] })
  })

  // Die eigentliche Falle: WhatsApp anklicken, bevor der Kontakt-Haken sitzt.
  // Der Server wuerde das mit 400 abweisen — hier darf es gar nicht entstehen.
  it('ignoriert WhatsApp, solange der Kontakt-Haken nicht gesetzt ist', () => {
    const c = config({ kanaele: ['email', 'whatsapp'], whatsapp_option: true })
    const { onChange } = zeichne(c, { versorgung: true, kanaele: [] })
    fireEvent.click(document.getElementById('consent-whatsapp')!)
    expect(onChange).toHaveBeenCalledWith({ versorgung: true, kanaele: [] })
  })

  it('nimmt WhatsApp dazu, wenn der Kontakt-Haken sitzt', () => {
    const c = config({ kanaele: ['email', 'whatsapp'], whatsapp_option: true })
    const { onChange } = zeichne(c, { versorgung: true, kanaele: ['email'] })
    fireEvent.click(document.getElementById('consent-whatsapp')!)
    expect(onChange).toHaveBeenCalledWith({ versorgung: true, kanaele: ['email', 'whatsapp'] })
  })
})
