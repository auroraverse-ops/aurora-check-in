// ============================================================================
// T6 — Payload-Vertrag v3 (Einwilligungs-Architektur, Spec §5.5 T6, §11.1)
// ============================================================================
// Diese Tests sichern die Regeln, die das Tablet gegenueber dem Kunden UND
// gegenueber `checkin-submit` einhalten muss. Sie sind bewusst so geschrieben,
// dass jede einzelne Regel FUER SICH faellt, wenn man sie bricht:
//
//   - Vorauswahl wieder einbauen   -> "beide Haken starten leer" faellt
//   - Sperre lockern               -> "ohne Haken 1 kein Absenden" faellt
//   - WhatsApp verselbststaendigen -> "WhatsApp nur mit Kontakt" faellt
//   - Hash lokal berechnen         -> "Hash kommt vom Server" faellt
//
// Gegenstueck auf der Serverseite: aurora-v2
// `supabase/functions/_shared/checkin/consent-v3.ts` (parseConsentV3).
import { describe, it, expect } from 'vitest'
import { CheckinSubmitError, type ConsentConfig } from '../lib/checkin-config'
import {
  LEERE_AUSWAHL,
  baueConsentPayload,
  darfAbsenden,
  hauptKanaele,
  istV3Aktiv,
  istWortlautVeraltet,
  kontaktHakenGesetzt,
  kontaktUmschalten,
  whatsappUmschalten,
  zeigeWartemeldung,
} from '../lib/consent-v3'

const HASH_V = 'a'.repeat(64)
const HASH_K = 'b'.repeat(64)

function config(over: Partial<ConsentConfig> = {}): ConsentConfig {
  return {
    modell: 'v3',
    verfuegbar: true,
    grund: null,
    kanaele: ['email'],
    whatsapp_option: false,
    versorgung: { version: 2, wortlaut: 'Versorgungstext', detailtext: 'Detail V', hash: HASH_V },
    kontakt: { version: 2, wortlaut: 'Kontakttext', detailtext: 'Detail K', hash: HASH_K },
    datenschutzhinweise: { version: 3, wortlaut: 'Hinweise' },
    ...over,
  }
}

describe('Keine Vorauswahl (Spec E5/A5, Planet49 / BGH I ZR 7/16)', () => {
  it('beide Haken starten leer', () => {
    expect(LEERE_AUSWAHL.versorgung).toBe(false)
    expect(LEERE_AUSWAHL.kanaele).toEqual([])
  })

  it('der Kontakt-Haken gilt erst als gesetzt, wenn ein Hauptkanal gewaehlt ist', () => {
    expect(kontaktHakenGesetzt(LEERE_AUSWAHL)).toBe(false)
    expect(kontaktHakenGesetzt({ versorgung: true, kanaele: ['email'] })).toBe(true)
  })
})

describe('Ohne Haken 1 kein Check-in (Spec E8, §10.3)', () => {
  it('gesperrt, solange die Versorgungs-Einwilligung fehlt', () => {
    expect(darfAbsenden(LEERE_AUSWAHL)).toBe(false)
    expect(darfAbsenden({ versorgung: false, kanaele: ['email'] })).toBe(false)
  })

  it('freigegeben, sobald sie gesetzt ist — auch ohne den freiwilligen Haken', () => {
    expect(darfAbsenden({ versorgung: true, kanaele: [] })).toBe(true)
  })

  it('der Payload wird ohne Haken 1 gar nicht erst gebaut', () => {
    const r = baueConsentPayload(config(), LEERE_AUSWAHL)
    expect(r.ok).toBe(false)
    expect(r.felder).toBeUndefined()
  })
})

describe('Kanaele je Mandant', () => {
  it('zeigt nur die Kanaele, die der Betrieb anbietet', () => {
    expect(hauptKanaele(config({ kanaele: ['email'] }))).toEqual(['email'])
    expect(hauptKanaele(config({ kanaele: ['email', 'sms'] }))).toEqual(['email', 'sms'])
  })

  it('WhatsApp zaehlt nie als Hauptkanal — es ist das Unterkaestchen', () => {
    const c = config({ kanaele: ['email', 'whatsapp'], whatsapp_option: true })
    expect(hauptKanaele(c)).toEqual(['email'])
  })

  it('setzt beim Anhaken alle Hauptkanaele des Betriebs', () => {
    const c = config({ kanaele: ['email', 'sms'] })
    expect(kontaktUmschalten(c, LEERE_AUSWAHL, true).kanaele).toEqual(['email', 'sms'])
  })

  it('nimmt beim Abhaken WhatsApp mit — ein Unterkaestchen ohne Hauptkaestchen gibt es nicht', () => {
    const c = config({ kanaele: ['email', 'whatsapp'], whatsapp_option: true })
    const vorher = { versorgung: true, kanaele: ['email' as const, 'whatsapp' as const] }
    expect(kontaktUmschalten(c, vorher, false).kanaele).toEqual([])
  })
})

