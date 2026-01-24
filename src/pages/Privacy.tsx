import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const Privacy = () => {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated Aurora Background */}
      <div className="aurora-animated" />
      
      <div className="relative z-10 container max-w-2xl mx-auto px-6 py-10">
        {/* Back Link */}
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-aurora-glow hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Zurück zum Check-in</span>
        </Link>

        {/* Content Card */}
        <div className="glass-card p-8 md:p-12">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-8">
            Datenschutzhinweise für den Smart Check-in
          </h1>

          <div className="space-y-8 text-white/70 leading-relaxed">
            <p>
              Wir, das Augenkompetenzzentrum, nehmen den Schutz Ihrer persönlichen Daten sehr ernst.
            </p>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                1. Zweck der Datenverarbeitung
              </h2>
              <p>
                Die von Ihnen im Check-in-Formular eingegebenen Daten (Name, Kontaktdaten, Angaben zur Sehhilfe) 
                nutzen wir ausschließlich zur Vorbereitung und Durchführung Ihres heutigen Termins sowie zur 
                Führung Ihrer digitalen Kartei.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                2. Erinnerungsservice (Nur bei Einwilligung)
              </h2>
              <p>
                Sofern Sie die optionale Checkbox aktiviert haben, nutzen wir Ihre Handynummer oder E-Mail-Adresse, 
                um Sie in angemessenen Abständen an wichtige Kontrolltermine für Ihre Augengesundheit zu erinnern. 
                Diese Einwilligung können Sie jederzeit widerrufen.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                3. Speicherung & Weitergabe
              </h2>
              <p>
                Ihre Daten werden auf gesicherten Servern in Deutschland gespeichert (DSGVO-konform). 
                Eine Weitergabe an Dritte findet nicht statt, es sei denn, dies ist zur Vertragserfüllung notwendig.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                4. Ihre Rechte
              </h2>
              <p>
                Sie haben jederzeit das Recht auf Auskunft, Löschung oder Korrektur Ihrer bei uns gespeicherten Daten.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
