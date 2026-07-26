# Aurora Check-in
- Änderungen als produktnahen Kundenkontakt behandeln: robuste Validierung, klare Fehlermeldungen und mobile Nutzung zuerst prüfen.
- Supabase-Zugriffe auf RLS, minimalen Datenumfang und Mandantenscope prüfen.
- Keine Zugangsdaten, Check-in- oder Kundendaten in Code, Logs oder Screenshots übernehmen.
- Bestehende Lovable- und lokale Änderungen nicht gegenseitig überschreiben; vor Push den aktuellen Git-Diff prüfen.
- Vor Abschluss Build, Lint und relevante Tests aus `package.json` ausführen.