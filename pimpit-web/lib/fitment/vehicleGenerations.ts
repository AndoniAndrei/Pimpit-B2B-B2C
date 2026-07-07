/**
 * Dicționar de generații (șasiuri) pentru modelele cu risc de confuzie:
 * galeria de fitmenturi folosește nume COMERCIALE (ex. "530i", "5 Series"),
 * iar aceeași denumire acoperă generații cu prinderi (PCD) diferite.
 * Anul de fabricație este discriminatorul: (marcă, model, an) → generație.
 *
 * Reguli:
 *  - Anii sunt ani-model piața US (sursa galeriei) — granițele pot varia ±1 an.
 *  - `pcd`/`centerBore` sunt setate DOAR când sunt uniforme pe toată generația
 *    și toate versiunile; cazurile mixte au pcd omis + `note` explicativ.
 *  - Matching pe slug-ul de model (lowercase, cu cratime), prin regex.
 */

export interface GenerationInfo {
  code: string;          // ex. 'E60/E61'
  yearFrom: number;
  yearTo?: number;       // absent = până în prezent
  pcd?: string;          // ex. '5X120' — doar dacă e cert uniform
  centerBore?: number;   // mm
  note?: string;
}

interface GenerationRule extends GenerationInfo {
  makeSlug: string;
  /** Testat pe slug-ul modelului (ex. '328i-xdrive', '5-series', 'm3'). */
  match: RegExp;
}

const R = (makeSlug: string, match: RegExp, rules: GenerationInfo[]): GenerationRule[] =>
  rules.map(g => ({ makeSlug, match, ...g }));

