# Handoff: /nytt — «Nytt i butikk» som ukentlig utgivelsesuke

Målrepo: **cracchus-Tiberius/discdrop** (`main`) — Next.js App Router + Tailwind v4.
Dette er et **redesign av en side som allerede finnes** (`/nytt`). Funksjonaliteten er riktig i dag;
oppgaven er visuell og strukturell. Ingen ny scraping, ingen nye datakilder — samme ukesdata,
ny presentasjon.

## Overview

Siden skal føles som en **ukentlig utgivelse** (sneaker-drop-energi), ikke en endringslogg.
Fem endringer mot dagens implementasjon:

1. **Hero = uka som event.** Ukenummer som lime kalenderblokk, datointervall, overskrift med energi,
   og ukas totaler i en mørk statsstripe.
2. **Nytt øverste nivå «Ny disk»** — lyst spotlight-kort med diskbeskrivelse. Reservert for disker
   som ikke er sett i butikkene vi følger før. Vises **bare** når det finnes en; ellers rendres ingenting.
3. **«Nye drops»-kortene blir redaksjonelle spotlight-kort** — diskbildet i egen bildeflate over hele
   kortbredden, mye større navn. Griden tåler 1–10 kort uten å se tom ut.
4. **«Nytt i butikkutvalget» blir butikk-klynger** med synlige diskminiatyrer før man utvider —
   ikke en tekst-accordion.
5. **Ukesarkivet promoteres** fra piller i foten til egen seksjon med ukeskort.

Alt innhold er norsk bokmål. «disk / disker», aldri «disc(s)» i UI-tekst.

## About the Design Files

`DiscDrop Nytt i butikk.dc.html` er en **designreferanse skrevet i HTML** — en prototype som viser
tiltenkt utseende og oppførsel. Den er **ikke produksjonskode** og skal ikke kopieres inn i repoet.
Oppgaven er å gjenskape designet i discdrop-repoets eget miljø: React-klientkomponenter, Tailwind v4
med tokens i `app/globals.css`, og de etablerte mønstrene `dd-cta` / `dd-sticker` / `dd-selectable` /
`DiscImage` / `FlightBoxes`.

Åpne filen i en nettleser (`support.js` må ligge ved siden av) og se skjermene
`9a Nytt desktop` og `9a Nytt mobil`. Butikk-klyngene er klikkbare i prototypen — trykk for å utvide.

## Fidelity

**High-fidelity.** Alle mål under er CSS-px slik de står i prototypen, med Tailwind-klasse der repoet
allerede har et mønster. Farger, radier, kantbredder og skygger skal treffes eksakt.

---

## Skjerm 1 — Hero: uka som event

Seksjon: `border-b-2 border-[#101C14] bg-[#FFFDF6] px-5 pt-7 md:px-10 md:pt-12`, indre `mx-auto max-w-6xl`.
**Merk:** ingen bunn-padding — statsstripa er limt til seksjonens nederkant (se under).

### Kalenderblokk + overskrift
Desktop: `grid grid-cols-[auto_1fr] gap-9 items-end`. Mobil: blokk + tekst side om side (`flex gap-3.5`),
overskriften under.

**Kalenderblokk** (ukenummeret som fysisk objekt):
```
border-2 border-[#101C14] rounded-[20px] bg-[#B8E04A]
shadow-[5px_5px_0_#101C14] px-[26px] pt-4 pb-[18px] text-center
«UKE»   12px / 800 / tracking-[0.16em]
«34»    76px / 800 / leading-[0.86] / tracking-[-0.05em]     ← mobil: 40px, rounded-2xl, 4px skygge
«2026»  13px / 700 / mt-1.5                                  ← skjules på mobil (står i teksten ved siden av)
```

**Tekstkolonne:**
- Kicker: `17.–23. AUGUST · DENNE UKA` — 14px / 800 / `tracking-[0.14em]` / `#101C1499`
- `<h1>`: **«Ukas drops er landet.»** — 64px (mobil 40px) / 800 / `leading-[0.96]` / `tracking-[-0.035em]`.
  Siste ord får repoets highlight: `bg-[linear-gradient(transparent_62%,#B8E04A_62%)]`.
- Ingress: 18px (mobil 16px) / `leading-[1.55]` / `#101C14b3`, maks `62ch`:
  «Nye disker, nye plastutgaver og nye lagerføringer vi har fanget opp hos butikkene vi følger — samlet uke for uke.»

