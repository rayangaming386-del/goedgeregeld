/**
 * Brondata voor de seed: de vier modelrecords uit bronmateriaal/wagenpark.json,
 * aangevuld met originele teksten, alt-teksten en focuspunten per foto.
 *
 * Prijzen, borg, specificaties en voorwaarden komen uit de listing van een
 * tussenpersoon en staan na de seed als “onbevestigd”.
 */

export type SeedPhoto = {
  file: string
  alt: string
  focal: [number, number]
  /** Promotiebeelden met tekst over beschikbaarheid, korting of buitenlandgebruik. */
  hidden?: string
}

export type SeedVehicle = {
  sourceId: 'rs3' | 'rsq3' | 'sq5' | 'sq8'
  slug: string
  name: string
  model: string
  edition: string | null
  modelYear: number | null
  tagline: string
  description: string
  highlights: string[]
  seoTitle: string
  seoDescription: string
  photos: SeedPhoto[]
  signatureLine: string
  /** Bestandsnamen voor de signature-sectie. */
  signatureMedia: string
  signatureDetail: string
}

export const SEED_VEHICLES: SeedVehicle[] = [
  {
    sourceId: 'rs3',
    slug: 'audi-rs3-sportback',
    name: 'Audi RS3 Sportback',
    model: 'RS3 Sportback',
    edition: null,
    modelYear: null,
    tagline: 'Compacte Sportback met het karakter van een RS.',
    description:
      'Compact van formaat, groot van karakter. De RS3 Sportback is de kleinste auto in het wagenpark: laag, breed en gemaakt om te rijden.\n\nBinnen vallen de RS-sportstoelen met honingraatstiksel en rode accenten direct op.',
    highlights: ['RS-sportstoelen met honingraatstiksel en rode accenten', 'Zwarte lichtmetalen velgen', 'Wit met zwarte accenten'],
    seoTitle: 'Audi RS3 Sportback huren in Den Haag',
    seoDescription:
      'Huur de Audi RS3 Sportback bij Goed Geregeld in Den Haag. Bekijk de foto’s en gegevens en vraag de beschikbaarheid aan voor jouw periode.',
    signatureLine: 'Compact, laag en direct.',
    signatureMedia: 'rs3-03.jpeg',
    signatureDetail: 'rs3-04.jpeg',
    photos: [
      { file: 'rs3-01.jpeg', alt: 'Witte Audi RS3 Sportback schuin van voren in de showroom, met zwarte velgen en een Goed Geregeld-kentekenplaat.', focal: [55, 60] },
      { file: 'rs3-02.jpeg', alt: 'Witte Audi RS3 Sportback in de showroom onder een plafond van zeshoekige ledlijnen, met het Goed Geregeld-logo op de muur.', focal: [36, 58] },
      { file: 'rs3-03.jpeg', alt: 'Achterkant van de witte Audi RS3 Sportback met brandende achterlichten, voor de logowand van Goed Geregeld.', focal: [48, 62] },
      { file: 'rs3-05.jpeg', alt: 'Witte Audi RS3 Sportback buiten op een kade met klinkers, onder een blauwe lucht.', focal: [52, 60] },
      { file: 'rs3-04.jpeg', alt: 'Zwarte RS-sportstoelen met honingraatstiksel en rode accenten in de Audi RS3 Sportback.', focal: [55, 50] },
    ],
  },
  {
    sourceId: 'rsq3',
    slug: 'audi-rs-q3',
    name: 'Audi RS Q3 10 Years Edition',
    model: 'RS Q3',
    edition: '10 Years Edition',
    modelYear: null,
    tagline: 'Jubileumeditie met SUV-formaat en volle RS-uitstraling.',
    description:
      'De RS Q3 in de 10 Years Edition: het formaat van een compacte SUV met de uitstraling van een RS-model. Grijs gelakt, met zwart dak en zwarte accenten.\n\nIn het interieur zitten sportstoelen met honingraatstiksel en RS-logo.',
    highlights: ['10 Years Edition', 'Downpipe', 'Sportstoelen met honingraatstiksel', 'Grijs met zwart dak'],
    seoTitle: 'Audi RS Q3 10 Years Edition huren in Den Haag',
    seoDescription:
      'Huur de Audi RS Q3 10 Years Edition bij Goed Geregeld in Den Haag. Bekijk de foto’s en gegevens en vraag de beschikbaarheid aan.',
    signatureLine: 'Jubileumeditie met RS-karakter.',
    signatureMedia: 'rsq3-05.jpeg',
    signatureDetail: 'rsq3-07.jpeg',
    photos: [
      { file: 'rsq3-02.jpeg', alt: 'Grijze Audi RS Q3 met zwart dak schuin van voren in de showroom met zeshoekig ledplafond.', focal: [34, 58] },
      { file: 'rsq3-03.jpeg', alt: 'Recht vooraanzicht van de grijze Audi RS Q3 met zwarte grille en een Goed Geregeld-kentekenplaat.', focal: [50, 55] },
      { file: 'rsq3-05.jpeg', alt: 'Achterkant van de grijze Audi RS Q3 met brandende achterlichten en het RS Q3-embleem.', focal: [48, 55] },
      { file: 'rsq3-04.jpeg', alt: 'Vooraanzicht van de grijze Audi RS Q3, met de reflectie van het zeshoekige plafond op de motorkap.', focal: [50, 55] },
      { file: 'rsq3-06.jpeg', alt: 'Grijze Audi RS Q3 van achteren in de showroom, voor de logowand van Goed Geregeld.', focal: [45, 62] },
      { file: 'rsq3-07.jpeg', alt: 'Sportstoelen met honingraatstiksel en RS-logo in de Audi RS Q3.', focal: [55, 55] },
      { file: 'rsq3-08.jpeg', alt: 'Dashboard en stuur van de Audi RS Q3, met door de voorruit het logo van Goed Geregeld op de muur.', focal: [50, 50] },
      {
        file: 'rsq3-01.jpeg',
        alt: 'Promotiebeeld van de grijze Audi RS Q3 met de teksten ‘10 years edition’, ‘1 of 555’ en een telefoonnummer.',
        focal: [35, 50],
        hidden: 'Promotiebeeld met tekstoverlay (‘1 of 555’, telefoonnummer). Niet publiek tonen zonder akkoord van de eigenaar.',
      },
    ],
  },
  {
    sourceId: 'sq5',
    slug: 'audi-sq5',
    name: 'Audi SQ5',
    model: 'SQ5',
    edition: null,
    modelYear: 2026,
    tagline: 'Ruim, comfortabel en snel, met een interieur vol techniek.',
    description:
      'De SQ5 is de comfortabele allrounder van het wagenpark: ruim, snel en vol techniek, met grote schermen en sfeerverlichting in het interieur.\n\nDonkerblauw gelakt, met een doorlopende lichtbalk aan de achterkant.',
    highlights: ['Massagefunctie in de voorstoelen', 'Sfeerverlichting', 'Doorlopende lichtbalk achter', 'Donkerblauw'],
    seoTitle: 'Audi SQ5 huren in Den Haag',
    seoDescription:
      'Huur de Audi SQ5 bij Goed Geregeld in Den Haag. Bekijk de foto’s en gegevens en vraag de beschikbaarheid aan voor jouw periode.',
    signatureLine: 'Comfort en vermogen in balans.',
    signatureMedia: 'sq5-03.jpeg',
    signatureDetail: 'sq5-06.jpeg',
    photos: [
      { file: 'sq5-02.jpeg', alt: 'Donkerblauwe Audi SQ5 van opzij en achteren in de showroom, met de doorlopende lichtbalk aan de achterkant.', focal: [55, 58] },
      { file: 'sq5-03.jpeg', alt: 'Achterkant van de donkerblauwe Audi SQ5 met rode lichtbalk en een Goed Geregeld-kentekenplaat.', focal: [42, 55] },
      { file: 'sq5-04.jpeg', alt: 'Recht achteraanzicht van de Audi SQ5 met brandende lichtbalk.', focal: [50, 55] },
      { file: 'sq5-05.jpeg', alt: 'Interieur van de Audi SQ5 met digitale instrumenten, groot middenscherm en sfeerverlichting.', focal: [50, 60] },
      { file: 'sq5-06.jpeg', alt: 'Middenscherm van de Audi SQ5 met het menu voor de massagefunctie van de stoelen.', focal: [50, 40] },
      {
        file: 'sq5-01.jpeg',
        alt: 'Promotiebeeld van de donkerblauwe Audi SQ5 met drie vlaggen en een telefoonnummer in beeld.',
        focal: [50, 50],
        hidden: 'Promotiebeeld met vlaggen en telefoonnummer; de vlaggen kunnen buitenlandgebruik suggereren. Niet publiek tonen zonder akkoord.',
      },
    ],
  },
  {
    sourceId: 'sq8',
    slug: 'audi-sq8',
    name: 'Audi SQ8',
    model: 'SQ8',
    edition: 'Stage 2 met downpipe',
    modelYear: null,
    tagline: 'Het vlaggenschip: ruim, luxueus en krachtig.',
    description:
      'De SQ8 is het vlaggenschip van het wagenpark: een grote, luxueuze SUV met veel vermogen.\n\nWit gelakt met zwarte grille en velgen. Binnen: sportstoelen met ruitstiksel en sfeerverlichting.',
    highlights: ['Stage 2 met downpipe', 'Sportstoelen met ruitstiksel', 'Sfeerverlichting in het interieur', 'Wit met zwarte grille en velgen'],
    seoTitle: 'Audi SQ8 huren in Den Haag',
    seoDescription:
      'Huur de Audi SQ8 bij Goed Geregeld in Den Haag. Bekijk de foto’s en gegevens en vraag de beschikbaarheid aan voor jouw periode.',
    signatureLine: 'Het vlaggenschip van het wagenpark.',
    signatureMedia: 'sq8-05.jpeg',
    signatureDetail: 'sq8-07.jpeg',
    photos: [
      { file: 'sq8-04.jpeg', alt: 'Witte Audi SQ8 met zwarte velgen schuin van voren, voor de logowand van Goed Geregeld.', focal: [50, 64] },
      { file: 'sq8-02.jpeg', alt: 'Witte Audi SQ8 met zwarte grille schuin van voren in de showroom, met rood licht in de hoek.', focal: [55, 58] },
      { file: 'sq8-05.jpeg', alt: 'Achterkant van de witte Audi SQ8 met doorlopende achterlichtbalk, onder het zeshoekige ledplafond.', focal: [42, 66] },
      { file: 'sq8-03.jpeg', alt: 'Witte Audi SQ8 schuin van voren onder het zeshoekige ledplafond.', focal: [55, 60] },
      { file: 'sq8-06.jpeg', alt: 'Geopend portier van de Audi SQ8 met paarse sfeerverlichting in het interieur.', focal: [60, 55] },
      { file: 'sq8-07.jpeg', alt: 'Zwarte sportstoelen met ruitstiksel in de Audi SQ8.', focal: [55, 55] },
      {
        file: 'sq8-01.jpeg',
        alt: 'Promotiebeeld van de witte Audi SQ8 met teksten over Stage 2, directe beschikbaarheid en korting.',
        focal: [50, 50],
        hidden: 'Promotiebeeld met claims (“Per direct beschikbaar”, “Direct ophalen = hoge korting”). Niet publiek tonen zonder akkoord.',
      },
    ],
  },
]

