import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import GlassInput from "./GlassInput";
import SehhilfeCard from "./SehhilfeCard";
import AuroraCheckbox from "./AuroraCheckbox";
import ChipSelector from "./ChipSelector";
import BildschirmzeitSlider from "./BildschirmzeitSlider";
import { z } from "zod";
import type { CheckinConfig } from "@/lib/checkin-config";

const HOBBY_OPTIONS = [
  "Radfahren", "Wandern", "Joggen", "Anderer Sport",
  "Lesen", "Modellbau", "Puzzle", "Gartenarbeit",
  "Nichts davon",
];

const BESCHWERDE_OPTIONS = [
  "Trockene Augen", "Nackenschmerzen", "Lichtempfindlichkeit",
  "Nichts davon",
];

const checkInSchema = z.object({
  vorname: z.string().trim().min(1, "Vorname ist erforderlich").max(50),
  nachname: z.string().trim().min(1, "Nachname ist erforderlich").max(50),
  geburtsdatum: z.string().min(1, "Geburtsdatum ist erforderlich"),
  handy: z.string().trim().min(1, "Handynummer ist erforderlich").max(20),
  email: z.string().trim().email("Ungültige E-Mail-Adresse").max(100),
  sehhilfe: z.array(z.string()).min(1, "Bitte wähle deine Sehhilfe aus"),
  hobbys: z.array(z.string()),
  bildschirmzeit: z.number().min(0).max(16),
  beschwerden: z.array(z.string()),
  datenschutz: z.boolean(),
  erinnerung: z.boolean(),
});

interface Props {
  config: CheckinConfig;
  onSubmit: (data: Record<string, unknown>) => Promise<unknown>;
}

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
    vorname: "",
    nachname: "",
    geburtsdatum: "",
    handy: "+49 ",
    email: "",
    sehhilfe: [] as string[],
    hobbys: [] as string[],
    bildschirmzeit: 10,
    beschwerden: [] as string[],
    datenschutz: false,
    erinnerung: true,
  });

  const handleInputChange = (field: string, value: string | boolean | string[] | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSehhilfeToggle = (type: string) => {
    setFormData((prev) => {
      if (type === "keine") {
        return { ...prev, sehhilfe: prev.sehhilfe.includes("keine") ? [] : ["keine"] };
      }
      const withoutKeine = prev.sehhilfe.filter((s) => s !== "keine");
      const isSelected = withoutKeine.includes(type);
      return {
        ...prev,
        sehhilfe: isSelected ? withoutKeine.filter((s) => s !== type) : [...withoutKeine, type],
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
      await onSubmit(result.data);
      setIsSuccess(true);
      setFormData({
        vorname: "",
        nachname: "",
        geburtsdatum: "",
        handy: "+49 ",
        email: "",
        sehhilfe: [],
        hobbys: [],
        bildschirmzeit: 10,
        beschwerden: [],
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
        <div className="w-20 h-20 rounded-full bg-[#39E078]/20 flex items-center justify-center mb-4">
          <svg className="w-10 h-10 text-[#39E078]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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

      <GlassInput
        id="email" label="E-Mail" type="email" placeholder="max@beispiel.de"
        value={formData.email}
        onChange={(e) => handleInputChange("email", e.target.value)}
        required
      />

      {/* Sehhilfe */}
      <div className="space-y-4 pt-2">
        <label className="form-label">
          Deine Sehhilfe <span className="form-label-required">*</span>
        </label>
        <div className="grid grid-cols-3 gap-4">
          <SehhilfeCard type="brille" label="Brille" active={formData.sehhilfe.includes("brille")} onClick={() => handleSehhilfeToggle("brille")} />
          <SehhilfeCard type="kontaktlinsen" label="Kontaktlinsen" active={formData.sehhilfe.includes("kontaktlinsen")} onClick={() => handleSehhilfeToggle("kontaktlinsen")} />
          <SehhilfeCard type="keine" label="Keine" active={formData.sehhilfe.includes("keine")} onClick={() => handleSehhilfeToggle("keine")} />
        </div>
      </div>

      {/* Optionale Felder — per Config gesteuert */}
      {config.fields.hobbys && (
        <ChipSelector
          label="Deine Hobbys" options={HOBBY_OPTIONS} noneOption="Nichts davon"
          selected={formData.hobbys}
          onChange={(val) => handleInputChange("hobbys", val)}
        />
      )}

      {config.fields.bildschirmzeit && (
        <BildschirmzeitSlider
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