Overskriften skal variere med uka, ikke være statisk. Foreslåtte varianter, velg på `weekIndex % n`
(deterministisk, ikke tilfeldig — ellers får du hydration-mismatch):
`Ukas drops er landet.` · `Denne uka droppet det {n} nye drops.` · `Nytt på hyllene denne uka.`
Ved 0 nye utgaver og 0 lagerføringer: `Rolig uke. Ingen nye drops fanget opp.` og hopp over
alle tre innholdsseksjonene (arkivet blir da hovedinnholdet).

### Statsstripe
Limt til hero-seksjonens nederkant, `mt-9`:
```
border-2 border-[#101C14] border-b-0 rounded-t-[18px]
bg-[#1E3D2F] text-[#FFFDF6] overflow-hidden
```
Desktop: `flex`, fire celler, skiller `border-l border-[#FFFDF6]/[0.16]`, hver `px-[26px] py-5`,
`flex items-baseline gap-2.5`:

| Celle | Tall | Label |
| --- | --- | --- |
| 1 | 34px / 800 / `tracking-[-0.03em]` / **`#B8E04A`** | «nye drops» 15px / 600 / `#FFFDF6cc` |
| 2 | 34px / 800 / `#FFFDF6` | «nye lagerføringer» |
| 3 | 34px / 800 / `#FFFDF6` | «butikker» |
| 4 (`shrink-0`) | lime prikk 8px + «Sist sjekket i dag kl. 06:12» 13px / 600 / `#FFFDF677` | |

Mobil: tre kolonner (`flex-1`, tall 26px, labels 11px / `#FFFDF699`, `border-l` på 2 og 3),
«sist sjekket» som egen rad under med `border-t border-[#FFFDF6]/[0.16] pt-[11px]`.
Bruk `lager&shy;føringer` (soft hyphen) på mobil.

**Tidsstempelet må komme fra byggets ASOF-verdi**, ikke `Date.now()` — se kommentaren om
hydration-mismatch i `app/disc-drop-home.tsx`. Ingen pulsanimasjon: vi scraper daglig.

---

## Skjerm 2 — «Ny disk» (nytt øverste nivå)

Signaltypen er **ikke i bruk ennå**, men nivået skal finnes i koden fra dag én, slik at det holder
å sette `signal: "new_disc"` i dataene for at kortet dukker opp.

**Regel: rendrer `null` når det ikke finnes noen ny disk.** Ingen tom plassholder, ingen «kommer snart»-boks.
(I prototypen styres dette av tweak-en `visNyDisk` — slå den av for å se uka uten nivået.)

Seksjon: `border-b-2 border-[#101C14] px-5 py-9 md:px-10 md:py-14`.
Hode: `<h2>` «Ny disk» 26px (mobil 22px) / 800 + sidestilt (mobil: under) undertittel 15px `#101C1499`:
«Aldri sett i norsk butikk før denne uka.»

**Kortet er LYST** — viktig: noen katalogbilder er ikke-transparente, så en mørk bildeflate gir
tilfeldige hvite firkanter. Krem bildeflate fjerner problemet for alle bilder.

**To layouter etter antall:**
- **1 ny disk (normalen):** full bredde, `grid md:grid-cols-[230px_1fr]`, hel beskrivelse.
- **2+ nye disker:** `grid md:grid-cols-2 gap-5`, bildekolonnen 150px, beskrivelsen klippet til
  2 linjer (`-webkit-line-clamp:2`). Aldri full bredde per kort når det er flere — da kommer
  overdimensjoneringen tilbake.

Kortet (`<Link href={`/disc/${id}`}`):
```
border-2 border-[#101C14] rounded-[20px] bg-white shadow-[5px_5px_0_#B8E04A] overflow-hidden
```
- **Bilderute (venstre; mobil: topp, h-[150px], border-b-2):** `bg-[#F1EFE6] border-r-2 border-[#101C14]
  p-5 flex items-center justify-center`; inni en sirkel 150px `rounded-full bg-[#FFFDF6]
  border-2 border-[#101C14]` med `<DiscImage />`.