export const SEED_FAQS: Array<{ topic: string; question: string; answer: string; publish: boolean }> = [
  {
    topic: 'aanvraag',
    question: 'Is mijn aanvraag direct een reservering?',
    answer:
      'Nee. Met een aanvraag geef je je gewenste auto en periode door. Je hoort of de auto beschikbaar is en ontvangt de huurvoorwaarden. Pas na die bevestiging is de auto voor je gereserveerd.',
    publish: true,
  },
  {
    topic: 'beschikbaarheid',
    question: 'Hoe weet ik of een auto beschikbaar is?',
    answer:
      'Vraag de beschikbaarheid aan via het formulier op de website of via WhatsApp. Je krijgt persoonlijk antwoord voor de periode die je hebt opgegeven.',
    publish: true,
  },
  {
    topic: 'aanvraag',
    question: 'Kan ik ook via WhatsApp aanvragen?',
    answer:
      'Ja. Via de WhatsApp-knop op de pagina van elke auto staat een bericht klaar met de gekozen auto. Vul je periode aan en verstuur het bericht.',
    publish: true,
  },
  {
    topic: 'ophalen',
    question: 'Waar haal ik de auto op?',
    answer:
      'Het ophalen en terugbrengen spreken we met je af bij de bevestiging van je aanvraag. Heb je vooraf een vraag over de locatie? Stuur ons een bericht via WhatsApp.',
    publish: true,
  },
  {
    topic: 'minimumleeftijd',
    question: 'Wat is de minimumleeftijd?',
    answer: 'De minimumleeftijd is 21 jaar. [Bevestigen; vermelden of er een eis geldt voor het aantal jaren rijbewijsbezit.]',
    publish: false,
  },
  {
    topic: 'borg',
    question: 'Hoe hoog is de borg en hoe werkt die?',
    answer: 'De borg verschilt per auto en staat op de pagina van de auto. [Aanvullen: hoe en wanneer de borg wordt betaald en terugbetaald.]',
    publish: false,
  },
  { topic: 'huurperiode', question: 'Wat is de minimale huurperiode?', answer: '[Door de eigenaar in te vullen.]', publish: false },
  {
    topic: 'kilometers',
    question: 'Hoeveel kilometers mag ik rijden?',
    answer: 'Alle auto’s zijn kilometervrij. [Bevestigen per auto.]',
    publish: false,
  },
  { topic: 'buitenland', question: 'Mag ik met de auto naar het buitenland?', answer: '[Door de eigenaar in te vullen.]', publish: false },
  {
    topic: 'verzekering',
    question: 'Hoe zit het met verzekering en eigen risico?',
    answer: '[Door de eigenaar in te vullen: dekking, eigen risico en wat te doen bij schade.]',
    publish: false,
  },
  { topic: 'annulering', question: 'Kan ik mijn reservering annuleren?', answer: '[Door de eigenaar in te vullen: annuleringsvoorwaarden en eventuele kosten.]', publish: false },
]

