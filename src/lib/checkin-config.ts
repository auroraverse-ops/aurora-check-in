// Runtime-Konfiguration für die Check-in App.
// Lädt Tenant-spezifisches Branding + Submit-Token von der checkin-config Edge Function.
// Fallback: VITE_STANDORT + VITE_N8N_WEBHOOK_URL (für AKZ-Legacy-Standorte).

import { safeRandomUUID } from './crypto-safe'

/**
 * Einwilligungs-Architektur T5/T6 (Spec §5.5, §11.1, §13.1).
 *
 * Der Server liefert Wortlaut UND Hash je Text. Das Tablet zeigt genau diesen
 * Wortlaut an und schickt den Hash zurück — `checkin-submit` vergleicht gegen
 * die aktive Version und antwortet 409 `consent_text_veraltet`, wenn das Tablet
 * einen überholten Text im Cache hatte. Der Hash wird deshalb NIE clientseitig
 * neu berechnet: er ist der Nachweis des Servers, nicht unsere eigene Rechnung.
 */
export interface ConsentTextBlock {
  version: number
  wortlaut: string
  detailtext: string | null
  hash: string
}

export type ConsentKanal = 'email' | 'sms' | 'whatsapp'

export interface ConsentConfig {
  modell: 'v2' | 'v3'
  /**
   * false, sobald ein Pflichttext für diesen Mandanten nicht freigegeben ist
   * (fail-closed, Spec S4/S5). Das Tablet zeigt dann eine Wartemeldung statt
   * eines improvisierten Ersatztextes.
   */
  verfuegbar: boolean
  grund: string | null
  /** Nur die Kanäle, die dieser Betrieb tatsächlich anbietet. */
  kanaele: ConsentKanal[]
  /** WhatsApp ist ein Unterkästchen — nur sichtbar, wenn der Kanal aktiv ist. */
  whatsapp_option: boolean
  versorgung: ConsentTextBlock | null
  kontakt: ConsentTextBlock | null
  datenschutzhinweise: { version: number; wortlaut: string } | null
}

export interface CheckinConfig {
  tenant_name: string
  tenant_slug: string
  filiale_name: string | null
  filiale_id: string | null
  logo_url: string | null
  welcome_text: string
  fields: {
    hobbys: boolean
    beschwerden: boolean
    bildschirmzeit: boolean
    // Marketing-Attribution (2026-07). Optional fuer Rueckwaertskompatibilitaet
    // mit aelteren Backend-Versionen der checkin-config Edge-Function.
    marketing_quelle?: boolean
  }
  /**
   * Tenant-Feature-Flags die das Formular beeinflussen.
   * Wird seit Edge-Function-Update 2026-04-15 ausgeliefert. Optional für
   * Rückwärtskompatibilität mit älteren Backend-Versionen.
   */
  features?: {
    akustik?: boolean
  }
  /**
   * Legacy: Hex-Override aus tenants.settings.checkin.primary_color.
   * Wenn gesetzt, gewinnt das ueber brand_color (Backwards-Compat fuer
   * Bestandskunden die bereits einen eigenen Hex-Wert konfiguriert haben).
   */
  primary_color: string | null
  /**
   * Welle 9 (2026-04-28): Tenant-Markenfarbe als HSL-Triplet aus tenant_theme.
   * Optional fuer Rueckwaertskompatibilitaet mit aelteren Backend-Versionen
   * der checkin-config Edge-Function.
   */
  brand_color?: {
    h: number
    s: number
    l: number
  }
  submit_url: string
  submit_token: string
  token_expires_at: number
  /**
   * T5 (2026-08-30): Einwilligungstexte + Kanalliste des Mandanten.
   * Optional — ältere Backend-Versionen liefern das Feld nicht, dann bleibt
   * das Tablet auf dem v2-Pfad.
   */
  consent?: ConsentConfig
}

// Config-API-URL — Default Testserver, überschreibbar per Env
const CONFIG_API_BASE = import.meta.env.VITE_SUPABASE_URL || 'https://supabase-test.askitech.de'

export async function fetchCheckinConfig(tenantSlug: string, filialeSlug?: string): Promise<CheckinConfig> {
  const params = new URLSearchParams({ tenant: tenantSlug })
  if (filialeSlug) params.set('filiale', filialeSlug)

  const res = await fetch(`${CONFIG_API_BASE}/functions/v1/checkin-config?${params}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unbekannter Fehler' }))
    throw new Error(err.error || `Config-Fehler (${res.status})`)
  }
  return res.json()
}

/**
 * Fehler eines Submit-Aufrufs samt Maschinen-Code des Servers.
 *
 * WARUM EIN EIGENER FEHLERTYP: `checkin-submit` antwortet bei einem
 * ueberholten Einwilligungstext mit HTTP 409 und `code: 'consent_text_veraltet'`.
 * Vorher warf diese Datei nur `err.error` — der Code ging verloren, und der
 * Client haette den Fall am deutschen Fehlertext erraten muessen. Ein Text ist
 * keine Schnittstelle: er darf sich aendern, ohne dass etwas bricht. Der Code
 * darf das nicht.
 */
export class CheckinSubmitError extends Error {
  readonly status: number
  readonly code: string | null

  constructor(message: string, status: number, code: string | null) {
    super(message)
    this.name = 'CheckinSubmitError'
    this.status = status
    this.code = code
  }
}

export async function submitCheckin(
  submitUrl: string,
  submitToken: string,
  data: Record<string, unknown>
): Promise<{ kunde_id: string; checkin_id: string; is_new_customer: boolean }> {
  // safeRandomUUID statt crypto.randomUUID(): letzteres crasht auf iOS Safari <15.4
  // bzw. im Non-Secure-Context (HTTP-Messe-Tablet). request_id dient nur der
  // Idempotenz — kein Sicherheitswert, Fallbacks daher unbedenklich.
  const requestId = safeRandomUUID()

  const res = await fetch(submitUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Checkin-Token': submitToken,
    },
    body: JSON.stringify({ ...data, request_id: requestId }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unbekannter Fehler' }))
    throw new CheckinSubmitError(
      err.error || `Submit-Fehler (${res.status})`,
      res.status,
      typeof err.code === 'string' ? err.code : null,
    )
  }

  return res.json()
}

// Legacy-Modus prüfen: Wenn VITE_STANDORT gesetzt ist, läuft die App im AKZ-Legacy-Modus
export function isLegacyMode(): boolean {
  return !!import.meta.env.VITE_STANDORT && !!import.meta.env.VITE_N8N_WEBHOOK_URL
}