describe('WhatsApp ist ein Unterkaestchen, kein eigener Kanal', () => {
  // Der Server weist "whatsapp ohne email/sms" mit 400 ab (parseConsentV3).
  // Diese Sperre sorgt dafuer, dass der Fall am Tablet gar nicht entstehen kann.
  it('laesst sich ohne gesetzten Kontakt-Haken nicht aktivieren', () => {
    expect(whatsappUmschalten(LEERE_AUSWAHL, true).kanaele).toEqual([])
  })

  it('laesst sich mit gesetztem Kontakt-Haken aktivieren und wieder abwaehlen', () => {
    const mitKontakt = { versorgung: true, kanaele: ['email' as const] }
    const an = whatsappUmschalten(mitKontakt, true)
    expect([...an.kanaele].sort()).toEqual(['email', 'whatsapp'])
    expect(whatsappUmschalten(an, false).kanaele).toEqual(['email'])
  })
})

describe('Der Wortlaut-Nachweis kommt vom Server, nicht vom Tablet', () => {
  it('reicht Version und Hash unveraendert zurueck', () => {
    const r = baueConsentPayload(config(), { versorgung: true, kanaele: ['email'] })
    expect(r.ok).toBe(true)
    expect(r.felder).toMatchObject({
      consent_modell: 'v3',
      versorgung: true,
      consent_versorgung_version: 2,
      consent_versorgung_hash: HASH_V,
      consent_kontakt_version: 2,
      consent_kontakt_hash: HASH_K,
    })
  })

  it('schickt ohne gewaehlten Kanal KEINEN Kontakt-Nachweis mit', () => {
    const r = baueConsentPayload(config(), { versorgung: true, kanaele: [] })
    expect(r.ok).toBe(true)
    expect(r.felder).not.toHaveProperty('consent_kontakt_version')
    expect(r.felder).not.toHaveProperty('consent_kontakt_hash')
    expect(r.felder?.kontakt).toEqual({ email: false, sms: false, whatsapp: false })
  })

  it('filtert Kanaele, die der Mandant gar nicht anbietet', () => {
    const r = baueConsentPayload(config({ kanaele: ['email'] }), {
      versorgung: true,
      kanaele: ['email', 'sms'],
    })
    expect((r.felder?.kontakt as Record<string, boolean>).sms).toBe(false)
  })

  it('sendet nicht, wenn der Versorgungstext fehlt (fail-closed)', () => {
    const r = baueConsentPayload(config({ versorgung: null }), { versorgung: true, kanaele: [] })
    expect(r.ok).toBe(false)
  })

  it('sendet nicht, wenn ein Kanal gewaehlt ist, aber der Kontakttext fehlt', () => {
    const r = baueConsentPayload(config({ kontakt: null }), { versorgung: true, kanaele: ['email'] })
    expect(r.ok).toBe(false)
  })
})

describe('v3 nur bei geschaltetem Mandanten und freigegebenen Texten (Spec S4/S5)', () => {
  it('ist aktiv bei modell v3 und verfuegbar', () => {
    expect(istV3Aktiv(config())).toBe(true)
  })

  it('ist inaktiv bei modell v2 — das alte Formular bleibt', () => {
    expect(istV3Aktiv(config({ modell: 'v2' }))).toBe(false)
    expect(zeigeWartemeldung(config({ modell: 'v2' }))).toBe(false)
  })

  it('ist inaktiv ohne consent-Block (aelteres Backend)', () => {
    expect(istV3Aktiv(undefined)).toBe(false)
    expect(zeigeWartemeldung(undefined)).toBe(false)
  })

  // Der Unterschied, auf den es ankommt: "nicht v3" zeigt das alte Formular,
  // "v3 ohne freigegebenen Text" zeigt eine Wartemeldung — nie einen Ersatztext.
  it('zeigt die Wartemeldung, wenn v3 geschaltet, aber ein Text nicht freigegeben ist', () => {
    const c = config({ verfuegbar: false, grund: 'Text nicht freigegeben: kontakt' })
    expect(istV3Aktiv(c)).toBe(false)
    expect(zeigeWartemeldung(c)).toBe(true)
  })
})

describe('409 consent_text_veraltet wird am Code erkannt, nicht am Text', () => {
  it('erkennt den Maschinen-Code', () => {
    expect(istWortlautVeraltet(new CheckinSubmitError('irgendwas', 409, 'consent_text_veraltet'))).toBe(true)
  })

  // Eine Fehlermeldung ist keine Schnittstelle: sie darf umformuliert werden,
  // ohne dass der Reload-Pfad still verloren geht.
  it('haelt einen anderen Fehler nicht faelschlich fuer veraltet', () => {
    expect(istWortlautVeraltet(new CheckinSubmitError('Ungueltiger Kanal', 400, null))).toBe(false)
    expect(istWortlautVeraltet(new Error('Wortlaut veraltet — bitte neu laden'))).toBe(false)
    expect(istWortlautVeraltet(null)).toBe(false)
  })
})
