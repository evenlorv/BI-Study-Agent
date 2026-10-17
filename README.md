# BI Study Agent

En enkel statisk studieplanlegger for en økonomistudent ved BI. Førsteversjonen bruker tydelig merkede eksempeldata og har ingen AI, filopplasting eller eksterne integrasjoner.

## Publiser med GitHub Pages (når du er klar)

Prosjektet er klart for GitHub Pages, men publisering er ikke aktivert som del av klargjøringen. Ingen bygging, server, API-nøkkel eller installasjon på PC-en er nødvendig for å bruke den publiserte appen.

1. Sørg for at prosjektfilene er committet og pushet til `main` i `evenlorv/BI-Study-Agent`. `index.html`, `style.css`, `app.js` og `.nojekyll` skal ligge i roten av repositoryet. Endringer som bare finnes i Codex, er ikke automatisk tilgjengelige på GitHub.
2. Åpne repositoryet på GitHub og velg **Settings → Pages** (du trenger rettigheter til å endre innstillingene).
3. Under **Build and deployment**, velg **Deploy from a branch** som **Source**.
4. Velg **main** som branch og **/ (root)** som mappe. Trykk **Save**. Dette aktiverer publisering; vent med dette til du ønsker å publisere.
5. Vent til GitHub viser at utrullingen er ferdig. Du kan følge status under **Actions** eller **Settings → Pages**.
6. Åpne adressen GitHub oppgir. Med dagens repositorynavn og uten eget domene er forventet adresse `https://evenlorv.github.io/BI-Study-Agent/`.
7. Test ved å legge til en oppgave, registrere en økt og laste siden på nytt. Dataene skal fortsatt være der i samme nettleser.

Hvis du får 404, kontroller at utrullingen er ferdig, at du har valgt `main` og rotmappen, og at `index.html` ligger der. Pages må være tilgjengelig for repositoryets synlighet og GitHub-abonnement; GitHub viser dette i Pages-innstillingene. Senere push til valgt branch oppdaterer nettsiden automatisk.

Appen bruker relative filreferanser, slik at CSS og JavaScript lastes under `/BI-Study-Agent/`. `.nojekyll` markerer at filene skal serveres uten Jekyll-behandling. Det trengs ingen egen Actions-workflow.

GitHub Pages-versjonen lagrer fortsatt registreringene bare i nettleseren. Data fra en tidligere lokal adresse flyttes ikke automatisk over. `localStorage` er knyttet til nettstedets origin (protokoll og vertsnavn), ikke repositorymappen. Andre sider på samme `evenlorv.github.io`-origin deler derfor lagringsområde; denne appen bruker nøkkelen `bi-study-agent-v1`. Sletting av nettleserdata eller bytte av nettleser fjerner/endres tilgangen til lagrede registreringer. Ta sikkerhetskopier.

GitHub Pages serverer den statiske appen; registreringene dine sendes ikke til GitHub av appen. Nettsiden er normalt offentlig tilgjengelig, og filer som pushes til repositoryet er ikke privat brukerlagring. Ikke legg personlige pensumfiler, sikkerhetskopier eller API-nøkler i publiseringsmappen. En fremtidig OpenAI Agents SDK-backend kan ikke kjøres på GitHub Pages og må få en separat serverløsning.

## Start på din egen datamaskin

1. Installer Python 3 fra python.org hvis du ikke har det.
2. Last ned prosjektet fra GitHub og pakk det ut (eller klon det med Git).
3. Åpne en terminal i prosjektmappen, der `index.html` ligger.
4. Kjør:

   ```sh
   python3 -m http.server 8000 --bind 127.0.0.1
   ```

   På Windows kan du bruke `py -m http.server 8000 --bind 127.0.0.1`.

5. Åpne `http://127.0.0.1:8000` i nettleseren din. Hold terminalen åpen. Stopp serveren med Ctrl+C.

Ingen npm-installasjon, API-nøkkel eller database er nødvendig. Bruk samme nettleser og adresse hver gang for å finne igjen dataene.

## Bruk

- Velg dato og sett tilgjengelig studietid. Standard er fire timer per dag.
- Se karaktermål og sett egenvurdert pensumprogresjon for hvert fag.
- Erstatt eksempeldatoene med offisielle eksamensdatoer fra BI.
- Legg til oppgaver, kryss dem av eller slett dem.
- Registrer fag, minutter og hva du lærte. Økten lagres på valgt dato; dashboardet summerer dagens minutter.
- Last ned en JSON-sikkerhetskopi med knappen nederst. Automatisk import er ikke implementert ennå.

Progresjon i fag endres manuelt, fordi antall studieminutter alene ikke viser hvor mye du mestrer. Eksempelfagene er Investments, matematikk, kvantitativ finans og finansiell styring (mål A–B), samt Business Communication og organisasjon og ledelse (mål minst C).

## Lagring og begrensninger

Oppgaver, økter, eksamensdatoer, dagsmål og progresjon lagres i nettleserens `localStorage`. Ingen data sendes til en ekstern tjeneste. Data synkroniseres ikke mellom nettlesere eller maskiner, og sletting av nettleserdata fjerner dem. Privat modus kan slette data ved lukking. Sikkerhetskopier bør oppbevares trygt. «Tilbakestill» sletter registreringene etter bekreftelse.

Ingen automatisk prioritering, planjustering, faglig AI-hjelp eller kalenderintegrasjon finnes i denne versjonen. Appen er ikke en offisiell BI-tjeneste.

## Test selv

1. Sett dagens tilgjengelighet til 3 timer.
2. Legg til en oppgave og kryss den av.
3. Registrer en økt på 45 minutter: dashboardet skal vise 45 minutter registrert og 135 minutter igjen.
4. Endre fagprogresjon og en eksamensdato.
5. Last siden på nytt: alle endringene skal være bevart.
6. Velg en annen dato: dagsmålet skal være fire timer, med mindre du tidligere har endret denne datoen.
7. Last ned sikkerhetskopi og kontroller at JSON-filen inneholder oppgaven og økten.

Automatisert nettlesertest er også tilgjengelig dersom Playwright og Chromium er installert. Start serveren som over, og kjør i en annen terminal:

```sh
node tests/smoke.cjs
```

For å kontrollere prosjektstien som brukes av GitHub Pages, start i stedet serveren fra foreldremappen (`/workspace` i Codex), og kjør testen med `BASE_URL=http://127.0.0.1:8000/BI-Study-Agent/ node tests/smoke.cjs`.

Testen bruker en separat nettleserprofil og berører ikke dine egne nettleserdata. Sett `CHROMIUM_PATH` dersom Chromium ligger et annet sted enn `/usr/bin/chromium`. Playwright er bare nødvendig for denne testen, ikke for å bruke appen.

## Videre utvikling

Neste steg er en lokal backend med OpenAI Agents SDK, sikker håndtering av API-nøkkel på serversiden og søk i egne pensumfiler. API-nøkler skal aldri legges i nettleserkoden. Filstøtte, kildehenvisninger, planprioritering og kalenderintegrasjon kan bygges inn trinnvis etter at denne arbeidsflyten er prøvd ut.