- **Tekstrute:** `px-6 py-5 flex flex-col gap-[11px]`
  - Topprad (`flex items-center justify-between flex-wrap gap-2.5`): sticker **«NY DISK»**
    (`dd-sticker`-geometri: `bg-[#B8E04A]` 12px / 800 / `tracking-[0.1em]` `rounded-[9px] px-[11px]
    py-[5px] -rotate-2 shadow-[2px_2px_0_#101C14]`) + `FlightBoxes` (bokser `bg-[#F1EFE6]`, tall 16px).
    **Ikke «Første gang i Norge»** — settet inneholder svenske butikker.
    Negative flight-tall med **U+2212** («−1»), ikke bindestrek.
  - `<h3>` navn 30px (mobil 26px) / 800 / `tracking-[-0.035em]`; under: `{merke} · {plast} · {type}`
    15px `#101C1499`
  - **Beskrivelse** (ny): 15px / `leading-[1.55]` / `#101C14b3`, maks `64ch`. Hentes fra diskens
    beskrivelsesfelt i datasettet. Ved 2+ kort: 14px + clamp 2 linjer; mobil: clamp 3 linjer.
  - Bunnrad — **samme mønster som Hot Drops-/Nye drops-kortene**: `mt-auto border-t-2 border-[#F1EFE6]
    pt-3.5 flex items-center justify-between gap-4`. Venstre gruppe: «Dukket opp hos» 12px /
    `#101C1477` + butikkliste 15px / 700. Høyre gruppe (`flex items-center gap-3.5`): «fra, inkl.
    frakt» 11px over pris 24px / 800, med `dd-cta` «Se pris» **rett inntil** — øyet leser
    «249,- → Se pris» som én enhet.
  - Mobil bunnrad: venstre «fra, inkl. frakt · hos {butikker}» 11px + pris 22px / 800; høyre
    `dd-cta` `min-h-[46px]`. Ingen full-bredde-knapp.

---

## Skjerm 3 — «Nye drops» (spotlight-kort)

Seksjon: `border-b-2 border-[#101C14] px-5 py-9 md:px-10 md:py-14`.
Hode: `<h2>` «Nye drops» + undertittel «Kjent form, ny plast eller ny serie.» + høyrestilt
`«{n} denne uka»` 14px / 700 / `#101C1499` (mobil: antallet inn i undertittelen).

**Grid — dette er nøkkelen til at 2–3 kort ser intensjonelle ut:**
```
grid grid-cols-1 gap-5 md:[grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]
```
`auto-fit` + `minmax` gjør at 2 kort blir bredere i stedet for å etterlate hull, 3 fyller raden,
og 4+ flyter over til neste rad. **Ikke** bruk faste `lg:grid-cols-3`.

**Kortet** (`<Link href={`/disc/${id}`}`):
```
flex flex-col border-2 border-[#101C14] rounded-[20px] bg-white
shadow-[5px_5px_0_#B8E04A] overflow-hidden
hover: -translate-x-1 -translate-y-1 shadow-[8px_8px_0_#B8E04A]  (150ms ease-out)
```
1. **Bildeflate** — `relative h-[200px] (mobil 150px) bg-[#F1EFE6] border-b-2 border-[#101C14]
   flex items-center justify-center`; `<DiscImage />` i `max-w-[82%] h-full`.
   Dette er hovedforskjellen fra katalogkortene, der bildet er en 64px-rute i hjørnet.
   - Sticker øverst venstre (`top-3.5 left-3.5`): «NY DROP» — `bg-[#101C14] text-[#B8E04A]`
     11px / 800 / `tracking-[0.1em]` `rounded-lg px-2.5 py-[5px] -rotate-2 shadow-[2px_2px_0_#B8E04A]`
   - Ukedag øverst høyre: `TIRSDAG` 11px / 800 / `tracking-[0.1em]` / `#101C1477` — hvilken dag i uka
     utgaven dukket opp. Gir «drop»-følelsen; utled av `firstSeen`.
2. **Innhold** — `px-5 pb-5 pt-[18px] flex flex-1 flex-col gap-3.5`
   - `<h3>` navn **28px** (mobil 24px) / 800 / `leading-[1.02]` / `tracking-[-0.03em]`
   - `{merke} · {plast}` 15px / `#101C1499`
   - Butikkrad: 26px sirkel med butikkinitialer (`border-2 border-[#101C14] bg-[#F1EFE6]`, 10px / 800)
     + butikknavn 14px / 700 + `«+ 1 butikk»` 13px / `#101C1477` når den finnes hos flere
   - Bunnrad: `mt-auto border-t-2 border-[#F1EFE6] pt-3.5 flex items-end justify-between` —
     «fra, inkl. frakt» 11px / `#101C1477` over pris 24px / 800; `dd-cta` «Se pris».

---

## Skjerm 4 — «Nytt i butikkutvalget» (butikk-klynger)

