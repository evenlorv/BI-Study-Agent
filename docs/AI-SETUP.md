# AI-assistenten – første versjon

## Valgt arkitektur

Vi beholder den statiske nettsiden på GitHub Pages, designet og den eksisterende lagringsnøkkelen `bi-study-agent-v1`. Ingen migrering eller tilbakestilling kjøres. Nye dagsplaner legges til i et valgfritt `plans`-felt først etter godkjenning. Eksisterende oppgaver og øktnotater beholdes.

En separat Node.js 24-server snakker med OpenAI Responses API over HTTPS. Direkte API-bruk er enklere her enn et ekstra agentrammeverk: vi trenger bare noen få verktøy og en begrenset verktøyløkke, uten bakgrunnsjobber eller eksterne agenthandlinger. Det går an å innføre Agents SDK senere. Ingen npm-pakker kreves for backend.

Flyten er:

1. Du kobler til med backend-adresse og et privat tilgangstoken i chatpanelet.
2. Når du sender en melding, kopierer nettleseren studiedataene eksplisitt inn i en autentisert forespørsel. Backend kan ikke lese localStorage direkte.
3. Backend validerer dataene og sender dem og meldingen til OpenAI med verktøybeskrivelser. Modellen kan be om lesing av studiedata, foreslå oppgaver, foreslå dagsplan eller foreslå progresjon.
4. Verktøyene validerer forslagene og returnerer dem som «venter på godkjenning». De skriver aldri til nettleser eller database.
5. Nettsiden viser nøyaktig hvilke endringer som foreslås. Du velger **Godkjenn og lagre forslagene** eller **Avvis forslagene**. Et godkjent forslag lagres bare lokalt. Godkjenningen gjelder hele den viste gruppen.
6. Dersom fag, dato, tilgjengelighet eller andre studiedata er endret i mellomtiden, avvises godkjenningen. Dette gjelder også lagringsendringer fra en annen fane. Send en ny melding med oppdaterte data; last siden på nytt først hvis en annen fane endret lagringen. Dobbel godkjenning kan ikke opprette samme gruppe to ganger.

Godkjente dagsplaner vises under «Godkjent dagsplan» for valgt dato. De erstatter eventuell tidligere plan for samme dato, men oppretter ikke økter eller dobbeltregistrerer oppgaver. Senere økter eller endret tilgjengelighet justerer ikke lagrede planer automatisk; be om et nytt forslag.

## Planleggingsregler

Tilgjengelig tid er dagens valgte timetall, normalt fire timer utenom forelesninger, minus registrerte øktminutter den datoen. Planen kan ikke overstige dette budsjettet. Økter fordeles i blokker på maksimalt 50 minutter; pauser kommer i tillegg til selvstudietiden. Hvis du har null minutter igjen, foreslås ingen blokker.

Verktøyet rangerer fag med en enkel, forklarbar score: `(karaktervekt × andel som gjenstår) / (dager til eksamen + 3)`, med 1,5 som vekt for A–B og 1 for øvrige mål. Fag med passert eksamen eller 100 % egenvurdert mestring utelates. Blokker fordeles i prioritert rekkefølge og deretter på nytt fra toppen for å gi variasjon. Første åpne oppgave i faget brukes hvis den finnes. Dette er en enkel planleggingsheuristikk, ikke en garanti for karakterer. Progresjon endres bare gjennom din egen vurdering og godkjenning, aldri automatisk fra antall minutter.

## Hvilke data deles og lagres?

