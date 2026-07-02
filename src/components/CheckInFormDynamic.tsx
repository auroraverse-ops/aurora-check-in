import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import GlassInput from "./GlassInput";
import SehhilfeCard from "./SehhilfeCard";
import AuroraCheckbox from "./AuroraCheckbox";
import ChipSelector from "./ChipSelector";
import BildschirmzeitSlider from "./BildschirmzeitSlider";
import { z } from "zod";
import type { CheckinConfig } from "@/lib/checkin-config";
import { CONSENT_TEXTS, hashConsentText } from "@/lib/consent-texts";
import { calculateAge } from "@/lib/age";

// Hobby-Kategorien (seit 2026-04-15: v2 Payload-Schema)
// Motorradfahren neu seit 2026-04, Golfen seit 2026-05.
const HOBBY_SPORT = ["Radfahren", "Motorradfahren", "Golfen", "Wandern", "Joggen", "Anderer Sport"];
const HOBBY_NAHARBEIT = ["Lesen", "Modellbau", "Puzzle"];
const HOBBY_OUTDOOR = ["Gartenarbeit"];
const HOBBY_OPTIONS_ALL = [...HOBBY_SPORT, ...HOBBY_NAHARBEIT, ...HOBBY_OUTDOOR];

const BESCHWERDE_OPTIONS = [
  "Trockene Augen", "Nackenschmerzen", "Lichtempfindlichkeit",
  "Nichts davon",
];

// Anrede — Pflichtfeld auf der Check-in-Seite. UI-Label "Sonstiges",
// DB-Wert "divers" (CHECK-Constraint kunden.anrede aus Mig 011).
const ANREDE_OPTIONS: { value: "herr" | "frau" | "divers"; label: string }[] = [
  { value: "herr",   label: "Herr" },
  { value: "frau",   label: "Frau" },
  { value: "divers", label: "Sonstiges" },
];

// Marketing-Attribution (2026-07): "Wie sind Sie auf uns aufmerksam geworden?".
// Werte deckungsgleich mit Backend (Mig 616 CHECK + checkin-submit Whitelist +
// CHECKIN_MARKETING_QUELLE_WERTE in @aurora-v2/shared).
const MARKETING_QUELLE_OPTIONS: { value: "empfehlung" | "suchmaschine" | "social_media" | "radio" | "zeitung_flyer" | "keine_angabe"; label: string }[] = [
  { value: "empfehlung",    label: "Empfehlung (Freunde, Bekannte, Partner)" },
  { value: "suchmaschine",  label: "Suchmaschine (z. B. Google)" },
  { value: "social_media",  label: "Instagram / Soziale Medien" },
  { value: "radio",         label: "Radio / Audio-Werbung" },
  { value: "zeitung_flyer", label: "Zeitung / Zeitschrift / Flyer" },
  { value: "keine_angabe",  label: "Keine Angabe" },
];

const checkInSchema = z.object({
  anrede: z.enum(["herr", "frau", "divers"], {
    errorMap: () => ({ message: "Bitte waehle eine Anrede aus" }),
  }),
  vorname: z.string().trim().min(1, "Vorname ist erforderlich").max(50),
  nachname: z.string().trim().min(1, "Nachname ist erforderlich").max(50),
  geburtsdatum: z.string().min(1, "Geburtsdatum ist erforderlich"),
  handy: z.string().trim().min(1, "Handynummer ist erforderlich").max(20),
  // F-06 (2026-05-30): email ist nur Pflicht wenn email_nicht_vorhanden = false.
  // Reine Laenge/Format-Pruefung hier, die bedingte Pflicht via superRefine unten.
  email: z.string().trim().max(100),
  email_nicht_vorhanden: z.boolean(),
  sehhilfe: z.array(z.string()).min(1, "Bitte wähle deine Sehhilfe aus"),
  hobbys: z.array(z.string()),
  bildschirmzeit: z.number().min(0).max(16),
  beschwerden: z.array(z.string()),
  gruppen_gespraeche: z.boolean().optional(),
  // Marketing-Attribution (2026-07): "Wie sind Sie auf uns aufmerksam geworden?".
  // Optional — leerer String = keine Auswahl (wird nicht gesendet).
  marketing_quelle: z.enum(['empfehlung', 'suchmaschine', 'social_media', 'radio', 'zeitung_flyer', 'keine_angabe']).or(z.literal('')).optional(),
  datenschutz: z.boolean(),
  erinnerung: z.boolean(),
}).superRefine((data, ctx) => {
  // F-06 (2026-05-30): "Keine E-Mail vorhanden"-Logik. Wenn das Flag NICHT
  // gesetzt ist, muss eine gueltige E-Mail vorliegen. Wenn gesetzt, ist das
  // Feld egal (Backend checkin-submit erwartet email_nicht_vorhanden + leere email).
  if (!data.email_nicht_vorhanden) {
    const emailCheck = z.string().email().safeParse(data.email);
    if (!emailCheck.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: "Ungültige E-Mail-Adresse (oder 'Keine E-Mail' ankreuzen)",
      });
    }
  }
});

