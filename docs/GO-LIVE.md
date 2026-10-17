# Fra klargjort kode til din egen AI-studieagent

Arkitekturen er godkjent: GitHub Pages + én Render-backend + OpenAI API. Denne veiledningen beskriver handlinger du kan utføre senere. AI-oppgraderingen ligger på `feature/ai-study-agent`; den er ikke merget til `main`. Ingen tjenester er deployet eller opprettet av Codex. Å bruke Render sin opprettelses-/Apply-knapp starter faktisk opprettelse og deploy; `autoDeployTrigger: "off"` hindrer senere automatisk utrulling, ikke den første.

Backend er nå satt opp av eieren. For daglig tilkobling og tokenplassering, følg [CONNECT-RENDER.md](CONNECT-RENDER.md). Trinnene for nyopprettelse nedenfor er beholdt som referanse.

## Før du begynner

- Ta en sikkerhetskopi med knappen i den eksisterende appen. Oppgraderingen beholder localStorage-nøkkelen og overskriver ikke eksisterende data ved oppstart.
- Du trenger GitHub-konto med tilgang til `evenlorv/BI-Study-Agent`, Render-konto og OpenAI API-konto. ChatGPT-abonnement inkluderer ikke API-bruk.
- Førsteversjonen er for deg alene. Det private tilgangstokenet fungerer som et passord til din backend. Ikke del det med andre.
- Ikke lim noen nøkler inn i Codex-chatten, GitHub-filer eller nettleserens adressefelt.

## 1. Få den gjennomgåtte koden opp på GitHub

Render må hente den committede branchen `feature/ai-study-agent` fra GitHub. Kontroller at branchen og `render.yaml` vises på GitHub før du oppretter tjenesten. Render kan ikke hente filer som bare finnes i Codex.

Dersom branchen ennå ikke er pushet, be Codex om å «committe og pushe feature/ai-study-agent til GitHub, uten å merge til main». Se gjennom endringene i en pull request. Ikke merge til `main` før du er klar for at GitHub Pages skal oppdateres. Denne veiledningen og Render-filen inneholder ingen ekte hemmeligheter.

Render-filen velger eksplisitt `feature/ai-study-agent`. Denne branchen må eksistere på GitHub før du oppretter tjenesten. Du trenger ikke laste ned filer eller installere en terminal på PC-en.

## 2. Opprett en separat OpenAI-prosjektnøkkel

