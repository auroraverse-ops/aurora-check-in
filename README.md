# Aurora Smart Check-in

Stand: 30.08.2026

Mandantenfähige Check-in-Oberfläche für Aurora. Der aktuelle Code unterstützt zwei klar
getrennte Betriebsarten:

- Aurora: `/:tenant` und optional `/:tenant/:filiale`; Konfiguration wird aus der
  Check-in-Konfigurationsschnittstelle geladen.
- AKZ-Bestand: Root-Route mit `VITE_STANDORT` und `VITE_N8N_WEBHOOK_URL`.

Die maßgeblichen Quellen sind `src/App.tsx`, `src/lib/checkin-config.ts` und für die sichtbare
Datenschutzinformation `src/pages/Privacy.tsx`. Die frühere Lovable-Standardanleitung war kein
gültiger Projekteinstieg und wurde beim Dokumentationsaudit entfernt.

## Lokal prüfen

```bash
npm install
npm run build
```

Eine Beispielkonfiguration für den Bestandsmodus steht in `.env.example`. Sie enthält nur
Beispielwerte. Produktive Zieladressen und Zugangsdaten gehören in die geschützte
Deployment-Konfiguration und nicht in Git.

## Abgrenzung

Die Oberfläche allein belegt weder die Erreichbarkeit des Zielsystems noch eine erfolgreiche
Speicherung. Vor einem Release sind mindestens Konfigurationsabruf, Absenden, Fehlerpfad und
Datenschutzdarstellung gegen die vorgesehene Zielumgebung zu prüfen.
