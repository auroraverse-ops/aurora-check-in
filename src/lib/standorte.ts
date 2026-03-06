import logoKolan from "@/assets/akz-logo-kolan.png";
import logoMangold from "@/assets/akz-logo-mangold.png";
import logoZimmermann from "@/assets/akz-logo-zimmermann.png";

export const STANDORTE: Record<string, string> = {
  kisslegg: "Kißlegg",
  leutkirch: "Leutkirch",
  lindau: "Lindau",
  wangen: "Wangen",
};

const STANDORT_LOGOS: Record<string, string> = {
  kisslegg: logoMangold,
  leutkirch: logoMangold,
  lindau: logoKolan,
  wangen: logoZimmermann,
};

export function getStandortName(): string {
  const id = import.meta.env.VITE_STANDORT ?? "kisslegg";
  return STANDORTE[id] ?? id;
}

export function getStandortId(): string {
  return import.meta.env.VITE_STANDORT ?? "kisslegg";
}

export function getStandortLogo(): string {
  const id = import.meta.env.VITE_STANDORT ?? "kisslegg";
  return STANDORT_LOGOS[id] ?? logoMangold;
}
