import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const Privacy = () => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = 0.6;
    }
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      {/* High-End Aurora Video Background - Same as Index */}
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        className="fixed inset-0 w-screen h-screen object-cover z-0"
        poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Crect fill='%23000'/%3E%3C/svg%3E"
      >
        <source src="/aurora.mp4" type="video/mp4" />
      </video>
      
      {/* Dark Overlay for Readability */}
      <div className="fixed inset-0 bg-black/40 z-[1]" />
      
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
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-8">
            Datenschutzhinweise für den „Smart Check-in"
          </h1>

          <div className="space-y-6 text-white/70 leading-relaxed text-sm">
            {/* Verantwortlicher */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-2">Verantwortlicher</h2>
              <p>
                Optik & Akustik Mangold e.K. (Inhaber: Marcel Mangold)<br />
                Herrenstr. 19, 88353 Kißlegg<br />
                Telefon: 07563 / 616 99 40 • E-Mail: info@akz-gruppe.de • Internet: www.optikmangold.de
              </p>
            </section>

            {/* Datenschutzbeauftragter */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-2">Datenschutzbeauftragter</h2>
              <p>
                Ein Datenschutzbeauftragter ist nicht bestellt. Ansprechpartner für Datenschutzanfragen: siehe oben (Verantwortlicher).
              </p>
            </section>

            {/* 1. Zwecke und Rechtsgrundlagen */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-2">1. Zwecke und Rechtsgrundlagen der Verarbeitung</h2>
              
              <p className="font-medium text-white/90 mt-3">Check-in, Terminvorbereitung, Beratung/Verkauf, Führung der Kunden-/Messkartei</p>
              <p>
                – Verarbeitung Ihrer Stammdaten, Kontaktdaten sowie optischer Mess-/Sehwerte zur Vorbereitung und Durchführung Ihres Termins, zur Dokumentation und für Folge-/Serviceleistungen (z. B. Brillen-/Kontaktlinsen-Nachversorgung).<br />
                Rechtsgrundlagen: Vertrag/vertragsähnliches Verhältnis (Art. 6 Abs. 1 lit. b DSGVO); Verarbeitung von Gesundheitsdaten zur Gesundheitsversorgung durch Fachpersonal bzw. unter dessen Verantwortung (Art. 9 Abs. 2 lit. h DSGVO i. V. m. § 22 Abs. 1 Nr. 1 b BDSG).
              </p>

              <p className="font-medium text-white/90 mt-3">Abrechnung/Erfüllung gesetzlicher Pflichten</p>
              <p>
                – Buchführung/Steuern, Nachweispflichten.<br />
                Rechtsgrundlagen: gesetzliche Verpflichtung (Art. 6 Abs. 1 lit. c DSGVO) i. V. m. handels-/steuerrechtlichen Vorschriften (HGB/AO).
              </p>

              <p className="font-medium text-white/90 mt-3">Terminerinnerungen (optional)</p>
              <p>
                – E-Mail/SMS-Erinnerungen an Kontroll-/Servicetermine nur bei aktiv erteilter Einwilligung.<br />
                Rechtsgrundlage: Einwilligung (Art. 6 Abs. 1 lit. a DSGVO); Widerruf jederzeit mit Wirkung für die Zukunft (siehe Ziff. 7).
              </p>
            </section>

            {/* 2. Kategorien */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-2">2. Kategorien personenbezogener Daten</h2>
              <p>
                Stammdaten (Name, Anschrift), Kontaktdaten (Telefon, E-Mail), Termin-/Kommunikationsdaten, Seh-/Messwerte und Angaben zu Sehhilfen (besondere Daten i. S. v. Art. 9 DSGVO), Abrechnungs-/Zahlungsdaten.
              </p>
            </section>

            {/* 3. Empfänger */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-2">3. Empfänger/Kategorien von Empfängern</h2>
              <ul className="list-disc list-inside space-y-1">
                <li>Interne Stellen (Beratung, Verkauf, Werkstatt).</li>
                <li>IT-/Hosting-Dienstleister als Auftragsverarbeiter (z. B. Rechenzentrum/Branchensoftware) – verarbeiten ausschließlich nach Weisung; Verträge nach Art. 28 DSGVO bestehen.</li>
                <li>Weitere Empfänger nur, wenn erforderlich/rechtlich geboten (z. B. Steuerberater/Finanzbehörden im Rahmen von Aufbewahrungs-/Nachweispflichten).</li>
              </ul>
              <p className="mt-2">
                <strong className="text-white/90">Drittländer:</strong> Eine Übermittlung in Drittländer findet nicht statt. Sofern zukünftig Tools mit Sitz außerhalb der EU eingesetzt werden, informieren wir gesondert und stellen geeignete Garantien sicher (Art. 44 ff. DSGVO).
              </p>
            </section>

            {/* 4. Speicherfristen */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-2">4. Speicherfristen</h2>
              <ul className="list-disc list-inside space-y-1">
                <li><strong className="text-white/90">Kunden-/Messdaten:</strong> für die Dauer der Kundenbeziehung; darüber hinaus, soweit erforderlich, bis zum Ablauf der regelmäßigen Verjährungsfrist für wechselseitige Ansprüche (i. d. R. 3 Jahre ab Jahresende, § 195, § 199 BGB).</li>
                <li><strong className="text-white/90">Handels-/Steuerunterlagen</strong> (z. B. Rechnungen, Buchungsbelege, Korrespondenz): nach den gesetzlichen Fristen 6 Jahre (Handelsbriefe) bzw. 8/10 Jahre (buchungs-/steuerrelevante Unterlagen – je nach aktueller Rechtslage), gem. § 257 HGB und § 147 AO. Nach Fristablauf erfolgt Löschung bzw. Anonymisierung.</li>
              </ul>
            </section>

            {/* 5. Pflicht zur Bereitstellung */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-2">5. Pflicht zur Bereitstellung</h2>
              <p>
                Für Check-in, Terminabwicklung und ggf. gesetzliche Pflichten benötigen wir die abgefragten Pflichtfelder. Ohne diese Angaben kann der Check-in nicht durchgeführt werden. Die Einwilligung in Terminerinnerungen ist freiwillig und keine Voraussetzung für unsere Leistungen.
              </p>
            </section>

            {/* 6. Cookies */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-2">6. Cookies/Online-Technologien (Landing-Page)</h2>
              <p>
                Sofern auf der Landing-Page Cookies/Tracker eingesetzt werden, die nicht unbedingt erforderlich sind, holen wir vor Setzung Ihre Einwilligung nach § 25 TTDSG (Consent-Banner) ein; Details inkl. Anbieterliste und Speicherdauern finden Sie in der Website-Datenschutzerklärung. Essenzielle Cookies beruhen auf berechtigtem Interesse (Art. 6 Abs. 1 lit. f DSGVO).
              </p>
            </section>

            {/* 7. Ihre Rechte */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-2">7. Ihre Rechte</h2>
              <p>
                Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und – soweit die Verarbeitung auf Art. 6 Abs. 1 lit. e oder f beruht – Widerspruch aus Gründen, die sich aus Ihrer besonderen Situation ergeben (Art. 21 DSGVO).
              </p>
              <p className="mt-2">
                Einwilligungen (z. B. für Terminerinnerungen) können Sie jederzeit widerrufen. Die Rechtmäßigkeit der bis zum Widerruf erfolgten Verarbeitung bleibt unberührt. Zudem haben Sie ein Beschwerderecht bei einer Datenschutzaufsichtsbehörde, insbesondere in Baden-Württemberg:
              </p>
              <p className="mt-2 text-white/80">
                Der Landesbeauftragte für den Datenschutz und die Informationsfreiheit Baden-Württemberg (LfDI), Postfach 10 29 32, 70025 Stuttgart, E-Mail: poststelle@lfdi.bwl.de, www.baden-wuerttemberg.datenschutz.de.
              </p>
            </section>

            {/* 8. Quellen */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-2">8. Quellen der Daten / Automatisierte Entscheidungen</h2>
              <p>
                Daten erheben wir grundsätzlich bei Ihnen selbst (Check-in). Eine automatisierte Entscheidungsfindung/Profiling findet nicht statt.
              </p>
            </section>

            {/* 9. Aktualität */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-2">9. Aktualität dieser Hinweise</h2>
              <p>
                Wir passen diese Informationen an, wenn sich Rechtslage oder eingesetzte Dienste ändern. Die jeweils aktuelle Fassung ist unter www.optikmangold.de abrufbar.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