1. Åpne [OpenAI Platform](https://platform.openai.com/) og logg inn.
2. Opprett/velg et eget prosjekt, for eksempel **BI Study Agent**. Hold det adskilt fra andre apper.
3. Se **Billing** og **Limits**. API-et trenger normalt betalingsoppsett/kreditt. Velg en liten startsum dersom forhåndsbetalte kreditter tilbys, og la automatisk påfyll være av i starten. Følg kontoens viste minimum og vilkår.
4. Sett lave bruksgrenser der kontoen støtter det, og sett kostnadsvarsler. Et prosjektbudsjett kan være en varslingsgrense, ikke en hard sperre. Kreditt-/faktureringsregistrering kan også være forsinket. Følg derfor **Usage** etter første tester.
5. Åpne prosjektets **API keys**, velg **Create new secret key**, og gi nøkkelen et gjenkjennelig navn. Velg begrensede rettigheter til Responses API hvis dette kan velges i kontoen. Appen trenger ikke fil-, finjusterings- eller administrasjonstilgang.
6. Kopier nøkkelen direkte til et privat passordhvelv inntil du legger den i Render. Den vises vanligvis bare én gang. Ikke send den til meg.

En egen nøkkel gjør at du kan tilbakekalle appens tilgang uten å påvirke andre prosjekter. Ved lekkasje: tilbakekall nøkkelen i OpenAI, opprett en ny og oppdater Render. Sletting fra en Git-fil alene gjør ikke en lekket nøkkel trygg igjen.

## 3. Opprett Render-backend fra konfigurasjonsfilen

Dette er en senere manuell handling som oppretter tjenesten. Sjekk plan og pris i Render før du bekrefter.

1. Logg inn på [Render Dashboard](https://dashboard.render.com/).
2. Velg **New → Blueprint**, koble til GitHub ved behov, og gi bare nødvendig repositorytilgang.
3. Velg `evenlorv/BI-Study-Agent`, branch **feature/ai-study-agent** og filen **render.yaml**. Hvis UI-et først viser `main`, bytt branch; AI-filene ligger ikke på `main` ennå.
4. Gjennomgå tjenesten: én Node.js Web Service, **Free**, Frankfurt, startkommando `node backend/server.mjs`, health check `/health` og automatisk deploy av. Ikke velg betalingsplan, database, persistent disk eller ekstra instanser for første utprøving.
5. Når Render ber om `OPENAI_API_KEY` (markert `sync: false` i filen), lim inn din private prosjektnøkkel i **Render sitt miljøvariabelfelt**. Den skal ikke inn i `render.yaml`.
6. `STUDY_ACCESS_TOKEN` er satt til `generateValue: true`. Render genererer dette privat på serversiden. Det er et separat passord for appen, ikke OpenAI-nøkkelen.
7. Kontroller de øvrige innstillingene mot tabellen under. La Render tildele `PORT` automatisk.
8. Først når du vil starte tjenesten: bekreft **Apply/Create** og følg deployloggen. Hvis Render ikke godtar en Blueprint-innstilling, stopp og få feilen undersøkt før du bytter plan eller legger inn verdier i kode. Denne filen er klargjort, men er ikke validert av en levende Render-tjeneste her.
9. Åpne tjenestens **Environment** etter opprettelsen. Kopier verdien av `STUDY_ACCESS_TOKEN` til et privat passordhvelv ved å vise den der. Bruk den senere i appens passordfelt. Ikke kopier OpenAI-nøkkelen til appen.
10. Når tjenesten viser at deploy lyktes, noter Render sin HTTPS-adresse, for eksempel `https://<tjenestenavn>.onrender.com` (eksempel, ikke en eksisterende tjeneste).

| Miljøvariabel | Verdi / håndtering |
| --- | --- |
| `OPENAI_API_KEY` | Din prosjektnøkkel, fylles inn privat i Render |
| `STUDY_ACCESS_TOKEN` | Genereres privat av Render; brukes til innlogging i chatpanelet |
| `NODE_VERSION` | `24` |
| `HOST` | `0.0.0.0` |
| `PORT` | Styres av Render, ikke legg inn manuelt |
| `ALLOWED_ORIGINS` | `https://evenlorv.github.io` – ingen sti eller avsluttende `/` |
| `OPENAI_MODEL` | `gpt-4.1-mini`, forutsatt at den er tilgjengelig i OpenAI-prosjektet |
| `MAX_REQUESTS_PER_DAY` | `30` som forsiktig startverdi |

`ALLOWED_ORIGINS` inneholder bare vertsnavnets origin. Andre repositoryer under samme `evenlorv.github.io` deler denne origin; tokenet er fortsatt nødvendig. En CORS-tillatelse er ikke et passord.

Appens Node.js-server tilbyr kun API-ruter, ikke statisk filserver. `/health` er offentlig og inneholder bare status. Alle AI-kall krever token. Det finnes ingen åpne ruter for å endre studiedata eller hente private filer.

## 4. Kontroller backend og publiser frontend når du er klar

1. Åpne Render-adressen med `/health` til slutt i nettleseren. Du skal få `{"status":"ok"}`. Det viser at serveren kjører, men tester ikke OpenAI-kontoen. Ved gratisplan: vent på eventuell oppvåkning først.
2. Når du er klar for frontendpublisering, merge den gjennomgåtte pull requesten til `main` på GitHub. GitHub Pages oppdateres da gjennom det eksisterende Pages-oppsettet. Ikke slett `feature/ai-study-agent` så lenge Render følger den branchen. Vi kan senere endre Render til `main` med en bevisst oppdatering av konfigurasjonen.
3. Vent til Pages-utrullingen er ferdig og åpne den eksisterende Pages-adressen: `https://evenlorv.github.io/BI-Study-Agent/`. Gå til **AI-assistent → Tilkobling til privat backend**.
4. Legg inn backendens HTTPS-adresse uten sti, og ditt **STUDY_ACCESS_TOKEN**. Trykk **Koble til**. Feltet er ikke for OpenAI-nøkkelen. Knappen kontrollerer health og autentisering uten studiedata eller OpenAI-kall. Første chatmelding tester OpenAI.
5. Velg en dato med ledig studietid, og skriv «Lag en dagsplan for valgt dato». Kontroller at du får forslag og at ingenting lagres ennå.
6. Trykk **Avvis forslagene** og kontroller at planen er uendret. Send på nytt, trykk **Godkjenn og lagre forslagene**, og kontroller at dagsplanen vises. Last siden på nytt og bekreft at planen er beholdt.
7. Prøv et feil tilgangstoken: du skal få avslag. Koble deretter til med korrekt token igjen. Gå til OpenAI **Usage** og kontroller faktisk bruk/kostnad fra testen.

Tilkoblingen må legges inn igjen etter omlasting fordi tokenet og chatten bare ligger i minnet. Studiedataene beholdes i localStorage. Ingen automatisk synkronisering mellom PC og mobil finnes. Det er fortsatt lurt å laste ned sikkerhetskopier.

Etter senere kodeendringer: siden auto-deploy er av, krever backend en bevisst **Manual Deploy** i Render. Ved nøkkelrotasjon må den nye verdien lagres i Render og tjenesten startes/deployes på nytt. Endre begge sider ved rotasjon av tilgangstokenet: Render-miljøet og tokenet du oppgir i appen.

## Kostnadsanslag og gratisbegrensninger

**Dette er planleggingstall, ikke et pristilbud.** Per gjennomgangen 17. oktober 2026 blokkerte skymiljøets nettverk tilgang til leverandørenes prissider. Dagens satser, skatt, kredittkrav og gratisvilkår er derfor ikke bekreftet. Kontroller [Render-priser](https://render.com/pricing), [Render Free](https://render.com/docs/free), [OpenAI API-priser](https://openai.com/api/pricing/) og [modellen](https://developers.openai.com/api/docs/models/gpt-4.1-mini) før opprettelse.

Anslaget tar utgangspunkt i tidligere publiserte nivåer: GPT-4.1 mini omtrent **$0,40 per million inputtokens** og **$1,60 per million outputtokens**, samt Render Starter omtrent **$7/måned** for én liten instans, før eventuelle tillegg. Vi har ikke lagt inn faste priser i appen.

Ved 10–30 korte/moderate chatspørsmål daglig, der et spørsmål samlet bruker 6 000–20 000 inputtokens og 1 000–3 000 outputtokens over alle modellkallene, gir regnestykket omtrent $1,20–11,52 per måned. Et praktisk startbudsjett er **$2–15/måned til OpenAI**, med aktiv kontroll av Usage. Historikk, store studiedatasett og flere verktøyrunder kan gi vesentlig høyere bruk. Fire timer studier betyr ikke fire timer kontinuerlig fakturering; kostnaden følger API-bruken.

| Oppsett | Omtrentlig månedsbudsjett |
| --- | --- |
| GitHub Pages + Render Free + moderat AI-bruk | $2–15, hovedsakelig OpenAI |
| GitHub Pages + én liten betalt Render-instans + samme AI-bruk | $9–22 før skatt/tillegg |

Som rent regneeksempel, ved 11 NOK per USD, tilsvarer dette omtrent 22–165 kr eller 99–242 kr. Valutakursen er ikke kontrollert. GitHub Pages antas her å være tilgjengelig uten ekstra kostnad for det offentlige repositoryet innenfor tjenestens bruksgrenser.

Render Free har typisk følgende begrensninger som må kontrolleres mot gjeldende vilkår:

- Serveren sovner etter omtrent 15 minutter uten aktivitet. Første forespørsel kan ta rundt ett minutt eller mer. Åpne `/health` først ved behov; lang oppvåkning kan ellers gi tidsavbrudd i chatten.
- Gratistimer har historisk vært rundt 750 per workspace per måned, delt mellom gratis webtjenester. Brukes kvoten opp, kan tjenesten bli utilgjengelig til neste periode. Båndbredde og build-ressurser har egne grenser.
- Filsystem og prosessminne er ikke varig lagring. Dagens API-kvoter nullstilles ved omstart, og gratisplanens søvn gjør derfor dagsgrensen mindre pålitelig som kostnadsvern.
- Ytelse, oppstartstid og tilgjengelighet er svakere enn med en liten betalt instans. Ingen database/disk er nødvendig i denne versjonen; studiedataene ligger i nettleseren.

Vi starter med 30 chatforespørsler per dag per kjørende prosess, men dette er **ikke et hardt pengebudsjett**. Ett spørsmål kan bruke opptil fire modellkall, og både kvote og begrensning på samtidighet gjelder én instans. Ikke aktiver ekstra instanser eller autoskalering uten varig, delt kvotekontroll. Ikke bruk en oppetidsrobot for å omgå gratisplanens søvn; velg heller en egnet plan når stabil tilgang blir viktig.

## Feilsøking uten å dele hemmeligheter

- **Serveren nekter å starte:** Se om loggen sier at en miljøvariabel mangler. Legg den inn i Render, aldri i Git. Del bare feilmeldingen, ikke verdier eller skjermbilde av miljøfeltene.
- **401:** Tilgangstokenet er feil. Hent `STUDY_ACCESS_TOKEN` fra Render; ikke bruk OpenAI-nøkkelen.
- **403/CORS eller «Failed to fetch»:** Kontroller at frontend kjører på den tillatte origin, backend bruker HTTPS og er våken. `ALLOWED_ORIGINS` må være `https://evenlorv.github.io`, ikke hele Pages-stien.
- **429:** Vent ved minutt-/samtidighetsgrense. Ved dagsgrense er riktig tiltak å redusere bruk/vente; ikke restart serveren for å omgå kostnadsvernet.
- **502:** Ingen studiedata endres. Kontroller privat at OpenAI-nøkkelen er aktiv, faktureringen fungerer og modellen er tilgjengelig. Backend viser med hensikt ikke sensitive leverandørdetaljer til nettleseren. Ved lang gratisoppvåkning, vent på `/health` og prøv igjen.
- **Ingen chat på Pages:** Frontend-endringene er ikke publisert ennå, eller nettleseren bruker gammel side. Kontroller Pages-deploy og last siden på nytt uten å slette nettsteddata.

Reell ende-til-ende-test med din nøkkel, Render-HTTPS og GitHub Pages gjenstår etter de manuelle oppsettsstegene. Ingen test i dette skymiljøet har belastet OpenAI-kontoen din.
