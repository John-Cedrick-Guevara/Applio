/** Every country's English name, from the platform's own region list (ISO 3166), lowercase. */
const COUNTRIES: readonly string[] = (() => {
  const names = new Intl.DisplayNames(['en'], { type: 'region' });
  const letters = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
  const found = new Set<string>();
  for (const a of letters) for (const b of letters) {
    const name = names.of(a + b);
    // Unassigned codes come back as the code itself; skip pseudo-regions and groupings.
    if (name && name !== a + b && !/pseudo|unknown|union|nations|world|outlying|zone/i.test(name)) found.add(name.toLowerCase());
  }
  return [...found];
})();

/** Other spellings boards use, mapped to the platform's name. Case-sensitive ones avoid "us"/"uk" inside words. */
const ALIASES: [RegExp, string][] = [
  [/\bUS\b|\bU\.S\.?(?=\W|$)|\bUSA\b|\bunited states\b/i, 'united states'],
  [/\bUK\b|\bunited kingdom\b|\bengland\b|\bbritain\b/i, 'united kingdom'],
];

const APAC = ['philippines', 'singapore', 'malaysia', 'indonesia', 'thailand', 'vietnam', 'japan', 'south korea', 'china', 'hong kong sar china', 'taiwan', 'india', 'australia', 'new zealand', 'pakistan', 'bangladesh', 'sri lanka', 'nepal', 'cambodia', 'myanmar (burma)'];
const AMERICAS = ['united states', 'canada', 'mexico', 'brazil', 'argentina', 'colombia', 'chile', 'peru', 'uruguay', 'costa rica', 'ecuador', 'guatemala', 'venezuela', 'bolivia', 'paraguay', 'panama', 'dominican republic', 'puerto rico'];
const EUROPE = ['austria', 'belgium', 'bulgaria', 'croatia', 'cyprus', 'czechia', 'denmark', 'estonia', 'finland', 'france', 'germany', 'greece', 'hungary', 'ireland', 'italy', 'latvia', 'lithuania', 'luxembourg', 'malta', 'netherlands', 'poland', 'portugal', 'romania', 'slovakia', 'slovenia', 'spain', 'sweden', 'norway', 'iceland', 'switzerland', 'united kingdom', 'ukraine', 'serbia', 'albania', 'north macedonia', 'bosnia & herzegovina', 'montenegro', 'moldova', 'georgia', 'armenia', 'turkey'];

/** Regions boards name, with who's in them. `inside` decides membership for regions without a fixed list. */
const REGIONS: [RegExp, (country: string) => boolean][] = [
  [/\b(?:apac|asia[- ]?pacific|asia|south[- ]?east asia|oceania)\b/i, (c) => APAC.includes(c)],
  [/\bnorth america\b/i, (c) => ['united states', 'canada', 'mexico'].includes(c)],
  [/\b(?:americas?|latam|latin america|south america)\b/i, (c) => AMERICAS.includes(c)],
  [/\b(?:europe|eu|eea|european union)\b/i, (c) => EUROPE.includes(c)],
  [/\bemea\b/i, (c) => !APAC.includes(c) && !AMERICAS.includes(c)],
];

/** Regions too loose to rule anyone out ("Africa", "Middle East", "W Asia"): their mention keeps the job. */
const LOOSE = /\b(?:africa|middle east|w(?:est(?:ern)?)? asia|mena|gulf)\b/i;
const OPEN = /\b(?:worldwide|anywhere|global(?:ly)?|international|any country|all countries)\b/i;

/** The countries a text names, aliases resolved. */
function countriesIn(text: string): string[] {
  const lower = text.toLowerCase();
  const named = COUNTRIES.filter((c) => new RegExp(`\\b${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(lower));
  return [...new Set([...named, ...ALIASES.filter(([re]) => re.test(text)).map(([, c]) => c)])];
}

/** The operator's country from their profile location line ("Philippines • Open to Remote"), when one is named. */
export function homeCountry(location: string): string | undefined {
  return countriesIn(location)[0];
}

/**
 * Whether a text clearly limits a job to places that leave `country` out: it names
 * countries or regions, none of which include it. Worldwide wording, a loose region,
 * or naming nothing at all means "can't tell" (SPEC F3: drop only what we're sure about).
 * @returns `excludes`, `includes`, or `unknown`.
 */
export function eligibility(text: string, country: string): 'excludes' | 'includes' | 'unknown' {
  if (OPEN.test(text) || LOOSE.test(text)) return 'unknown';
  const countries = countriesIn(text);
  const regions = REGIONS.filter(([re]) => re.test(text));
  if (countries.length === 0 && regions.length === 0) return 'unknown';
  if (countries.includes(country) || regions.some(([, inside]) => inside(country))) return 'includes';
  return 'excludes';
}
