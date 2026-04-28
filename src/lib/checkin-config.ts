// Runtime-Konfiguration für die Check-in App.
// Lädt Tenant-spezifisches Branding + Submit-Token von der checkin-config Edge Function.
// Fallback: VITE_STANDORT + VITE_N8N_WEBHOOK_URL (für AKZ-Legacy-Standorte).

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

export async function submitCheckin(
  submitUrl: string,
  submitToken: string,
  data: Record<string, unknown>
): Promise<{ kunde_id: string; checkin_id: string; is_new_customer: boolean }> {
  const requestId = crypto.randomUUID()

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
    throw new Error(err.error || `Submit-Fehler (${res.status})`)
  }

  return res.json()
}

// Legacy-Modus prüfen: Wenn VITE_STANDORT gesetzt ist, läuft die App im AKZ-Legacy-Modus
export function isLegacyMode(): boolean {
  return !!import.meta.env.VITE_STANDORT && !!import.meta.env.VITE_N8N_WEBHOOK_URL
}
