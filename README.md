# Bollettapp

Web app per la gestione di bollette, consumi e statistiche domestiche.
React + TypeScript + Vite + Tailwind CSS + Supabase + Recharts.

## 1. Requisiti

- Node.js 18 o superiore (se non lo hai, scarica l'installer da [nodejs.org](https://nodejs.org))
- Un progetto Supabase gratuito ([supabase.com](https://supabase.com))

## 2. Configurazione Supabase

1. Crea un nuovo progetto su [supabase.com](https://supabase.com).
2. Vai su **SQL Editor** e incolla per intero il contenuto del file `supabase-schema.sql` presente in questo repo. Esegui lo script: crea tabelle, indici, trigger e sicurezza (RLS) automaticamente.
3. Vai su **Project Settings → API**: copia **Project URL** e **anon/public key**.
4. Duplica il file `.env.example` in `.env` nella cartella del progetto e incolla i valori:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

In alternativa, puoi avviare l'app senza `.env` e inserire URL e chiave direttamente da **Impostazioni → Server e sincronizzazione → Configurazione server** una volta aperta l'app (utile per testare rapidamente).

5. (Facoltativo ma consigliato) In **Authentication → Providers → Email**, se vuoi disattivare la conferma email per test rapidi, disattiva "Confirm email"; altrimenti lascia attiva la conferma per la produzione.
6. In **Authentication → URL Configuration**, aggiungi l'URL del sito (es. `https://tuosito.netlify.app`) tra i Redirect URL, così il link "Password dimenticata" funziona correttamente anche in produzione.

## 3. Avvio in locale

Apri il terminale nella cartella del progetto ed esegui:

```bash
npm install
npm run dev
```

L'app sarà disponibile su `http://localhost:5173`.

## 4. Build di produzione

```bash
npm run build
```

I file pronti per il deploy vengono generati nella cartella `dist/`.

## 5. Pubblicare su GitHub e Netlify

1. Apri **GitHub Desktop**, scegli "Add local repository" e seleziona questa cartella.
2. Pubblica il repository su GitHub (può essere privato).
3. Su [Netlify](https://app.netlify.com), collega il repository GitHub appena creato.
4. Imposta:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. In **Site settings → Environment variables**, aggiungi `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` con gli stessi valori del tuo `.env`.
6. Avvia il deploy: l'app sarà online in pochi minuti.

## 6. Struttura del progetto

```
src/
  components/     componenti riutilizzabili (card, form, layout, modal...)
  pages/          pagine dell'app (Login, Dashboard, Bollette, Statistiche...)
  hooks/          stato condiviso: autenticazione, tema, dati, toast
  services/       chiamate a Supabase (auth, bollette, categorie, sync)
  lib/            client Supabase, storage offline
  types/          tipi TypeScript condivisi
supabase-schema.sql   script SQL da eseguire su Supabase
```

## 7. Note importanti

- La chiave `service_role` di Supabase **non deve mai** essere inserita nel frontend: si usa solo la `anon/public key`, protetta dalle policy RLS.
- L'app funziona anche offline: le bollette inserite senza connessione vengono salvate localmente e sincronizzate automaticamente al ritorno della rete.
- Il tema chiaro/scuro/automatico e la modalità layout (desktop/mobile/automatico) sono personalizzabili da Impostazioni.

## 8. Ebitts / Token Box e lettura delle bollette con Gemini

La pagina **Ebitts** (menu laterale; da mobile: Impostazioni → Ebitts) permette di:

- inserire a mano una o più **Token Box**: costo totale, data di inizio, durata (10 / 15 / 20 anni);
- registrare i **guadagni Ebitts** letti dalle bollette Enel, a mano oppure con il pulsante **"Leggi bolletta con IA"**
  (Gemini estrae solo le voci legate a Ebitts / Token Box e tu le controlli prima di salvarle);
- usare **un solo caricamento per tutto**: in **Nuova bolletta** il pulsante **"Compila da foto/PDF"** legge la bolletta
  (luce, gas, acqua…), sceglie la categoria, compila periodo di fatturazione, importo totale, consumo, unità e scadenza e,
  se trova voci Ebitts, le propone nello stesso form. Si salva tutto con un solo "Salva bolletta", dopo averlo controllato.
- vedere il **prospetto**: quanto hai già recuperato, guadagno annuo stimato, ROI annuo e tempo stimato di rientro,
  calcolati sugli ultimi 365 giorni di dati.

### Configurazione (una sola volta)

1. **Database** — in Supabase → SQL Editor esegui `supabase-migration-ebitts.sql`
   (se invece crei il database da zero basta `supabase-schema.sql`, che lo include già).
2. **Chiave Gemini** — su Netlify: *Site configuration → Environment variables* → aggiungi `GEMINI_API_KEY`
   (la chiave resta sul server, dentro la funzione `netlify/functions/extract-bill.mjs`, e non finisce mai nel browser).
   Facoltativa: `GEMINI_MODEL` per cambiare modello (default `gemini-3.6-flash`).
3. Rifai il deploy del sito (basta un nuovo push da GitHub Desktop o "Trigger deploy" su Netlify).

La lettura con IA funziona **solo sul sito pubblicato su Netlify** (non con `npm run dev`).
Resta sempre disponibile l'inserimento manuale dei guadagni.

### Come viene calcolato il prospetto

- **Guadagno annuo stimato** = guadagni degli ultimi 365 giorni di dati (ripartiti linearmente per giorno se una voce
  copre più mesi), annualizzati.
- **ROI annuo** = guadagno annuo stimato / costo totale delle Token Box.
- **Tempo di rientro** = (costo totale − già recuperato) / guadagno annuo stimato.
- Con meno di circa 11 mesi di dati l'app mostra un avviso: la produzione fotovoltaica è stagionale e la stima può risultare
  sbilanciata.
- Con più acquisti di Token Box, i guadagni letti in bolletta sono ripartiti in proporzione al costo di ciascuno.

## 9. Controllo dei tipi

`npm run build` compila senza bloccarsi sui controlli di tipo; per un controllo completo del codice usa `npm run typecheck`.

## 10. Unità "Smc" per il gas

Il gas si legge in bolletta in **Smc** (standard metri cubi): è un'unità a sé, distinta dai m³ dell'acqua.
Se il database esisteva già, esegui una volta `supabase-migration-smc.sql` in Supabase → SQL Editor **prima** di
pubblicare la nuova versione: ammette il valore "Smc" e converte il gas già inserito. Nelle installazioni nuove
è già incluso in `supabase-schema.sql`.
