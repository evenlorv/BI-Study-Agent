# Feilsøk OpenAI i Render uten å dele hemmeligheter

## Hva gjennomgangen fant

Den tidligere backend-koden forkastet alle feilkropper fra OpenAI og ga kun «Provider request failed». Den generelle meldingen i nettleseren viste derfor ikke om feilen skyldtes nøkkel, rettigheter, modell, kvote eller forespørselsformat. Feilen beviser ikke i seg selv at kreditter mangler.

Vi kan ikke fastslå den konkrete årsaken i din kjørende tjeneste uten nye Render-logger. Ingen API-nøkkel er hentet eller brukt her, og OpenAI er simulert i testene. Loggrettelsen viser metadata som trengs for neste diagnose. Den logger aldri leverandørens feilmelding, feilkropp, request-body, headers, API-nøkler, tilgangstoken, chat eller studiedata.

## Oppdater backend manuelt

1. Åpne Render Dashboard → **bi-study-agent-api → Settings**. Kontroller at tjenesten følger **feature/ai-study-agent**. Ingen merge til main trengs for denne backend-oppdateringen.
2. Under **Environment**, kontroller privat at `OPENAI_MODEL` er `gpt-4.1-mini`, uten anførselstegn. Den er en offentlig modell-ID som støtter Responses og function calling; faktisk tilgjengelighet avhenger av prosjektet. Koden trimmer nå innledende/avsluttende mellomrom. Ikke bruk nøkkel eller visningsnavn i dette feltet.
3. Kontroller privat at `OPENAI_API_KEY` er den aktive prosjektnøkkelen. Ikke endre eller eksponer `STUDY_ACCESS_TOKEN` for å løse en OpenAI-feil; den beskytter en annen forbindelse.
4. Åpne OpenAI Platform → velg prosjektet nøkkelen tilhører → **API keys** → nøkkelens rettigheter. Restricted key må ha **Write** / opprettelsestillatelse til **Responses (`POST /v1/responses`)**. UI-et kan samle dette under **Requests**: Read alene er ikke nok til å opprette svar. Chat Completions-tilgang alene gir ikke nødvendigvis Responses-tilgang. Prosjektets og brukerens/servicekontoens rolle må også tillate modellbruk. Ingen admin-, fil- eller finjusteringstillatelser er nødvendig. Hvis kontoen bare viser samlede All/Restricted/Read Only-valg, velg den minst omfattende innstillingen som gir Responses Write. Ikke publiser et bilde av nøkkelen eller verdiene.
5. Se prosjektets modellgrenser/-tilgang og at valgt modell er tillatt. Credits, aktiv prosjekttilgang og rate limits er separate kontroller. En fungerende health- eller STUDY_ACCESS_TOKEN-test sjekker ikke OpenAI-rettigheter.
6. Når du er klar til å oppdatere: velg **Manual Deploy → Deploy latest commit** på tjenesten. Dette er en faktisk backend-deploy som du utfører manuelt; Codex har bare pushet koden. Kontroller at loggen viser riktig feature-commit og vellykket oppstart.
7. Åpne appen, koble til med ditt eksisterende STUDY_ACCESS_TOKEN og send én kort melding. Åpne samtidig **Logs** i Render. Vanlig AI-bruk kan belastes; ikke send mange identiske forespørsler mens du feilsøker.

Hvis tjenesten følger en annen branch enn feature-branchen, vil «Deploy latest commit» hente den andre branchen. Velg riktig branch bevisst før deploy. Ikke merge frontend til main bare for å oppdatere backend.

## Les den nye loggen

En feil gir én strukturert logglinje, for eksempel (syntetisk eksempel):

```json
{"event":"openai_failure","http_status":403,"error_code":"insufficient_permissions","request_id":null}
```