- Meldingen og inntil ti tidligere chatmeldinger sendes når du bruker AI.
- Fag, mål, eksamensdatoer, progresjon og oppgaver deles, sammen med valgt dato, tilgjengelige timer og øktenes fag/dato/minutter.
- Læringsnotatene fra øktene og lagrede dagsplaner sendes ikke. Backend fjerner ukjente datafelt.
- Backend har ingen database, logger ikke forespørselsinnhold eller token og lagrer ikke studiedata på disk. Hostingtilbyderens proxylogger må også konfigureres til å unngå forespørselskropper og Authorization-header.
- Chat og privat tilgangstoken beholdes i appens minne, ikke i localStorage. Omlasting eller **Koble fra og tøm chat** fjerner dem fra appen. Studiedataene beholdes.
- OpenAI-kall bruker `store: false`. Det deaktiverer lagring av Responses-objektet, men er ikke en garanti for null datalagring hos OpenAI: gjeldende API-personvern, misbrukslogging og prosjektvilkår gjelder. Unngå sensitive opplysninger i denne førsteversjonen.
- Ikke legg sikkerhetskopier, pensumfiler eller hemmeligheter i GitHub Pages-mappen. API-et har ingen opplasting, filsystemtilgang eller URL-hentingsverktøy.

## Sikkerhet og tilgang

Dette er en **personlig løsning for én bruker**. Alle AI-forespørsler krever et langt, tilfeldig, privat bearer-token. Et offentlig nettsted får ikke tilgang bare ved å kjenne API-adressen. Token er et serverpassord, ikke OpenAI-nøkkelen. Legg det aldri i nettsidekoden, URL-parametere, GitHub, skjermbilder eller chat. Den som får tokenet, kan bruke din AI-backend; roter det i hostinginnstillingene ved mistanke om lekkasje. Ikke del dette oppsettet som en flerbrukertjeneste. Da trengs individuell innlogging, brukerskillet datalagring og varige kvoter.

CORS tillater bare eksakte konfigurerte origins. For din GitHub Pages-side er dette `https://evenlorv.github.io`, uten `/BI-Study-Agent/`. CORS er bare nettleserkontroll; det private tokenet er den faktiske autentiseringen. Tilgangstokenet sendes kun til backend, og backend sender bare OpenAI-nøkkelen videre til OpenAI.

Bruk HTTPS i drift. Backend har begrensning på datamengde, validering av alle input, autentisering, begrenset antall verktøyrunder, én samtidig AI-forespørsel, 30 forespørselsforsøk per minutt per tilkoblings-IP og konfigurerbar total dagsgrense. Bak en proxy kan IP-grensen gjelde alle brukere samlet. Dagsgrensen nullstilles ved serverstart og UTC-døgnskifte, og gjelder forespørsler, ikke dollar. Ett chatspørsmål kan gi opptil fire OpenAI-kall. Dette er ikke et varig kostnadstak. Bruk én backend-instans, lave OpenAI-prosjektgrenser der de finnes og kostnadsvarsler. Ikke aktiver automatisk skalering uten en felles kvote-/rate-limit-løsning.

Alle modellforslag valideres også i nettleseren og vises som ren tekst. Backend kan ikke instruere appen til å kjøre vilkårlig kode eller overskrive hele localStorage. Hvis lagringen feiler, beholdes gammel aktiv tilstand. Ingen tillatelsesknapp kan gi tilgang til ikke-implementerte verktøy.

## Konfigurasjon (bare backend)

| Variabel | Verdi |
| --- | --- |
| `OPENAI_API_KEY` | Privat OpenAI-prosjektnøkkel, bare på serveren |
| `STUDY_ACCESS_TOKEN` | Tilfeldig token med minst 32 tegn; anbefalt 32 tilfeldige bytes i hex |
| `OPENAI_MODEL` | Standard `gpt-4.1-mini`; velg en modell tilgjengelig i prosjektet som støtter Responses API og function calling |
| `ALLOWED_ORIGINS` | Kommadelt liste med eksakte origins, uten avsluttende skråstrek eller sti |
| `HOST` | `127.0.0.1` lokalt, `0.0.0.0` i en driftsplattform som krever dette |
| `PORT` | Standard `8787`; bruk plattformens verdi i drift |
| `MAX_REQUESTS_PER_DAY` | Standard `30`; start gjerne lavere under utprøving |