export const GENERATION_RULES: GenerationRule[] = [
  // ── BMW ────────────────────────────────────────────────────────────────────
  // Seria 3 / 4 (nume comerciale: 318i…340i, 3-series, 4xx, M3, M4)
  ...R('bmw', /^(3\d\d|3-series|m3$)/, [
    { code: 'E30', yearFrom: 1982, yearTo: 1993, pcd: '4X100', centerBore: 57.1 },
    { code: 'E36', yearFrom: 1992, yearTo: 1999, pcd: '5X120', centerBore: 72.6 },
    { code: 'E46', yearFrom: 1999, yearTo: 2006, pcd: '5X120', centerBore: 72.6 },
    { code: 'E90/E91/E92/E93', yearFrom: 2005, yearTo: 2013, pcd: '5X120', centerBore: 72.6 },
    { code: 'F30/F31/F80', yearFrom: 2012, yearTo: 2019, pcd: '5X120', centerBore: 72.6 },
    { code: 'G20/G80', yearFrom: 2019, pcd: '5X112', centerBore: 66.6 },
  ]),
  ...R('bmw', /^(4\d\d|4-series|m4$)/, [
    { code: 'F32/F33/F36/F82', yearFrom: 2014, yearTo: 2020, pcd: '5X120', centerBore: 72.6 },
    { code: 'G22/G23/G26/G82', yearFrom: 2021, pcd: '5X112', centerBore: 66.6 },
  ]),
  // Seria 5 (525i…550i, 5-series, M5)
  ...R('bmw', /^(5\d\d|5-series|m5$)/, [
    { code: 'E28', yearFrom: 1982, yearTo: 1988, pcd: '5X120', centerBore: 72.6 },
    { code: 'E34', yearFrom: 1989, yearTo: 1995, pcd: '5X120', centerBore: 72.6 },
    { code: 'E39', yearFrom: 1996, yearTo: 2003, pcd: '5X120', centerBore: 74.1,
      note: 'E39 are alezaj 74.1 — diferit de restul BMW 5X120 (72.6)' },
    { code: 'E60/E61', yearFrom: 2004, yearTo: 2010, pcd: '5X120', centerBore: 72.6 },
    { code: 'F10/F11', yearFrom: 2011, yearTo: 2016, pcd: '5X120', centerBore: 72.6 },
    { code: 'G30/G31', yearFrom: 2017, yearTo: 2023, pcd: '5X112', centerBore: 66.6 },
    { code: 'G60', yearFrom: 2024, pcd: '5X112', centerBore: 66.6 },
  ]),
  // Seria 1 / 2 (128i, 135i, M235i, M2…)
  ...R('bmw', /^(1\d\d|1-series|m1\d\d)/, [
    { code: 'E82/E88', yearFrom: 2008, yearTo: 2013, pcd: '5X120', centerBore: 72.6 },
  ]),
  ...R('bmw', /^(2\d\d|2-series|m2\d\d|m2$)/, [
    { code: 'F22/F23/F87', yearFrom: 2014, yearTo: 2021, pcd: '5X120', centerBore: 72.6 },
    { code: 'G42/G87', yearFrom: 2022, pcd: '5X112', centerBore: 66.6 },
  ]),
  ...R('bmw', /^z3/, [{ code: 'Z3', yearFrom: 1996, yearTo: 2002, pcd: '5X120', centerBore: 72.6 }]),
  ...R('bmw', /^z4/, [
    { code: 'E85/E86', yearFrom: 2003, yearTo: 2008, pcd: '5X120', centerBore: 72.6 },
    { code: 'E89', yearFrom: 2009, yearTo: 2016, pcd: '5X120', centerBore: 72.6 },
    { code: 'G29', yearFrom: 2019, pcd: '5X112', centerBore: 66.6 },
  ]),

  // ── Volkswagen (Golf/GTI/Rabbit/Jetta: 4X100 → 5X100 → 5X112) ─────────────
  ...R('volkswagen', /^(golf|gti|rabbit|golf-r)/, [
    { code: 'Mk1', yearFrom: 1975, yearTo: 1984, pcd: '4X100', centerBore: 57.1 },
    { code: 'Mk2', yearFrom: 1985, yearTo: 1992, pcd: '4X100', centerBore: 57.1 },
    { code: 'Mk3', yearFrom: 1993, yearTo: 1998, pcd: '4X100', centerBore: 57.1 },
    { code: 'Mk4', yearFrom: 1999, yearTo: 2005, pcd: '5X100', centerBore: 57.1 },
    { code: 'Mk5', yearFrom: 2006, yearTo: 2009, pcd: '5X112', centerBore: 57.1 },
    { code: 'Mk6', yearFrom: 2010, yearTo: 2014, pcd: '5X112', centerBore: 57.1 },
    { code: 'Mk7', yearFrom: 2015, yearTo: 2021, pcd: '5X112', centerBore: 57.1 },
    { code: 'Mk8', yearFrom: 2022, pcd: '5X112', centerBore: 57.1 },
  ]),
  ...R('volkswagen', /^jetta/, [
    { code: 'Mk2', yearFrom: 1985, yearTo: 1992, pcd: '4X100', centerBore: 57.1 },
    { code: 'Mk3', yearFrom: 1993, yearTo: 1998, pcd: '4X100', centerBore: 57.1 },
    { code: 'Mk4', yearFrom: 1999, yearTo: 2005, pcd: '5X100', centerBore: 57.1 },
    { code: 'Mk5', yearFrom: 2006, yearTo: 2010, pcd: '5X112', centerBore: 57.1 },
    { code: 'Mk6', yearFrom: 2011, yearTo: 2018, pcd: '5X112', centerBore: 57.1 },
    { code: 'Mk7', yearFrom: 2019, pcd: '5X112', centerBore: 57.1 },
  ]),
  ...R('volkswagen', /^(passat|cc|arteon|scirocco|tiguan|eos)/, [
    { code: 'platformă VW modernă', yearFrom: 1998, pcd: '5X112', centerBore: 57.1 },
  ]),
  ...R('volkswagen', /^(beetle|new-beetle)/, [
    { code: 'New Beetle', yearFrom: 1998, yearTo: 2010, pcd: '5X100', centerBore: 57.1 },
    { code: 'Beetle A5', yearFrom: 2012, yearTo: 2019, pcd: '5X112', centerBore: 57.1 },
  ]),

  // ── Audi (aproape tot 5X112; excepția clasică: TT Mk1 = 5X100) ────────────
  ...R('audi', /^tt/, [
    { code: 'TT Mk1 (8N)', yearFrom: 2000, yearTo: 2006, pcd: '5X100', centerBore: 57.1,
      note: 'TT Mk1 e 5X100 — NU 5X112 ca restul gamei Audi' },
    { code: 'TT Mk2+ (8J/8S)', yearFrom: 2008, pcd: '5X112', centerBore: 57.1 },
  ]),
  ...R('audi', /^(a[3-8]|s[3-8]|rs|q[3578]|allroad)/, [
    { code: 'platformă Audi modernă', yearFrom: 1996, pcd: '5X112', centerBore: 57.1 },
  ]),

  // ── Honda ──────────────────────────────────────────────────────────────────
  ...R('honda', /^civic/, [
    { code: 'gen 3–7 (EA…EM/EP)', yearFrom: 1984, yearTo: 2005, pcd: '4X100', centerBore: 56.1,
      note: 'Excepție: Civic Si EP3 (2002–2005) e 5X114.3' },
    { code: 'gen 8+ (FG/FB/FC/FE)', yearFrom: 2006, pcd: '5X114.3', centerBore: 64.1,
      note: 'Excepție: Type R FK8/FL5 e 5X120' },
  ]),
  ...R('honda', /^accord/, [
    { code: 'gen 3–5', yearFrom: 1986, yearTo: 1997, pcd: '4X114.3', centerBore: 64.1 },
    { code: 'gen 6', yearFrom: 1998, yearTo: 2002, centerBore: 64.1,
      note: '4 cil. = 4X114.3, V6 = 5X114.3 — verifică versiunea' },
    { code: 'gen 7+', yearFrom: 2003, pcd: '5X114.3', centerBore: 64.1 },
  ]),
  ...R('honda', /^s2000/, [{ code: 'AP1/AP2', yearFrom: 2000, yearTo: 2009, pcd: '5X114.3', centerBore: 64.1 }]),

  // ── Subaru (5X100 → 5X114.3) ───────────────────────────────────────────────
  ...R('subaru', /^wrx-sti|^sti/, [
    { code: 'GD (blobeye/hawkeye)', yearFrom: 2004, yearTo: 2004, pcd: '5X100', centerBore: 56.1 },
    { code: 'GD/GR/GV/VA', yearFrom: 2005, yearTo: 2021, pcd: '5X114.3', centerBore: 56.1 },
  ]),
  ...R('subaru', /^wrx$/, [
    { code: 'GD/GR/GV', yearFrom: 2002, yearTo: 2014, pcd: '5X100', centerBore: 56.1 },
    { code: 'VA/VB', yearFrom: 2015, pcd: '5X114.3', centerBore: 56.1 },
  ]),
  ...R('subaru', /^impreza/, [
    { code: 'GC-GJ', yearFrom: 1993, yearTo: 2016, pcd: '5X100', centerBore: 56.1 },
    { code: 'GK/GT+', yearFrom: 2017, pcd: '5X114.3', centerBore: 56.1 },
  ]),
  ...R('subaru', /^brz/, [
    { code: 'ZC6/ZD8', yearFrom: 2012, pcd: '5X100', centerBore: 56.1 },
  ]),

  // ── Ford ───────────────────────────────────────────────────────────────────
  ...R('ford', /^mustang/, [
    { code: 'Fox body', yearFrom: 1979, yearTo: 1993, pcd: '4X108', centerBore: 63.4 },
    { code: 'SN95/S197/S550/S650', yearFrom: 1994, pcd: '5X114.3', centerBore: 70.5 },
  ]),
  ...R('ford', /^focus/, [
    { code: 'Mk1/Mk2 (US)', yearFrom: 2000, yearTo: 2011, pcd: '4X108', centerBore: 63.4,
      note: 'Excepție: Focus ST/SVT pot fi 5X108' },
    { code: 'Mk3 (ST/RS incluse)', yearFrom: 2012, pcd: '5X108', centerBore: 63.4 },
  ]),
  ...R('ford', /^fiesta/, [
    { code: 'Mk6/Mk7 (US)', yearFrom: 2011, pcd: '4X108', centerBore: 63.4,
      note: 'Excepție: Fiesta ST200/Mk8 pot diferi' },
  ]),

  // ── Toyota ─────────────────────────────────────────────────────────────────
  ...R('toyota', /^corolla/, [
    { code: 'gen ≤8', yearFrom: 1980, yearTo: 2002, pcd: '4X100', centerBore: 54.1 },
    { code: 'gen 9–11', yearFrom: 2003, yearTo: 2019, pcd: '5X100', centerBore: 54.1 },
    { code: 'gen 12 (E210)', yearFrom: 2020, centerBore: 54.1,
      note: 'Sedan 5X100, hatchback/GR 5X114.3 — verifică caroseria' },
  ]),
  ...R('toyota', /^camry/, [
    { code: 'XV10+', yearFrom: 1992, pcd: '5X114.3', centerBore: 60.1 },
  ]),
  ...R('toyota', /^supra/, [
    { code: 'A70/A80', yearFrom: 1986, yearTo: 1998, pcd: '5X114.3', centerBore: 60.1 },
    { code: 'A90/A91 (GR)', yearFrom: 2020, pcd: '5X112', centerBore: 66.6,
      note: 'GR Supra e pe platformă BMW — 5X112' },
  ]),
  ...R('toyota', /^(gr86|86)$/, [
    { code: 'ZN6/ZN8', yearFrom: 2013, pcd: '5X100', centerBore: 56.1 },
  ]),

  // ── Mazda ──────────────────────────────────────────────────────────────────
  ...R('mazda', /^(mx-5|miata|mx-5-miata)/, [
    { code: 'NA/NB', yearFrom: 1989, yearTo: 2005, pcd: '4X100', centerBore: 54.1 },
    { code: 'NC', yearFrom: 2006, yearTo: 2015, pcd: '5X114.3', centerBore: 67.1,
      note: 'NC e singura generație Miata pe 5X114.3' },
    { code: 'ND', yearFrom: 2016, pcd: '4X100', centerBore: 54.1,
      note: 'ND revine la 4X100 — nu folosi jante de NC' },
  ]),
  ...R('mazda', /^3$|^mazda3|^mazdaspeed3/, [
    { code: 'BK/BL/BM/BP', yearFrom: 2004, pcd: '5X114.3', centerBore: 67.1 },
  ]),
  ...R('mazda', /^6$|^mazda6/, [
    { code: 'GG/GH/GJ', yearFrom: 2003, pcd: '5X114.3', centerBore: 67.1 },
  ]),
  ...R('mazda', /^rx-8/, [{ code: 'SE3P', yearFrom: 2004, yearTo: 2011, pcd: '5X114.3', centerBore: 67.1 }]),

  // ── Nissan / Infiniti ─────────────────────────────────────────────────────
  ...R('nissan', /^(350z|370z|z$)/, [
    { code: 'Z33/Z34/RZ34', yearFrom: 2003, pcd: '5X114.3', centerBore: 66.1 },
  ]),
  ...R('nissan', /^gt-r/, [{ code: 'R35', yearFrom: 2009, pcd: '5X114.3', centerBore: 66.1 }]),
  ...R('nissan', /^240sx/, [
    { code: 'S13', yearFrom: 1989, yearTo: 1994, pcd: '4X114.3', centerBore: 66.1,
      note: 'Multe S13 sunt convertite la 5X114.3 (conversie populară)' },
    { code: 'S14', yearFrom: 1995, yearTo: 1998, centerBore: 66.1,
      note: 'S14 poate fi 4X114.3 sau 5X114.3 în funcție de versiune' },
  ]),
  ...R('infiniti', /^g3[57]|^q[56]0/, [
    { code: 'V35/V36/V37', yearFrom: 2003, pcd: '5X114.3', centerBore: 66.1 },
  ]),

  // ── Mitsubishi ────────────────────────────────────────────────────────────
  ...R('mitsubishi', /^lancer-evolution|^evo/, [
    { code: 'Evo VIII–X', yearFrom: 2003, yearTo: 2015, pcd: '5X114.3', centerBore: 67.1 },
  ]),
  ...R('mitsubishi', /^lancer$/, [
    { code: 'CS/CT (non-Evo)', yearFrom: 2002, yearTo: 2007, pcd: '4X114.3', centerBore: 67.1 },
    { code: 'CY/CZ', yearFrom: 2008, yearTo: 2017, pcd: '5X114.3', centerBore: 67.1 },
  ]),

  // ── MINI (R-series 4X100 → F-series 5X112!) ───────────────────────────────
  ...R('mini', /^cooper|^clubman|^countryman/, [
    { code: 'R50/R53/R56 (gen 1–2)', yearFrom: 2002, yearTo: 2013, pcd: '4X100', centerBore: 56.1 },
    { code: 'F55/F56+ (gen 3)', yearFrom: 2014, pcd: '5X112', centerBore: 66.6,
      note: 'Gen 3 trece la 5X112 — jantele de gen 1–2 NU se potrivesc' },
  ]),

  // ── Lexus / Acura / Chevrolet ─────────────────────────────────────────────
  ...R('lexus', /^is[23]\d\d|^is-|^gs|^rc/, [
    { code: 'XE10+', yearFrom: 1999, pcd: '5X114.3', centerBore: 60.1 },
  ]),
  ...R('acura', /^(tl|tsx|rsx|ilx|tlx)/, [
    { code: 'platformă Honda 5 prezoane', yearFrom: 1999, pcd: '5X114.3', centerBore: 64.1 },
  ]),
  ...R('acura', /^integra/, [
    { code: 'DA/DC2', yearFrom: 1986, yearTo: 2001, pcd: '4X100', centerBore: 56.1,
      note: 'Excepție: Integra Type R (98+) e 5X114.3' },
    { code: 'DE4 (2023+)', yearFrom: 2023, pcd: '5X114.3', centerBore: 64.1 },
  ]),
  ...R('chevrolet', /^camaro/, [
    { code: 'gen 1–4', yearFrom: 1967, yearTo: 2002, pcd: '5X120.65', centerBore: 70.3 },
    { code: 'gen 5–6', yearFrom: 2010, pcd: '5X120', centerBore: 66.9 },
  ]),
  ...R('chevrolet', /^corvette/, [
    { code: 'C4–C7', yearFrom: 1984, yearTo: 2019, pcd: '5X120.65', centerBore: 70.3 },
    { code: 'C8', yearFrom: 2020, pcd: '5X120', centerBore: 70.3 },
  ]),

  // ── Mercedes-Benz (uniform 5X112 din anii '90 încoace) ────────────────────
  ...R('mercedes-benz', /^(c|e|s|cla|cls|gla|glc|glk|slk|sl|a)/, [
    { code: 'platformă Mercedes modernă', yearFrom: 1994, pcd: '5X112', centerBore: 66.6 },
  ]),
];

/**
 * Rezolvă generația pentru (marcă, model, an). Returnează null când nu avem
 * date — apelantul afișează doar rezultatele filtrate pe an, fără badge.
 */
export function resolveGeneration(
  makeSlug: string,
  modelSlug: string,
  year: number
): GenerationInfo | null {
  const mk = makeSlug.toLowerCase();
  const md = modelSlug.toLowerCase();
  for (const rule of GENERATION_RULES) {
    if (rule.makeSlug !== mk) continue;
    if (!rule.match.test(md)) continue;
    if (year < rule.yearFrom) continue;
    if (rule.yearTo !== undefined && year > rule.yearTo) continue;
    const { makeSlug: _mk, match: _m, ...info } = rule;
    return info;
  }
  return null;
}
