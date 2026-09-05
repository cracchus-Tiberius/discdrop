// data/store-profiles.js — marketing blurbs for the /butikker page.
// Each `blurb` is written in the store's own voice (their taglines and
// selling points, pulled from their sites and adapted to Bokmål), not
// DiscDrop's neutral copy. Quoted phrases are their own wording, translated
// where the source was Swedish. Keyed by the same store key used in
// data/scraped-prices.json's `stores` object.
'use strict';

const STORE_PROFILES = {
  wearediscgolf: {
    tagline: "We Are Disc Golf",
    blurb:
      "We Are Disc Golf ser på seg selv som mer enn en butikk – et fellesskap. Med et eget «We Academy»-univers av guider og tips, pluss over 40 merker med disker, bager og kurver, skal du finne «alt du trenger for å komme i gang med diskgolf».",
  },
  kvamdgs: {
    tagline: "Der fjell møter fairway",
    blurb:
      "«Der fjell møter fairway» er Kvam Discgolf Shop sin egen beskrivelse av seg selv – lokal stolthet fra Vestlandet kombinert med «kvalitetsutstyr, rask levering og personlig service for spillere på alle nivåer». De er tydelige på hvem de er til for: «Vi er til for kunden».",
  },
  arcticdisc: {
    tagline: "Personlig service fra noen som kjenner spillet",
    blurb:
      "Arctic Disc er en norsk nettbutikk drevet fra Olderdalen i Troms, der grunnleggeren «velger ut produkter han selv stoler på og bruker» etter over ti år som konkurransespiller. Løftet deres er personlig: «Handler du hos oss, får du personlig service fra noen som kjenner spillet» – og med snittbehandlingstid på rundt 6 timer går det fort også.",
  },
  krokhol: {
    tagline: "100 meter fra tee 1",
    blurb:
      "Krokhol Disc Golf Shop kaller seg «en av Norges ledende spesialbutikker for diskgolf», og pro shopen ligger «i 2. etasje over kafeen på Krokhol, kun 100 meter fra tee 1» i Siggerud. Banen deres åpnet i 2018 og fikk i 2022 følge av «Krokhol Blue, en kortere og mer tilgjengelig bane». Hver disk fotograferes og veies individuelt: «vekten du ser i nettbutikken er vekten på akkurat den disken du får levert». 60 dagers fri retur.",
  },
  frisbeebutikken: {
    tagline: "Midt i diskgolfsmørøyet",
    blurb:
      "Frisbeebutikken startet «så smått i 2016 med salg av diskgolfutstyr fra en tilhenger», og driver i dag butikk på Loholt i Trondheim – «midt i diskgolfsmørøyet», rett ved Dragvoll Diskgolfarena. Underveis har de utvidet til banedesign, banebygging og kursvirksomhet. De inviterer deg inn «for å bla i vårt store utvalg eller bare en hyggelig diskgolfprat».",
  },
  starframe: {
    tagline: "Sammen bygger vi bag",
    blurb:
      "Starframe ble etablert høsten 2021 og har «vokst fra en liten nettbutikk til en av Norges største spesialbutikker innen discgolf». I 2026 flyttet de inn på Parketten i Brumunddal, med rundt 270 m² butikk og to diskgolfsimulatorer. De vil «være blant de første i Norge med de nyeste produktene», og gir tilbake gjennom klubbsamarbeid, turneringspremiering og Team Starframe.",
  },
  hyzershop: {
    tagline: "For at miljøet skal vokse",
    blurb:
      "HyzerShop holder det kort om seg selv: de «jobber alltid mot å levere best mulig produkter til våre kunder, og bidra til at disc golf miljøet i Norge vokser enda mer».",
  },
  discgolfdynasty: {
    tagline: "Ditt neste steg",
    blurb:
      "Disc Golf Dynasty er «fire unge karer fra Drammensområdet» som åpnet nettbutikken i mai 2021. De er spillere selv og mener det gir dem peiling på «hva som både ønskes og forventes av spillere». Nivået ditt er likegyldig for dem: «Vi har lyst til å hjelpe DEG med å ta DITT neste steg!»",
  },
  discsor: {
    tagline: "Glede, fellesskap og natur",
    blurb:
      "Disc Sør er en nyere nettbutikk med base i Søgne. Visjonen deres er å «fremme discgolf som en morsom og tilgjengelig sport for alle» – for dem handler sporten «ikke bare om å kaste en disc inn i en kurv, men også om å oppleve glede, fellesskap og natur». Utvalget er satt sammen for spillere på alle nivåer.",
  },
  golfdiscer: {
    tagline: "Designet for alle",
    blurb:
      "Golfdiscer.no ønsker velkommen med et bredt utvalg fra store merker som Innova, Discraft og Discmania, og en tydelig nybegynnervinkling gjennom siden «Ny til sporten?». De trekker frem materialkvaliteten – «premium plast som tåler røffe forhold» – og tilbyr egne klubbavtaler.",
  },
  frisbeesor: {
    tagline: "Alle kan finne gleden i å kaste plast",
    blurb:
      "Frisbee Sør oppsummerer filosofien sin enkelt: «Alle kan finne gleden i å kaste plast». De kaller seg «din totalleverandør innen diskgolf-utstyr» og beskriver butikken som stedet «hvor lidenskap møter ekspertise» – med både nettbutikk og fysisk butikk, og noe å tilby «enten du er nybegynner eller proff».",
  },
  discexpress: {
    tagline: "Köp discar, väskor och discgolfutrustning",
    blurb:
      "Discexpress er en svensk nettbutikk med en uformell, emoji-fylt tone og et bredt merkeutvalg fra MVP, Axiom, Discraft og Innova. De har egen nybegynnerseksjon, sponser «Team Discexpress» i det lokale diskgolf-miljøet, og kjører jevnlig salg og «mystery boxes» for de som liker en overraskelse.",
  },
  rocketdiscs: {
    tagline: "A one-stop-shop for disc golf enthusiasts",
    blurb:
      "Rocketdiscs beskriver seg selv som en ledende aktør innen nettbasert diskgolfsalg, med et svært stort lager og et avansert søkeverktøy som lar deg filtrere disker på flighttall og egenskaper – uavhengig av merke. De omtaler seg selv som «a one-stop-shop for disc golf enthusiasts», med alt fra disker til bager, kurver og tilbehør.",
  },
  aceshop: {
    tagline: "Verdens beste disc golf-merker samlet under ett tak",
    blurb:
      "Aceshop har fysisk butikk ved Sandnes Discgolfpark, og kaller seg selv «butikken for deg som elsker disc golf, med bredt utvalg og god fagkunnskap». De samler «verdens beste disc golf-merker under ett tak» – over 30 merker – med fri frakt over 799 kr og 30 dagers åpent kjøp.",
  },
  discsport: {
    tagline: "The Discgolfers Supplier",
    blurb:
      "Discsport har vært i bransjen siden 2004 og kaller seg selv «The Discgolfers Supplier». De har et av de aller største svenske lagrene – over 50 000 disker – bonuspoeng på hvert kjøp, og en egen fellesskapskampanje under emneknaggen #yesdiscsport.",
  },
  nydisk: {
    tagline: "Bygget på over 15 års lidenskap for diskgolf",
    blurb:
      "NyDisk beskriver seg selv som «bygget på over 15 års lidenskap for diskgolf», med fysisk butikk i Nannestad og over 700 produkter i katalogen. Kunder trekker fram staben som «utrolig hyggelig og hjelpsomme», med «masse kunnskap om valg av disker uansett nivå».",
  },
  discshopen: {
    tagline: "Lynrask levering på DiscGolf!",
    blurb:
      "DiscShopen sitt løfte er «lynrask levering på diskgolf», og de viser til over 2000 fornøyde kunder i Norge. Usikker på hva du trenger? Butikken har en egen 60-sekunders quiz som foreslår disker basert på svarene dine.",
  },
  ugglans: {
    tagline: "Din destination för allt som rör discgolf",
    blurb:
      "Ugglans Discgolf driver tre fysiske butikker i Sverige og omtaler seg selv som «din destination för allt som rör discgolf». Kundene beskriver staben som «sjukt kunnig och tillmötesgående», og i butikkene kan du teste puttere på egen puttebane med en kopp kaffe i hånden. De har også et stort utvalg brukte disker.",
  },
  discace: {
    tagline: "Allt för discgolf",
    blurb:
      "Discace of Sweden sin visjon er enkel: «allt för discgolf». De sender alltid innen 48 timer på virkedager, har fysisk butikk i Mjölby, og skiller seg ut med «Disc Replay» – et eget marked for brukte disker til lavere pris. De tilbyr også diskgolfkurs for nybegynnere.",
  },
};

module.exports = { STORE_PROFILES };
