# Sikkerhetsgjennomgang før første deploy

Dato: 17. oktober 2026. Omfang: arbeidskopien på `feature/ai-study-agent`, alle lokalt tilgjengelige Git-blobber inkludert ikke-refererte objekter, historiske filstier og GitHub-refs etter read-only fetch. Dette er en konkret kode-/testgjennomgang, ikke en full ekstern penetrasjonstest eller garanti om at ingen feil finnes.

## Hemmeligheter og private data

`python3 scripts/audit-repository.py` søker uten å skrive treffverdier til logger etter kjente API-nøkkelformater, JWT, private nøkler, credential-URL-er, bokstavelige hemmeligheter og mulige private filer i kode og lokale Git-objekter. Ingen slike funn ble gjort. Gjennomgang av datainnholdet fant bare merkede eksempeldata og syntetiske testdata; ingen brukeropplastede pensumfiler, virkelige øktlogger, sikkerhetskopier eller databasefiler finnes i prosjektet. Ved første gjennomgang inneholdt Git-historikken de to opprinnelige commitene. AI-oppgraderingen leveres separat på `feature/ai-study-agent`; publisering til `main` og deploy inngår ikke i denne gjennomgangen.

Variabelnavn som OPENAI_API_KEY i kode og tomme eksempelverdier er konfigurasjon, ikke hemmelige verdier. Testene bruker bevisst kunstige token, ikke operative credentials. GitHub-navnet og karaktermålene er allerede eksplisitt valgt prosjektinformasjon, ikke skjulte nøkler.

`.gitignore` utelater ekte miljøfiler, nøkler og vanlige backup-/opplastingsmapper. Det er kun ekstra vern: `.gitignore` hindrer ikke tvungen innsjekking eller lekkasje fra filer som allerede er sporet. Hemmeligheter og private dokumenter skal fortsatt oppbevares utenfor den offentlige checkouten og statiske serverroten. Skanningen kan ikke oppdage alle mulige, ukjente hemmelighetsformater eller bevise at noe aldri har vært eksponert utenfor denne historikken.

## Autentisering og tilgangskontroll

- Backend krever privat bearer-token for alle AI-kall og nekter å starte uten tilstrekkelig langt token og OpenAI-nøkkel. Sammenligning av like lange token bruker konstanttidsfunksjon.
- Testene verifiserer 401 ved manglende/feil token, og at en gammel token ikke godtas av en server konfigurert med ny token. Origin alene gir aldri autentisering.
- CORS krever eksakt origin; falske suffiks-domener og feil origins får 403. Gyldig preflight testes. Forespørsler uten Origin, som serverklienter, må fortsatt ha korrekt token.
- `/health` returnerer bare status. Det finnes ingen statisk filserver, filopplastingsrute, privat datanedlasting eller direkte endringsrute på backend. Forsøk på `.env`, `/api/apply` og tilsvarende testes som 404.
- I drift forutsettes Render sin HTTPS-proxy. HTTP på localhost er kun for lokal testing.

Dette er en enkeltbrukerløsning med passordlignende token, ikke flerbrukerinnlogging. Alle som får tilgangstokenet, har samme AI-tilgang som eieren. Tokenet må holdes privat og roteres ved lekkasje. Frontend inneholder aldri OpenAI-nøkkelen; tilgangstokenet brukeren skriver inn, finnes bare i appens minne frem til frakobling/omlasting.

## Misbruksvern

Testene verifiserer 128 KiB payloadgrense, inputvalidering, avvisning av systemroller i innsendt chat, én samtidig AI-forespørsel, 30 forsøk/minutt per tilkoblings-IP og konfigurerbar dagskvote. Maks fire modellrunder, 1 800 outputtokens per runde og 30 sekunders leverandørtidsavbrudd begrenser én forespørsel. HTTP-lesing og headers har også tidsgrenser. Ukjente verktøy og ugyldige argumenter kan ikke bli lagrede handlinger.

Render-konfigurasjonen starter med én instans og 30 chatforespørsler/dag. Bak en proxy kan IP-grensen gjelde flere klienter samlet. Kvote og minuttelling ligger i prosessminne og nullstilles ved omstart; de er ikke varige pengetak eller et fullverdig DDoS-vern. Gratisplanens søvn svekker varigheten av dagskvoten. OpenAI-kostnadsvarsler, begrenset startbruk og overvåking av Usage er fortsatt nødvendig. Se kostnadsavsnittet i GO-LIVE.md.

## Godkjenning av AI-endringer

Backend lager bare strukturerte forslag og har ingen kanal for å skrive til localStorage. Vanlige chatmeldinger kan ikke utløse endringer. Frontend tillater bare oppgaver, dagsplaner og progresjonsforslag, med validerte fag, datofelt, prosent og tidsbudsjett. Innhold fra modellen vises som tekst, uten HTML-kjøring.

Nettlesertesten bekrefter at:

- Bare det å sende melding eller motta verktøyforslag endrer ingen studiedata.
- Avvisning endrer ingen data; eksplisitt godkjenning lagrer den viste gruppen.
- Eksisterende oppgaver, økter og læringsnotater bevares.
- Endrede data/dato eller lagring fra en annen fane avviser utdaterte forslag.
- Feilet localStorage-skriving bevarer både gammel lagret og aktiv tilstand.
- HTML-lignende modelltekst kjøres ikke som kode, og tilgangstoken lagres ikke i localStorage.

Dette vernet gjelder agentens handlinger i den leverte appen. Eieren kan fortsatt endre egne data via de eksisterende manuelle feltene. Som for alle nettapper kan ondsinnet kode med full tilgang til samme origin eller en kompromittert nettleser omgå klientlogikk; ikke legg tredjepartsskript inn i nettsiden. En Content Security Policy begrenser skript og stiler til egne filer, blokkerer objekter og base-URL-endringer. HTTPS-backendadresser er tillatt for konfigurerbar tilkobling.

## Personvern og manglende driftsverifisering

Nettleseren sender bare feltene som er forklart i AI-panelet; øktnotater og lagrede planer utelates. Backend bruker minne, ingen database/disklagring av studiedata, og logger ikke innhold/nøkler. OpenAI får `store: false`, som ikke er en garanti for null leverandørlogging. Framtidig hostingproxy-/feillogging må også kontrolleres.

Ekte OpenAI-kall er ikke testet fordi nøkkel ikke er konfigurert. CORS, autentisering og forslag er testet med en ekte lokal HTTP-backend og simulert OpenAI. Render-konfigurasjonen er forberedt, ikke aktivert eller validert hos Render. Etter opprettelse må HTTPS, virkelig modelltilgang, faktisk Origin, feil token, avvisning og godkjenning verifiseres i drift før vanlig bruk.
