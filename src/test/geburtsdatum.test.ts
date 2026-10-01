// CHECKIN-PRAXIS-1001 Punkt 4: Logik der drei Geburtsdatum-Felder (TT / MM / JJJJ).
import { describe, it, expect } from "vitest";
import { datumAusTeilen, teileAusIso, teileAusText, LEERE_TEILE } from "../lib/geburtsdatum";
import { autofillErlaubt, autofillKennung } from "../lib/eingabe-geraet";

const HEUTE = new Date(2026, 9, 1); // 01.10.2026, lokale Zeit

describe("datumAusTeilen", () => {
  it("leer und unvollständig ergeben noch keine Meldung", () => {
    expect(datumAusTeilen(LEERE_TEILE, HEUTE)).toEqual({ status: "leer" });
    expect(datumAusTeilen({ tag: "12", monat: "03", jahr: "198" }, HEUTE)).toEqual({ status: "unvollstaendig" });
    expect(datumAusTeilen({ tag: "", monat: "03", jahr: "1980" }, HEUTE)).toEqual({ status: "unvollstaendig" });
  });

  it("gültiges Datum wird zu YYYY-MM-DD, einstellige Teile werden ergänzt", () => {
    expect(datumAusTeilen({ tag: "12", monat: "03", jahr: "1980" }, HEUTE)).toEqual({ status: "gueltig", iso: "1980-03-12" });
    expect(datumAusTeilen({ tag: "5", monat: "7", jahr: "2001" }, HEUTE)).toEqual({ status: "gueltig", iso: "2001-07-05" });
  });

  it("29. Februar nur im Schaltjahr", () => {
    expect(datumAusTeilen({ tag: "29", monat: "02", jahr: "2000" }, HEUTE).status).toBe("gueltig");
    expect(datumAusTeilen({ tag: "29", monat: "02", jahr: "1999" }, HEUTE)).toEqual({
      status: "ungueltig",
      meldung: "Diesen Tag gibt es in dem Monat nicht.",
    });
  });

  it("Monat, Tag, Jahr und Zukunft werden verständlich abgewiesen", () => {
    expect(datumAusTeilen({ tag: "10", monat: "13", jahr: "1980" }, HEUTE)).toMatchObject({ status: "ungueltig", meldung: "Den Monat gibt es nicht (01 bis 12)." });
    expect(datumAusTeilen({ tag: "31", monat: "04", jahr: "1980" }, HEUTE)).toMatchObject({ status: "ungueltig" });
    expect(datumAusTeilen({ tag: "00", monat: "04", jahr: "1980" }, HEUTE)).toMatchObject({ status: "ungueltig" });
    expect(datumAusTeilen({ tag: "01", monat: "01", jahr: "1899" }, HEUTE)).toMatchObject({ status: "ungueltig", meldung: "Bitte das Geburtsjahr prüfen." });
    expect(datumAusTeilen({ tag: "02", monat: "10", jahr: "2026" }, HEUTE)).toMatchObject({ status: "ungueltig", meldung: "Das Geburtsdatum liegt in der Zukunft." });
    expect(datumAusTeilen({ tag: "01", monat: "10", jahr: "2026" }, HEUTE)).toEqual({ status: "gueltig", iso: "2026-10-01" });
  });
});

describe("teileAusIso / teileAusText", () => {
  it("zerlegt ein gespeichertes Datum und weist anderes ab", () => {
    expect(teileAusIso("1980-03-12")).toEqual({ tag: "12", monat: "03", jahr: "1980" });
    expect(teileAusIso("")).toEqual(LEERE_TEILE);
    expect(teileAusIso("12.03.1980")).toEqual(LEERE_TEILE);
  });

  it("erkennt eingefügte Schreibweisen", () => {
    expect(teileAusText("12.03.1980")).toEqual({ tag: "12", monat: "03", jahr: "1980" });
    expect(teileAusText(" 1.3.1980 ")).toEqual({ tag: "01", monat: "03", jahr: "1980" });
    expect(teileAusText("12/03/1980")).toEqual({ tag: "12", monat: "03", jahr: "1980" });
    expect(teileAusText("12031980")).toEqual({ tag: "12", monat: "03", jahr: "1980" });
    expect(teileAusText("1980-03-12")).toEqual({ tag: "12", monat: "03", jahr: "1980" });
    expect(teileAusText("März 1980")).toBeNull();
  });
});

describe("Auto-Ausfüllen je Gerät (Punkt 5)", () => {
  it("nur mit ?geraet=handy, sonst off", () => {
    expect(autofillErlaubt("?geraet=handy")).toBe(true);
    expect(autofillErlaubt("?x=1&geraet=handy")).toBe(true);
    expect(autofillErlaubt("")).toBe(false);
    expect(autofillErlaubt("?geraet=laden")).toBe(false);
    expect(autofillKennung(true, "given-name")).toBe("given-name");
    expect(autofillKennung(false, "given-name")).toBe("off");
  });
});