interface Props {
  config: CheckinConfig;
  onSubmit: (data: Record<string, unknown>) => Promise<unknown>;
}

const AKUSTIK_AB_ALTER = 50;

const CheckInFormDynamic = ({ config, onSubmit }: Props) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (!isSuccess) return;
    const timer = setTimeout(() => setIsSuccess(false), 10000);
    return () => clearTimeout(timer);
  }, [isSuccess]);

  const [formData, setFormData] = useState({
    anrede: "" as "" | "herr" | "frau" | "divers",
    vorname: "",
    nachname: "",
    geburtsdatum: "",
    handy: "+49 ",
    email: "",
    email_nicht_vorhanden: false,
    sehhilfe: [] as string[],
    hobbys: [] as string[],
    bildschirmzeit: 10,
    beschwerden: [] as string[],
    gruppen_gespraeche: false,
    marketing_quelle: "" as "" | "empfehlung" | "suchmaschine" | "social_media" | "radio" | "zeitung_flyer" | "keine_angabe",
    datenschutz: false,
    erinnerung: true,
  });

  // Akustik-Frage: nur sichtbar wenn Feature-Flag aktiv UND Kunde >= 50 Jahre
  const alter = calculateAge(formData.geburtsdatum);
  const akustikAktiv = !!config.features?.akustik;
  const zeigeAkustikFrage = akustikAktiv && alter >= AKUSTIK_AB_ALTER;

  const handleInputChange = (field: string, value: string | boolean | string[] | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSehhilfeToggle = (type: string) => {
    // Seit 2026-04-15: "Keine" ist entfernt — ersetzt durch "Sonnenbrille ohne Stärke".
    // Mehrfachauswahl erlaubt (Brille + Sonnenbrille ist realistisch).
    setFormData((prev) => {
      const isSelected = prev.sehhilfe.includes(type);
      return {
        ...prev,
        sehhilfe: isSelected
          ? prev.sehhilfe.filter((s) => s !== type)
          : [...prev.sehhilfe, type],
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.datenschutz) {
      toast({
        title: "Datenschutz erforderlich",
        description: "Bitte akzeptiere die Datenschutzbestimmungen, um fortzufahren.",
        variant: "destructive",
      });
      return;
    }

    const result = checkInSchema.safeParse(formData);

    if (!result.success) {
      const firstError = result.error.errors[0];
      toast({
        title: "Fehler",
        description: firstError.message,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const consentTextHash = await hashConsentText(CONSENT_TEXTS.datenschutz.text);

      // v2 Payload — strukturiert, kein Matching mehr nötig
      const sehhilfeObj = {
        brille: formData.sehhilfe.includes("brille"),
        kontaktlinsen: formData.sehhilfe.includes("kontaktlinsen"),
        sonnenbrille_ohne_staerke: formData.sehhilfe.includes("sonnenbrille_ohne_staerke"),
      };

      const hobbysObj = {
        sport: formData.hobbys.filter((h) => HOBBY_SPORT.includes(h)),
        naharbeit: formData.hobbys.filter((h) => HOBBY_NAHARBEIT.includes(h)),
        outdoor: formData.hobbys.filter((h) => HOBBY_OUTDOOR.includes(h)),
      };

      const beschwerdenObj = {
        trockene_augen: formData.beschwerden.includes("Trockene Augen"),
        nackenschmerzen: formData.beschwerden.includes("Nackenschmerzen"),
        lichtempfindlichkeit: formData.beschwerden.includes("Lichtempfindlichkeit"),
      };

      const payload: Record<string, unknown> = {
        _schema: 2,
        anrede: result.data.anrede,
        vorname: result.data.vorname,
        nachname: result.data.nachname,
        geburtsdatum: result.data.geburtsdatum,
        handy: result.data.handy,
        // F-06 (2026-05-30): bei "Keine E-Mail vorhanden" leere email + Flag senden.
        // checkin-submit normalisiert email_nicht_vorhanden===true und setzt
        // kunden.email auf NULL (Edge Function index.ts:403-425).
        email: result.data.email_nicht_vorhanden ? "" : result.data.email,
        email_nicht_vorhanden: result.data.email_nicht_vorhanden,
        sehhilfe: sehhilfeObj,
        hobbys: hobbysObj,
        bildschirmzeit: result.data.bildschirmzeit,
        beschwerden: beschwerdenObj,
        datenschutz: result.data.datenschutz,
        erinnerung: result.data.erinnerung,
        consent_text_version: CONSENT_TEXTS.datenschutz.version,
        consent_text_hash: consentTextHash,
      };

      if (zeigeAkustikFrage) {
        payload.akustik = {
          gespraeche_in_gruppen: formData.gruppen_gespraeche,
        };
      }

      // Marketing-Attribution (2026-07): nur senden wenn der Kunde etwas ausgewaehlt
      // hat. Leerer String -> Feld weglassen (Backend speichert dann NULL).
      if (result.data.marketing_quelle) {
        payload.marketing_quelle = result.data.marketing_quelle;
      }

      await onSubmit(payload);
      setIsSuccess(true);
      setFormData({
        anrede: "",
        vorname: "",
        nachname: "",
        geburtsdatum: "",
        handy: "+49 ",
        email: "",
        email_nicht_vorhanden: false,
        sehhilfe: [],
        hobbys: [],
        bildschirmzeit: 10,
        beschwerden: [],
        gruppen_gespraeche: false,
        marketing_quelle: "",
        datenschutz: false,
        erinnerung: false,
      });
    } catch (error) {
      console.error("Check-in error:", error);
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Etwas ist schiefgelaufen. Bitte versuche es erneut.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-20 space-y-6">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
          style={{ background: 'hsl(var(--brand-h) var(--brand-s) var(--brand-l) / 0.2)' }}
        >
          <svg
            className="w-10 h-10"
            style={{ color: 'hsl(var(--brand-h) var(--brand-s) var(--brand-l))' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold text-white leading-snug">
          Willkommen bei {config.tenant_name},
        </h2>
        <p className="text-xl text-white/80 font-medium">
          Schön dass du da bist!
        </p>
        <p className="text-lg text-white/60">
          Es geht gleich los.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Anrede — Pflichtfeld, vor dem Namen. UI-Label "Sonstiges" -> DB "divers" */}
      <div className="space-y-4">
        <label className="form-label">
          Anrede <span className="form-label-required">*</span>
        </label>
        <div className="grid grid-cols-3 gap-4">
          {ANREDE_OPTIONS.map((opt) => {
            const active = formData.anrede === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleInputChange("anrede", opt.value)}
                className={`aurora-card flex-1 ${active ? 'active' : ''}`}
              >
                <span
                  className={`text-sm font-medium tracking-wide transition-all duration-300 ${
                    active ? 'text-white' : 'text-white/50'
                  }`}
                >
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Name Fields */}
      <div className="grid grid-cols-2 gap-5">
        <GlassInput
          id="vorname" label="Vorname" placeholder="Max"
          value={formData.vorname}
          onChange={(e) => handleInputChange("vorname", e.target.value)}
          required
        />
        <GlassInput
          id="nachname" label="Nachname" placeholder="Mustermann"
          value={formData.nachname}
          onChange={(e) => handleInputChange("nachname", e.target.value)}
          required
        />
      </div>

      <GlassInput
        id="geburtsdatum" label="Geburtsdatum" type="date"
        value={formData.geburtsdatum}
        onChange={(e) => handleInputChange("geburtsdatum", e.target.value)}
        required
      />

      <GlassInput
        id="handy" label="Handy" type="tel" placeholder="+49 170 1234567"
        value={formData.handy}
        onChange={(e) => handleInputChange("handy", e.target.value)}
        required
      />

      {/* F-06 (2026-05-30): E-Mail mit "Keine E-Mail vorhanden"-Option.
          Bei aktivierter Checkbox wird das Feld disabled + leert sich, und
          email_nicht_vorhanden=true geht an checkin-submit (Backend leert email
          + setzt Flag). Erinnerungs-Versand filtert solche Kunden raus. */}
      <div className="space-y-3">
        <GlassInput
          id="email" label="E-Mail" type="email"
          placeholder={formData.email_nicht_vorhanden ? "— Keine E-Mail vorhanden —" : "max@beispiel.de"}
          value={formData.email}
          onChange={(e) => handleInputChange("email", e.target.value)}
          disabled={formData.email_nicht_vorhanden}
          required={!formData.email_nicht_vorhanden}
        />
        <AuroraCheckbox
          id="email_nicht_vorhanden"
          checked={formData.email_nicht_vorhanden}
          onChange={(checked) => {
            setFormData((prev) => ({
              ...prev,
              email_nicht_vorhanden: checked,
              // Bei Aktivierung E-Mail-Feld leeren (Backend erwartet leere email)
              email: checked ? "" : prev.email,
            }));
          }}
          label="Keine E-Mail-Adresse vorhanden"
        />
      </div>

      {/* Sehhilfe — 2026-04-15: "Keine" entfernt, "Sonnenbrille ohne Stärke" neu */}
      <div className="space-y-4 pt-2">
        <label className="form-label">
          Deine bisherige Sehhilfe <span className="form-label-required">*</span>
        </label>
        <div className="grid grid-cols-3 gap-4">
          <SehhilfeCard
            type="brille" label="Brille"
            active={formData.sehhilfe.includes("brille")}
            onClick={() => handleSehhilfeToggle("brille")}
          />
          <SehhilfeCard
            type="kontaktlinsen" label="Kontaktlinsen"
            active={formData.sehhilfe.includes("kontaktlinsen")}
            onClick={() => handleSehhilfeToggle("kontaktlinsen")}
          />
          <SehhilfeCard
            type="sonnenbrille_ohne_staerke" label="Sonnenbrille ohne Stärke"
            active={formData.sehhilfe.includes("sonnenbrille_ohne_staerke")}
            onClick={() => handleSehhilfeToggle("sonnenbrille_ohne_staerke")}
          />
        </div>
      </div>

      {/* Optionale Felder — per Config gesteuert */}
      {config.fields.hobbys && (
        <ChipSelector
          label="Deine Hobbys" options={HOBBY_OPTIONS_ALL} noneOption="Nichts davon"
          selected={formData.hobbys}
          onChange={(val) => handleInputChange("hobbys", val)}
        />
      )}

      {config.fields.bildschirmzeit && (
        <BildschirmzeitSlider
          label="Durchschnittliche tägliche Bildschirmzeit"
          hint="(Smartphone, PC, Laptop, iPad, TV)"
          value={formData.bildschirmzeit}
          onChange={(val) => handleInputChange("bildschirmzeit", val)}
        />
      )}

      {config.fields.beschwerden && (
        <ChipSelector
          label="Deine Beschwerden" options={BESCHWERDE_OPTIONS} noneOption="Nichts davon"
          selected={formData.beschwerden}
          onChange={(val) => handleInputChange("beschwerden", val)}
        />
      )}

      {/* Akustik-Frage — nur bei aktivem Feature UND Alter >= 50 */}
      {zeigeAkustikFrage && (
        <div className="space-y-3 pt-2">
          <label className="form-label">Dein Hören</label>
          <AuroraCheckbox
            id="gruppen_gespraeche"
            checked={formData.gruppen_gespraeche}
            onChange={(checked) => handleInputChange("gruppen_gespraeche", checked)}
            label="Ich habe manchmal Probleme bei Gesprächen in Gruppen."
          />
        </div>
      )}

      {/* Marketing-Attribution (2026-07): "Wie sind Sie auf uns aufmerksam geworden?".
          Optionales Auswahlfeld am Flow-Ende, nur wenn im Backend aktiviert
          (config.fields.marketing_quelle, standardmaessig an). */}
      {config.fields.marketing_quelle && (
        <div className="space-y-3 pt-2">
          <label className="form-label">Wie sind Sie auf uns aufmerksam geworden?</label>
          <div className="grid gap-2">
            {MARKETING_QUELLE_OPTIONS.map((opt) => {
              const aktiv = formData.marketing_quelle === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleInputChange("marketing_quelle", aktiv ? "" : opt.value)}
                  aria-pressed={aktiv}
                  className={`min-h-12 rounded-xl border px-4 py-3 text-left text-base transition-colors ${
                    aktiv
                      ? "border-aurora-glow bg-aurora-glow/15 text-white"
                      : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Checkboxes */}
      <div className="space-y-5 pt-4">
        <AuroraCheckbox
          id="datenschutz"
          checked={formData.datenschutz}
          onChange={(checked) => handleInputChange("datenschutz", checked)}
          label={
            <>
              Ich habe die{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer"
                className="text-aurora-glow underline hover:text-white transition-colors"
                onClick={(e) => e.stopPropagation()}>
                Datenschutzbestimmungen
              </a>{" "}
              zur Kenntnis genommen und willige in die Verarbeitung meiner Angaben ein.
            </>
          }
          required
        />
        <AuroraCheckbox
          id="erinnerung"
          checked={formData.erinnerung}
          onChange={(checked) => handleInputChange("erinnerung", checked)}
          label="Ja, erinnere mich bitte kostenlos an meinen nächsten Augenvorsorgecheck (via SMS/E-Mail), damit meine Sehkraft optimal bleibt."
        />
      </div>

      {/* Submit */}
      <div className="pt-6">
        <button
          type="submit"
          disabled={isLoading || !formData.datenschutz}
          className="aurora-button"
        >
          {isLoading ? "WIRD VERARBEITET..." : "JETZT EINCHECKEN"}
        </button>
      </div>
    </form>
  );
};

export default CheckInFormDynamic;
