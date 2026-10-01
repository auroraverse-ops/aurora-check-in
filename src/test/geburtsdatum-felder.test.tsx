// CHECKIN-PRAXIS-1001 Punkt 4: Die drei Geburtsdatum-Felder, wie der Kunde sie bedient.
// Gemessen wird, was die Oberfläche tut: Sprung ins nächste Feld, Meldung bei unmöglichem Datum, nach außen nur
// ein vollständiges Datum, Zurücksetzen nach dem Absenden, Einfügen, Autofill-Kennungen je Gerät.
import { useState } from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import GeburtsdatumFelder from "../components/GeburtsdatumFelder";

let setzeVonAussen: (v: string) => void = () => {};

function Rahmen({ autofill = false, start = "" }: { autofill?: boolean; start?: string }) {
  const [wert, setWert] = useState(start);
  setzeVonAussen = setWert;
  return (
    <>
      <GeburtsdatumFelder value={wert} onChange={setWert} autofill={autofill} required />
      <output data-testid="wert">{wert}</output>
    </>
  );
}

const tag = () => screen.getByLabelText("Tag") as HTMLInputElement;
const monat = () => screen.getByLabelText("Monat") as HTMLInputElement;
const jahr = () => screen.getByLabelText("Jahr") as HTMLInputElement;
const wert = () => screen.getByTestId("wert").textContent;

describe("GeburtsdatumFelder", () => {
  it("Ziffern-Tastatur, Sprung ins nächste Feld, vollständiges Datum nach außen", () => {
    render(<Rahmen />);
    expect(tag()).toHaveAttribute("inputmode", "numeric");
    tag().focus();
    fireEvent.change(tag(), { target: { value: "12" } });
    expect(document.activeElement).toBe(monat());
    fireEvent.change(monat(), { target: { value: "03" } });
    expect(document.activeElement).toBe(jahr());
    fireEvent.change(jahr(), { target: { value: "198" } });
    expect(wert()).toBe("");
    fireEvent.change(jahr(), { target: { value: "1980" } });
    expect(wert()).toBe("1980-03-12");
  });

  it("einzelne Ziffer, die nicht zweistellig werden kann, wird ergänzt und springt weiter", () => {
    render(<Rahmen />);
    fireEvent.change(tag(), { target: { value: "5" } });
    expect(tag().value).toBe("05");
    expect(document.activeElement).toBe(monat());
    fireEvent.change(monat(), { target: { value: "3." } });
    expect(monat().value).toBe("03");
    expect(document.activeElement).toBe(jahr());
  });

  it("Buchstaben werden verworfen", () => {
    render(<Rahmen />);
    fireEvent.change(jahr(), { target: { value: "19a8" } });
    expect(jahr().value).toBe("198");
  });

  it("unmögliches Datum: Meldung sichtbar, nach außen bleibt es leer", () => {
    render(<Rahmen />);
    fireEvent.change(tag(), { target: { value: "31" } });
    fireEvent.change(monat(), { target: { value: "02" } });
    fireEvent.change(jahr(), { target: { value: "1980" } });
    expect(screen.getByRole("alert")).toHaveTextContent("Diesen Tag gibt es in dem Monat nicht.");
    expect(wert()).toBe("");
    fireEvent.change(tag(), { target: { value: "28" } });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(wert()).toBe("1980-02-28");
  });

  it("Löschtaste im leeren Feld springt zurück", () => {
    render(<Rahmen />);
    monat().focus();
    fireEvent.keyDown(monat(), { key: "Backspace" });
    expect(document.activeElement).toBe(tag());
  });

  it("eingefügtes Datum füllt alle drei Felder", () => {
    render(<Rahmen />);
    fireEvent.paste(tag(), { clipboardData: { getData: () => "12.03.1980" } });
    expect([tag().value, monat().value, jahr().value]).toEqual(["12", "03", "1980"]);
    expect(wert()).toBe("1980-03-12");
  });

  it("Zurücksetzen von außen leert die Felder (nach dem Absenden)", () => {
    render(<Rahmen start="1980-03-12" />);
    expect([tag().value, monat().value, jahr().value]).toEqual(["12", "03", "1980"]);
    act(() => setzeVonAussen(""));
    expect([tag().value, monat().value, jahr().value]).toEqual(["", "", ""]);
  });

  it("Autofill-Kennungen nur auf dem Handy, sonst off", () => {
    const { unmount } = render(<Rahmen autofill />);
    expect(tag()).toHaveAttribute("autocomplete", "bday-day");
    expect(jahr()).toHaveAttribute("autocomplete", "bday-year");
    unmount();
    render(<Rahmen />);
    expect(tag()).toHaveAttribute("autocomplete", "off");
    expect(tag()).not.toHaveAttribute("name");
  });
});