Erstatter dagens accordion med tekstrader. Seksjon: `border-b-2 border-[#101C14] px-5 py-9 md:px-10 md:py-14`.
Hode: `<h2>` + «Kjente disker som dukket opp hos en ny butikk.» + høyrestilt `«18 hos 7 butikker»`.

**Layout — bruk CSS-kolonner, ikke grid:**
```
md:[columns:2] md:[column-gap:16px]        // mobil: én kolonne, vanlig flex-stack med gap-3
hver klynge: break-inside-avoid mb-4
```
Grunn: med et 2-kolonners grid blir radhøyden satt av den høyeste cellen, så en utvidet klynge
etterlater et stort hull i nabokolonnen. Kolonner balanserer seg selv.

**Klyngekortet:**
```
border-2 border-[#101C14] rounded-[18px] bg-white shadow-[4px_4px_0_#101C14] overflow-hidden
```
- **Hodet (klikkflate, `<button>` full bredde, `min-h-[56px]`, `px-[18px] py-4`)** —
  `flex items-center gap-3.5`:
  - Butikkmerke: 44px (mobil 40px) `rounded-xl border-2 border-[#101C14] bg-[#B8E04A]`
    med initialer 15px / 800. Bytt gjerne til butikklogo når dere har dem.
  - Navn 17px / 800 + undertekst 13px / `#101C1499`: `«8 kjente disker inn denne uka»`
    (entall: «1 kjent disk inn denne uka»)
  - **Diskminiatyrer — det viktigste grepet:** opptil 4 (mobil 2) overlappende sirkler,
    34px (mobil 30px), `rounded-full border-2 border-[#101C14] bg-[#F1EFE6] -ml-2`, hver med
    `<DiscImage />`. Resten som mørk brikke `bg-[#101C14] text-[#B8E04A]` «+4».
    Man skal se *hva* som kom inn før man utvider.
  - Chevron i 32px `rounded-full bg-[#F1EFE6]`, `rotate-180` når åpen (150ms transition)
- **Innholdet (utvidet)** — `border-t-2 border-[#F1EFE6]`, én rad per disk:
  `flex items-center gap-3 px-[18px] py-[11px] border-b border-[#F1EFE6] min-h-[56px]`
  (mobil `min-h-[60px]`) — 40px `rounded-[10px] bg-[#F1EFE6]` miniatyr, navn 15px / 800,
  `{merke} · {plast}` 12px / `#101C1499`, pris 16px / 800, chevron `#101C1466` (skjules på mobil).

### Oppførsel
- `useState<Record<string, boolean>>` — **den største butikken åpen som standard**, resten lukket.
  Da har seksjonen innhold uten at brukeren må trykke.
- Sorter butikkene på antall disker synkende (som i dag).
- Bruk `<button aria-expanded>` + `aria-controls` på hodet, ikke `<div onClick>`.
- Ingen `<details>`: vi trenger kontroll på chevron-rotasjon og standard-åpen.

---

## Skjerm 5 — Ukesarkiv

Egen seksjon nederst (`px-5 py-9 md:px-10 md:py-14`), **ikke** piller i foten.
Hode: `<h2>` «Bla i tidligere uker» + «Hver uke siden vi startet å følge butikkene.» +
`<Link>` «Hele arkivet →» (`underline decoration-[#B8E04A] decoration-2 underline-offset-4`).

**Desktop:** `grid grid-cols-4 gap-4`, fire siste uker. Kortet:
```
border-2 border-[#101C14] rounded-2xl bg-white p-4 shadow-[3px_3px_0_#101C14]
flex flex-col gap-3
«Uke 33» 22px/800 tracking-[-0.03em]   +  «10.–16. aug» 12px/700 #101C1477
chips:  «2 drops» bg-[#B8E04A]  ·  «11 lagerføringer» bg-[#F1EFE6]   (12px/800, rounded-lg px-[9px] py-1)
høydepunkt: «Discraft Luna · Kastaplast Reko» 13px/700 #101C1499
```
**Mobil:** liste med rader (`min-h-[56px]`): «Uke 33» 20px / 800, dato + `«2 drops · 11 lagerføringer»`,
chevron til høyre. Deretter «Hele arkivet →» som egen rad.

Ruter: `/nytt` = denne uka, `/nytt/uke/{år}-{uke}` = arkivert uke (behold dagens ruteform hvis den
finnes). Arkivsidene bruker **samme layout** — bare kicker-teksten endres fra «DENNE UKA» til
datointervallet, og statsstripa mister «sist sjekket»-cellen.

