// ra-w4 (aurora-v2 Plan 2026-09-27, V4): Impressum und Datenschutz des Betriebs
// liegen zentral auf mein(-test).auroraverse.de/<betrieb>/impressum|datenschutz.
// Der Check-in rendert keinen eigenen Rechtstext mehr, er verlinkt nur.
//
// Reine Funktionen ohne React, damit die Regeln ohne Formular pruefbar sind.

import type { CheckinConfig, Rechtsseiten } from './checkin-config'

// Nur unsere eigenen Domains; eine fremde Adresse aus einer manipulierten oder
// fehlerhaften Antwort wird nicht als Link ausgegeben.
const EIGENE = /^https:\/\/[a-z0-9-]+\.auroraverse\.de\/[a-z0-9]+(-[a-z0-9]+)*\/(impressum|datenschutz)$/

function eigeneAdresse(url: unknown, art: 'impressum' | 'datenschutz'): string | null {
  return typeof url === 'string' && EIGENE.test(url) && url.endsWith(`/${art}`) ? url : null
}

/** Beide Links, oder null, wenn der Server keine (gueltigen) Adressen liefert. */
export function rechtsLinks(
  config: Pick<CheckinConfig, 'rechtsseiten'> | null | undefined,
): { impressum: string; datenschutz: string } | null {
  const r = config?.rechtsseiten
  if (!r) return null
  const impressum = eigeneAdresse(r.impressum_url, 'impressum')
  const datenschutz = eigeneAdresse(r.datenschutz_url, 'datenschutz')
  return impressum && datenschutz ? { impressum, datenschutz } : null
}

/**
 * Sperrmeldung statt Formular (Stufe S3)? Nur bei ausdruecklichem
 * `impressum_gueltig === false`. Fehlt das Feld (aeltere Edge), laeuft der
 * Check-in weiter: die Sperre wird auf dem Server entschieden, nicht erraten.
 */
export function zeigeRechtsSperre(config: Pick<CheckinConfig, 'rechtsseiten'> | null | undefined): boolean {
  const r: Rechtsseiten | null | undefined = config?.rechtsseiten
  return !!r && r.impressum_gueltig === false
}
