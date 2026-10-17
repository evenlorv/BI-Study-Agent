# Koble AI-panelet til Render

## Status

Eieren har publisert backend på `https://bi-study-agent-api.onrender.com` og bekreftet at `/health` returnerer `{"status":"ok"}`. AI-frontenden ligger på `feature/ai-study-agent`; den er ikke merget til `main` eller publisert på GitHub Pages som del av denne klargjøringen.

Skymiljøet forsøkte å kontrollere health, CORS-preflight, manglende token og feil origin på driftsadressen. Egressproxyen svarte «Tunnel connection failed: 403 Forbidden» før forespørslene nådde Render. Dette er ikke en påvist feil i Render-tjenesten. Lokal backend-/nettlesertesting består, men faktisk CORS, token og OpenAI-tilgang i drift kan ikke bekreftes av Codex uten nettverkstilgang og privat brukertilgang. Ingen hemmeligheter trengs i chat.

## Finn STUDY_ACCESS_TOKEN privat i Render

1. Logg inn på [Render Dashboard](https://dashboard.render.com/).
2. Klikk på **Web Service** med navn **bi-study-agent-api**. Velg selve tjenesten, ikke bare Blueprint-oversikten.
3. Åpne **Environment** i tjenestens meny.
4. Finn miljøvariabelen **STUDY_ACCESS_TOKEN**. Render-filen satte `generateValue: true`, så verdien skal ha blitt generert ved opprettelse.
5. Bruk visnings-/kopieringskontrollen for den skjulte verdien. Avhengig av Render-visningen må du åpne **Edit** for å se den. Ikke lagre noen endring hvis du bare vil kopiere verdien. Oppbevar den privat, gjerne i et passordhvelv.
6. Kopier bare verdien, uten variabelnavn eller anførselstegn. Ikke ta skjermbilde av feltet, del verdien her, eller legg den i GitHub.

**OPENAI_API_KEY er en annen nøkkel og skal bli i Render.** Den skal aldri kopieres til chatpanelet. Panelet avviser gjenkjennelige OpenAI-nøkler som ekstra beskyttelse.

Hvis STUDY_ACCESS_TOKEN mangler eller du ikke kan hente verdien: ikke bruk OpenAI-nøkkelen i stedet. Lag et nytt tilfeldig passord på minst 32 tegn i et privat passordhvelv, sett det som STUDY_ACCESS_TOKEN i Render og bruk samme verdi i panelet. En slik rotasjon krever at backend lastes med den nye miljøverdien via Render sin lagre-/redeploy-flyt; ikke gjør det ved ren kopiering av en eksisterende verdi. Ikke endre den genererte verdien i `render.yaml`.

## Kontroller CORS-innstillingen

I den samme Environment-visningen skal **ALLOWED_ORIGINS** være nøyaktig:

```text
https://evenlorv.github.io
```

Ingen avsluttende skråstrek og ingen `/BI-Study-Agent/`. Verdien finnes allerede i `render.yaml`, men den kjørende tjenestens innstilling må stemme. Hvis du faktisk endrer den, må Render ta i bruk endringen gjennom sin lagre-/redeploy-flyt. Denne veiledningen gjør ingen slik endring for deg.

CORS tillater denne origin i kode og lokaltester. Andre nettsteder på samme GitHub-origin deler likevel origin; det private tokenet er autentiseringen. Backend nekter AI-kall uten gyldig token.

## Konfigurer panelet etter godkjent frontendpublisering

Du vil ikke se det nye AI-panelet på den gamle Pages-versjonen ennå. Først etter en separat godkjent merge til `main` og ferdig GitHub Pages-utrulling:

1. Åpne `https://evenlorv.github.io/BI-Study-Agent/` i samme nettleser som du bruker til studiedataene dine. Ikke slett nettsteddata eller tilbakestill appen.
2. Gå til **AI-assistent → Tilkobling til privat backend**.
3. Backend-adressen er forhåndsutfylt som `https://bi-study-agent-api.onrender.com`. Adressen er offentlig konfigurasjon og ingen hemmelighet. Du kan endre den ved behov.
4. Lim **STUDY_ACCESS_TOKEN** fra Render inn i **Privat tilgangstoken**.
5. Trykk **Koble til**. Vent ved eventuell Render Free-oppvåkning (opptil to minutter før panelets tidsavbrudd).
6. Panelet sjekker først `/health`, og deretter et tomt, autentisert POST-kall til `/api/chat`. Backend skal avvise den tomme kroppen med forventet valideringssvar etter at tokenet er godkjent. Dette sender ingen studiedata, endrer ingen data og kaller ikke OpenAI. Probe-kallet teller mot minuttgrensen for forespørselsforsøk, men ikke dagskvoten for AI-chat.
7. Ved suksess vises **«Tilkoblet. Backend og tilgangstoken er kontrollert.»** Da aktiveres Send-knappen. OpenAI er fortsatt ikke testet.
8. Send for eksempel «Lag en dagsplan for valgt dato». Dette deler feltene panelet opplyser om, og kan medføre vanlig OpenAI-kostnad. Se forhåndsvisningen. Test gjerne først **Avvis forslagene**, deretter et nytt forslag med **Godkjenn og lagre forslagene**.

Appen beholder `bi-study-agent-v1` og utfører ingen automatisk migrering/tilbakestilling. Godkjente forslag legges til de eksisterende dataene. Token og chat er bare i minnet og fjernes ved omlasting eller **Koble fra og tøm chat**. Backend-adressen er forhåndsutfylt igjen ved omlasting, men tokenet må legges inn på nytt.

## Feilmeldinger

- **Gyldig tilgangstoken kreves:** Hent riktig STUDY_ACCESS_TOKEN fra tjenesten. Ikke bruk OpenAI-nøkkelen. Ikke del verdien for feilsøking.
- **Nettverksfeil:** Kontroller HTTPS-adresse, internett, oppvåkning og ALLOWED_ORIGINS. En CORS-feil kan vises som nettverksfeil i nettleseren. Å åpne `/health` direkte bekrefter alene ikke CORS, fordi direkte navigasjon ikke er samme type nettleserforespørsel.
- **HTTP 403 / nettsiden ikke tillatt:** Kontroller eksakt frontend-origin og den aktive ALLOWED_ORIGINS-verdien.
- **429:** Vent. Minuttgrense, én samtidig chat eller dagskvote kan være nådd.
- **Ikke JSON / uventet valideringssvar:** Kontroller at URL-en er til riktig backend og at tjenesten kjører den gjennomgåtte backend-versjonen. Ikke bytt til en fremmed backend og oppgi ditt token der.
- **502 etter en chatmelding:** Health/autentisering kan fungere selv om OpenAI-nøkkel, fakturering eller modelltilgang feiler. Kontroller disse privat i Render/OpenAI. Ingen studiedata lagres på grunn av feilen.

Gi bare feilmelding og eventuelt HTTP-status ved feilsøking. Ikke kopier Authorization-header, nettverkslogger/HAR, tokens eller miljøvariabelverdier til chat.