export const SEED_PAGES = [
  {
    slug: 'privacy',
    title: 'Privacyverklaring',
    body: [
      '## Wie we zijn',
      'Goed Geregeld Autoverhuur, Den Haag. [Aanvullen: volledige bedrijfsnaam, adres, KvK-nummer en e-mailadres voor privacyvragen.]',
      '',
      '## Welke gegevens we verwerken',
      'Als je een aanvraag doet, verwerken we de gekozen auto en periode, je naam en telefoonnummer, en als je die invult je e-mailadres en bericht.',
      '',
      '## Waarvoor',
      'We gebruiken deze gegevens alleen om je aanvraag te beantwoorden en, als je reserveert, om de huur af te handelen.',
      '',
      '## Hoe lang we gegevens bewaren',
      '[Aanvullen: bewaartermijn voor aanvragen en reserveringen.]',
      '',
      '## Cookies',
      'De website plaatst geen advertentie- of trackingcookies. Alleen de beheeromgeving gebruikt een noodzakelijke sessiecookie om ingelogde medewerkers te herkennen.',
      '',
      '## Je rechten',
      'Je kunt vragen welke gegevens we van je hebben, en die laten corrigeren of verwijderen. [Aanvullen: hoe je contact opneemt en het recht om een klacht in te dienen bij de Autoriteit Persoonsgegevens.]',
    ].join('\n'),
  },
  {
    slug: 'voorwaarden',
    title: 'Huurvoorwaarden',
    body: '[Door de eigenaar aan te leveren. Publiceer deze pagina pas als de voorwaarden zijn goedgekeurd.]',
  },
] as const