`request_id` fylles fra `x-request-id` når leverandøren sender en gjenkjennelig ID. For personvern logges bare eksplisitt tillatte feilkoder og IDs med forventet format; ukjente strenger erstattes av en generell kode eller null. Hele feilmeldinger og stack traces logges ikke. Status null betyr at det ikke finnes en HTTP-respons, eller at feilen oppstod utenfor selve leverandørkallet. Status 200 kan forekomme ved feil i svarformat eller et ufullstendig svar.

| HTTP / kode | Hva du kontrollerer |
| --- | --- |
| 400 / `invalid_json_schema`, `unsupported_parameter`, `invalid_request_error` | API-format eller modellkompatibilitet. Del bare denne metadata-linjen for videre kodeanalyse; ikke hele forespørselen. |
| 401 / `invalid_api_key` | Nøkkelen kan være feil, tilbakekalt eller ikke aktivert i den kjørende tjenesten. Kontroller privat i Render/OpenAI. |
| 403 / `insufficient_permissions`, `permission_denied` | Responses Write/Requests Write, prosjektrolle og modelltilgang. Å ha kreditter er ikke tilstrekkelig. |
| 404 / `model_not_found` | Feil modell-ID eller modellen er utilgjengelig for nøkkelens prosjekt. |
| 429 / `insufficient_quota` | Kreditter/fakturering/kvote for riktig prosjekt og organisasjon, også om kontoen viser kreditter et annet sted. |
| 429 / `rate_limit_exceeded` | Prosjektets forespørsels-/tokengrenser. Vent og reduser hyppighet/datamengde. |
| 5xx / `server_error` | Midlertidig feil hos leverandøren. Prøv igjen senere. |
| null / `network_error` eller `timeout` | Utgående HTTPS til api.openai.com, nettverksfeil eller 30-sekunders tidsgrense. |
| 200 / `incomplete_response` | Leverandøren returnerte ikke et fullstendig svar; outputgrensen kan være nådd. |
| 200 / `invalid_json_response`, `invalid_response`, `empty_response`, `refusal` | Tjenesten returnerte uventet/ufullstendig innhold eller avslag. Studiedata endres ikke. |

Nettleseren får fortsatt en generell 502-feil og ingen av disse interne metadataene. Ingen automatiske retries er lagt til, slik at diagnostisering ikke gir skjulte ekstra API-kall. Godkjenning av studiedata er uendret.

## API-formatet som er kontrollert

- Fast HTTPS-endepunkt: `POST https://api.openai.com/v1/responses`.
- Feltene `model`, `instructions`, `input`, `tools`, `tool_choice`, `parallel_tool_calls`, `max_output_tokens` og `store: false`; ikke Chat Completions-feltet `messages`.
- Function tools ligger flatt med `type: function`, `name`, `description`, `strict` og `parameters`. Ingen ekstra `function: {...}`-innpakning.
- Alle objektskjemaer har `additionalProperties: false`, og alle deklarerte felt er påkrevd, også i de nestede oppgavene.
- Verktøysvar sendes tilbake som `function_call_output` med matchende `call_id` og JSON-streng i `output`.
- Kun response-output-items legges i den videre inputlisten; loggmetadata sendes ikke til modellen.

Gjennomgangen fant ingen bekreftet formatfeil i dette oppsettet. Simulerte HTTP-tester dekker nå 400, 401, 403, 404 og begge vanlige 429-tilfellene, nettverksfeil, timeout, ikke-JSON og ufullstendige svar. De verifiserer også at innhold/nøkler ikke finnes i loggene eller nettleserens feilsvar. En simulert verktøyrunde kontrollerer den faktiske serialiserte HTTP-forespørselen, men erstatter ikke en ekte driftsforespørsel med kontoens modell og tillatelser.

Kjør `node --test tests/*.test.mjs` for hele backend-testsettet. Leverandørens API-referanse: https://platform.openai.com/docs/api-reference/responses/create og feilkoder: https://platform.openai.com/docs/guides/error-codes/api-errors.