---

## Design Tokens (finnes i `app/globals.css`)

| Token | Verdi | Bruk her |
| --- | --- | --- |
| bakgrunn | `#FFFDF6` | side og seksjoner |
| tekst | `#101C14` | brødtekst og alle kanter |
| dempet | `#101C1499` / `#101C1477` / `#101C1488` | undertitler, meta, labels |
| lime | `#B8E04A` | kalenderblokk, stickers, CTA, første statstall |
| mørkegrønn | `#1E3D2F` | statsstripe |
| flate | `#F1EFE6` | bildeflater, miniatyrer, chevron-sirkler, chips |
| på mørk bunn | `#FFFDF6cc` / `#FFFDF6aa` / `#FFFDF677` / `#FFFDF6`+16% (skiller) | |
| kant | `2px solid #101C14` | alle kort og seksjonsskiller |
| radius | 10px sticker · 12px merke/flight · 14px CTA · 16–20px kort · 999px miniatyr | |
| skygge | `2px 2px 0` sticker · `3px 3px 0` CTA/arkiv · `4px 4px 0 #101C14` klynge · `5–6px lime` spotlight | |
| font | Bricolage Grotesque, vekt 400/600/800 | |
| typeskala | 76px ukenr · 64px h1 · 30px Ny disk · 28px Nye drops-kort · 26px h2 · 34px statstall · 17px klyngenavn · 11px finprint | |

Minste tapflate 44px overalt (klyngehoder 56px, mobilrader 56–60px).

## Filer

| Fil | Endring |
| --- | --- |
| `app/nytt/page.tsx` | ny seksjonsrekkefølge: `WeekHero` → `NewDiscTier` → `NewDrops` → `StoreClusters` → `WeekArchive` |
| `components/nytt/WeekHero.tsx` (ny) | kalenderblokk + overskrift + statsstripe |
| `components/nytt/NewDiscTier.tsx` (ny) | lyst spotlight-kort med beskrivelse; `return null` uten data; 1 = full bredde, 2+ = to-kolonne |
| `components/nytt/NewDropCard.tsx` (ny) | spotlight-kortet (erstatter dagens katalogkort her) |
| `components/nytt/StoreCluster.tsx` (ny) | klynge med miniatyrer + utvidbar liste (klient) |
| `components/nytt/WeekArchive.tsx` (ny) | arkivseksjonen (flyttet ut av foten) |
| dataligget for uka | trenger per disk: `signal: "new_disc" \| "new_drop" \| "new_stock"`, `firstSeen` (for ukedagen), `stores[]`, `fromPriceLandedNOK`, `description` (for Ny disk-kortet); per uke: `weekNumber`, `year`, `dateRange`, `checkedAt`, totalene |

`signal`-feltet er hele poenget med nivådelingen — hvis dagens data bare skiller «ny drop» og
«ny lagerføring», legg til `new_disc` som gyldig verdi nå, selv om ingenting bruker den ennå.

**Terminologi — absolutt regel:** i all UI-tekst heter det «drops» («nye drops», «NY DROP»,
«3 drops»), aldri «utgave»/«utgaver». Og aldri «Første gang i Norge» — butikkutvalget inneholder
svenske butikker.

## Assets
Ingen nye. Diskbilder via `getDiscImage()` / `data/disc-images.json`; ikoner er inline SVG.
Diskillustrasjonene i prototypen er `DiscImage`-plassholderne (merkefarge + initialer, sideprofil per
disktype) — i produksjon fylles de av ekte produktbilder. Butikkmerkene bruker initialer i påvente
av logoer.

## Beslutninger som ikke skal endres uten å spørre
- «Ny disk»-nivået rendrer **ingenting** når det er tomt — aldri en plassholder.
- Alle bildeflater er lyse (krem `#F1EFE6` / hvit) — aldri mørk bakgrunn bak produktbilder
  (ikke-transparente katalogbilder gir hvite firkanter på mørk bunn).
- Prosent/priskutt hører til `/prisfall`, ikke her. `/nytt` handler om *nytt*, ikke om pris.
- Ingen puls-/live-animasjoner: siden oppdateres daglig, og animasjon lover sanntid.
- Statsstripa bruker samme mørkegrønne (#1E3D2F) som tickerbåndet på forsiden — de to skal
  kjennes igjen som samme «vi overvåker markedet»-signal.
