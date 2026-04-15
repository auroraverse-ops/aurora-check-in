// Lokaler Alter-Helper. Spiegel von @aurora-v2/shared/lib/date-helpers.
// Der Checkin-Repo ist Standalone ohne Zugriff aufs Aurora-Monorepo, daher duplizierter Code.
// Bei Änderungen BEIDE Seiten synchron halten (Skill /foundation berücksichtigen).

/** Alter in vollen Jahren zum heutigen Tag. Gibt 0 zurück bei ungültigem oder zukünftigem Datum. */
export function calculateAge(
  geburtsdatum: string | Date | null | undefined,
  referenceDate: Date = new Date(),
): number {
  if (!geburtsdatum) return 0
  const gd = geburtsdatum instanceof Date ? geburtsdatum : new Date(geburtsdatum)
  if (isNaN(gd.getTime())) return 0
  if (gd > referenceDate) return 0

  let age = referenceDate.getFullYear() - gd.getFullYear()
  const monthDiff = referenceDate.getMonth() - gd.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getDate() < gd.getDate())) {
    age--
  }
  return age
}
