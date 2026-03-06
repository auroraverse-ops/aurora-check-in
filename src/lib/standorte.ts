export const STANDORTE: Record<string, string> = {
  kisslegg: "Kißlegg",
  leutkirch: "Leutkirch",
  lindau: "Lindau",
  wangen: "Wangen",
};

export function getStandortName(): string {
  const id = import.meta.env.VITE_STANDORT ?? "kisslegg";
  return STANDORTE[id] ?? id;
}

export function getStandortId(): string {
  return import.meta.env.VITE_STANDORT ?? "kisslegg";
}
