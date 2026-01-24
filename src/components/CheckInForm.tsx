import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import GlassInput from "./GlassInput";
import SehhilfeCard from "./SehhilfeCard";
import AuroraCheckbox from "./AuroraCheckbox";
import { z } from "zod";

const checkInSchema = z.object({
  vorname: z.string().trim().min(1, "Vorname ist erforderlich").max(50),
  nachname: z.string().trim().min(1, "Nachname ist erforderlich").max(50),
  geburtsdatum: z.string().min(1, "Geburtsdatum ist erforderlich"),
  handy: z.string().trim().min(1, "Handynummer ist erforderlich").max(20),
  email: z.string().trim().email("Ungültige E-Mail-Adresse").max(100),
  sehhilfe: z.enum(["brille", "kontaktlinsen", "keine"]),
  datenschutz: z.literal(true, {
    errorMap: () => ({ message: "Datenschutz muss akzeptiert werden" }),
  }),
  erinnerung: z.boolean(),
});

type CheckInData = z.infer<typeof checkInSchema>;

interface CheckInFormProps {
  webhookUrl?: string;
}

const CheckInForm = ({ webhookUrl }: CheckInFormProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    vorname: "",
    nachname: "",
    geburtsdatum: "",
    handy: "",
    email: "",
    sehhilfe: "" as "brille" | "kontaktlinsen" | "keine" | "",
    datenschutz: false,
    erinnerung: false,
  });

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const dataToValidate = {
      ...formData,
      sehhilfe: formData.sehhilfe || "keine",
    };

    const result = checkInSchema.safeParse(dataToValidate);
    
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
      const payload = {
        ...result.data,
        timestamp: new Date().toISOString(),
        source: "aurora-checkin",
      };

      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          mode: "no-cors",
          body: JSON.stringify(payload),
        });
      }

      console.log("Check-in data:", payload);

      toast({
        title: "Erfolgreich eingecheckt!",
        description: "Willkommen bei AURORA. Wir freuen uns auf Ihren Besuch.",
      });

      // Reset form
      setFormData({
        vorname: "",
        nachname: "",
        geburtsdatum: "",
        handy: "",
        email: "",
        sehhilfe: "",
        datenschutz: false,
        erinnerung: false,
      });
    } catch (error) {
      console.error("Check-in error:", error);
      toast({
        title: "Fehler",
        description: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Name Fields */}
      <div className="grid grid-cols-2 gap-5">
        <GlassInput
          id="vorname"
          label="Vorname"
          placeholder="Max"
          value={formData.vorname}
          onChange={(e) => handleInputChange("vorname", e.target.value)}
          required
        />
        <GlassInput
          id="nachname"
          label="Nachname"
          placeholder="Mustermann"
          value={formData.nachname}
          onChange={(e) => handleInputChange("nachname", e.target.value)}
          required
        />
      </div>

      {/* Birthdate */}
      <GlassInput
        id="geburtsdatum"
        label="Geburtsdatum"
        type="date"
        value={formData.geburtsdatum}
        onChange={(e) => handleInputChange("geburtsdatum", e.target.value)}
        required
      />

      {/* Contact Fields */}
      <GlassInput
        id="handy"
        label="Handy"
        type="tel"
        placeholder="+49 170 1234567"
        value={formData.handy}
        onChange={(e) => handleInputChange("handy", e.target.value)}
        required
      />
      
      <GlassInput
        id="email"
        label="E-Mail"
        type="email"
        placeholder="max@beispiel.de"
        value={formData.email}
        onChange={(e) => handleInputChange("email", e.target.value)}
        required
      />

      {/* Sehhilfe Selection */}
      <div className="space-y-4 pt-2">
        <label className="form-label">
          Sehhilfe <span className="form-label-required">*</span>
        </label>
        <div className="grid grid-cols-3 gap-4">
          <SehhilfeCard
            type="brille"
            label="Brille"
            active={formData.sehhilfe === "brille"}
            onClick={() => handleInputChange("sehhilfe", "brille")}
          />
          <SehhilfeCard
            type="kontaktlinsen"
            label="Kontaktlinsen"
            active={formData.sehhilfe === "kontaktlinsen"}
            onClick={() => handleInputChange("sehhilfe", "kontaktlinsen")}
          />
          <SehhilfeCard
            type="keine"
            label="Keine"
            active={formData.sehhilfe === "keine"}
            onClick={() => handleInputChange("sehhilfe", "keine")}
          />
        </div>
      </div>

      {/* Checkboxes */}
      <div className="space-y-5 pt-4">
        <AuroraCheckbox
          id="datenschutz"
          checked={formData.datenschutz}
          onChange={(checked) => handleInputChange("datenschutz", checked)}
          label={
            <>
              Ich habe die{" "}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-aurora-glow underline hover:text-white transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
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
          label="Ja, erinnert mich bitte zukünftig kostenlos an meinen nächsten Sehtest (via SMS/E-Mail), damit meine Sehkraft optimal bleibt."
        />
      </div>

      {/* Submit Button */}
      <div className="pt-6">
        <button
          type="submit"
          disabled={isLoading}
          className="aurora-button"
        >
          {isLoading ? "WIRD VERARBEITET..." : "JETZT EINCHECKEN"}
        </button>
      </div>
    </form>
  );
};

export default CheckInForm;