`backend/.env.example` har bare plassholdere. Serveren nekter å starte uten nøkkel og et tilstrekkelig langt tilgangstoken. Den avslører ikke nøkkelverdier i feilsvar. Frontend ber aldri om OpenAI-nøkkelen.

## Lokal oppstart for utvikling

Denne delen gjelder lokal utvikling eller interne tester i skyen. Localhost i Codex er fortsatt ikke en offentlig nettadresse; denne onboardingvisningen gir ikke webforhåndsvisning.

1. Bruk Node.js 24. Ingen `npm install` er nødvendig for backend.
2. Opprett en privat miljøfil **utenfor prosjektet og alle mapper som serveres av webserveren**, for eksempel `~/.config/bi-study-agent/backend.env`. Kopier variabelnavnene fra eksempelfilen og fyll verdiene privat. Ikke opprett en ekte `.env` inne i en mappe som `python -m http.server` serverer. Bruk restriktive filrettigheter (f.eks. `chmod 600`) på systemer som støtter det.
3. Generer et tilfeldig tilgangstoken privat på din maskin med `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Lagre dette i den private miljøfilen. API-nøkkelen hentes fra OpenAI-prosjektet ditt, aldri via chat.
4. Kjør i prosjektmappen, med korrekt filsti:

   ```sh
   node --env-file="$HOME/.config/bi-study-agent/backend.env" backend/server.mjs
   ```

5. I en annen terminal, start frontend fra prosjektmappen:

   ```sh
   python3 -m http.server 8000 --bind 127.0.0.1
   ```

6. Bruk `ALLOWED_ORIGINS=http://127.0.0.1:8000`. Åpne frontend på denne adressen. I AI-panelets tilkobling oppgir du `http://127.0.0.1:8787` og ditt private tilgangstoken. Trykk **Koble til**. Knappen tester health og autentisering uten studiedata eller OpenAI-kall. Den første chatmeldingen tester OpenAI.
7. Be om en dagsplan, se forhåndsvisningen og godkjenn. Kontroller at en plan først blir synlig som godkjent etter ditt klikk. Avvis et nytt forslag og kontroller at data ikke endres.

Endringer i miljøvariabler krever omstart av backend. Ikke bruk et offentlig tunnelverktøy eller deploy nøkler for å gjøre denne utviklingstesten offentlig.

## Hostingoppsett og nåværende tilkobling

Arkitekturen er nå godkjent av brukeren. Følg [GO-LIVE.md](GO-LIVE.md) for den konkrete, oppdaterte Blueprint-flyten fra `feature/ai-study-agent`, privat nøkkelinnlegging og prisanslag. Eieren har nå publisert backend på `https://bi-study-agent-api.onrender.com` og bekreftet health. Se [CONNECT-RENDER.md](CONNECT-RENDER.md) for tilkobling; frontend er ikke merget/deployet. Den generelle oppsummeringen nedenfor er et alternativ for manuelt opprettet Web Service.

Bruk GitHub Pages til frontend og én separat **Node.js Web Service på Render** til backend. Ingen database trengs i v1. Render kan medføre kostnader og API-bruk hos OpenAI koster penger; ingen tjenester er opprettet som del av implementasjonen.

Etter at du har godkjent oppsettet, kan følgende gjøres:

1. Gjennomgå endringene på `feature/ai-study-agent`, test og godkjenn før eventuell merge/push til `main`.
2. Opprett en Node.js Web Service med dette repositoryet som kilde. Bruk Node 24 (`.node-version`), repositoryroten som arbeidsmappe, `node --version` som build-kommando (ingen bygging kreves), og `node backend/server.mjs` som startkommando.
3. Sett de hemmelige verdiene `OPENAI_API_KEY` og `STUDY_ACCESS_TOKEN` i tjenestens private miljøinnstillinger. Ikke bruk GitHub Pages-konfigurasjon til disse.
4. Sett `ALLOWED_ORIGINS=https://evenlorv.github.io`, `HOST=0.0.0.0`, ønsket modell og dagsgrense. Behold plattformens `PORT`.
5. Bruk plattformens HTTPS-adresse og `/health` som health-check. Hold tjenesten til én instans; HTTP-nodeporten må være bak plattformens HTTPS-proxy. `/health` returnerer bare status, ingen studiedata.
6. Åpne GitHub Pages-siden, oppgi backendens HTTPS-adresse og privat tilgangstoken i panelet. Ingen frontend-fil trenger å inneholde token eller API-nøkkel.
7. Test at en melding uten token gir HTTP 401, og at en godkjent melding gir svar og bare forslag. Bekreft at avvisning og lagring fungerer på den faktiske HTTPS-adressen før vanlig bruk.

Backend trenger utgående HTTPS til `api.openai.com`. I et nettverksbegrenset miljø må dette tillates. De virkelige DNS-, TLS- og plattforminnstillingene kan først verifiseres etter godkjent oppsett. Driftsadressen er `https://bi-study-agent-api.onrender.com`. Direkte kontroll herfra blir blokkert av nettverkets egressproxy, så løpende CORS- og OpenAI-verifisering må gjøres i brukerens nettleser.

## Tester og verifiseringsstatus

Kjør backend-/sikkerhetstestene uten API-nøkkel eller installasjon:

```sh
node --test tests/agent.test.mjs
```

For nettlesertestene trengs Playwright og Chromium i utviklingsmiljøet (de er tilgjengelige i dette Codex-miljøet, men kreves ikke for bruk eller backend). Start en statisk server fra `/workspace` på for eksempel port 8002, slik at prosjektet nås under en undermappe:

```sh
python3 -m http.server 8002 --bind 127.0.0.1 --directory /workspace
```

Kjør fra prosjektmappen:

```sh
BASE_URL=http://127.0.0.1:8002/BI-Study-Agent/ node tests/smoke.cjs
BASE_URL=http://127.0.0.1:8002/BI-Study-Agent/ node tests/ai-browser.cjs
```

AI-nettlesertesten starter en ekte, autentisert backend på en ledig lokal port, men **simulerer OpenAI-svar**. Den tester at gamle data beholdes, at forslag ikke lagres før godkjenning, avvisning, tidsbudsjett, XSS-tekst, konflikt ved endrede data, lagringsfeil, notatfiltrering, token i minnet og mobilbredde. Backend-testene tester også verktøyløkken, prioritering, CORS, autentisering, inputgrenser og feilhåndtering. Den opprinnelige nettlesertesten dekker fortsatt vanlige oppgaver og øktregistrering.

Ingen ekte OpenAI-forespørsel er kjørt: dette miljøet har ingen `OPENAI_API_KEY` eller privat brukertilgang konfigurert. Godkjent API-/hostingoppsett og én virkelig ende-til-ende-test gjenstår før vi kan si at AI virker i drift. Det er ikke nødvendig å dele noen hemmeligheter i chat for å gjennomgå koden.

## Grunnstruktur for pensum

`backend/documents.mjs` gir tom dokumentliste, eksplisitt «ingen filer lest» og deaktiverte opplastings-/søkefunksjoner. AI-panelet viser dette og har en deaktivert filvelger. Modellen har ingen verktøy for å hente eller lese filer og instrueres til å skille generell fagkunnskap fra dokumentbaserte svar. Modellers sannferdighet kan ikke garanteres; ingen dokumentkilder eller sitater produseres av systemet i v1.

Før vi aktiverer filer må vi implementere privat lagring med brukeridentitet, størrelses-/filtypekontroll, sikker tekstuttrekking, behandling av dokumenttekst som ubetrodd innhold og kildehenvisninger med dokument og sidetall. Ingen tomme eller oppdiktede dokumenter skal sendes som pensumgrunnlag.
