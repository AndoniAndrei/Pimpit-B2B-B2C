/**
 * Grupare a modelelor comerciale în FAMILII (serii): la BMW „530i" înseamnă
 * Seria 5 + motorul 3.0 — clientul alege întâi seria (cu șasiul afișat),
 * apoi opțional motorizarea. Pentru mărcile fără reguli, fiecare model rămâne
 * propria „familie", iar generația se afișează per model (vehicleGenerations).
 */
import { resolveGeneration, type GenerationInfo } from './vehicleGenerations';

export interface FamilyDef {
  makeSlug: string;
  key: string;          // valoare stabilă pentru URL: 'fam-seria-5'
  label: string;        // afișare: 'Seria 5'
  match: RegExp;        // testat pe slug-ul modelului comercial
  probeSlug: string;    // slug reprezentativ pentru resolveGeneration
}

const F = (makeSlug: string, key: string, label: string, match: RegExp, probeSlug: string): FamilyDef =>
  ({ makeSlug, key, label, match, probeSlug });

export const FAMILY_DEFS: FamilyDef[] = [
  // BMW — cifra din nume = seria; restul = motorizarea
  F('bmw', 'fam-seria-1', 'Seria 1', /^(1\d\d|1-series|m1[34]\d)/, '135i'),
  F('bmw', 'fam-seria-2', 'Seria 2', /^(2\d\d|2-series|m2$|m2\d\d)/, '230i'),
  F('bmw', 'fam-seria-3', 'Seria 3', /^(3\d\d|3-series|m3$)/, '330i'),
  F('bmw', 'fam-seria-4', 'Seria 4', /^(4\d\d|4-series|m4$)/, '430i'),
  F('bmw', 'fam-seria-5', 'Seria 5', /^(5\d\d|5-series|m5$)/, '530i'),
  F('bmw', 'fam-seria-6', 'Seria 6', /^(6\d\d|6-series|m6$)/, '650i'),
  F('bmw', 'fam-seria-7', 'Seria 7', /^(7\d\d|7-series)/, '750i'),
  F('bmw', 'fam-seria-8', 'Seria 8', /^(8\d\d|8-series|m8$)/, '840i'),
  F('bmw', 'fam-x1', 'X1', /^x1/, 'x1'), F('bmw', 'fam-x2', 'X2', /^x2/, 'x2'),
  F('bmw', 'fam-x3', 'X3', /^(x3|x3-m)/, 'x3'), F('bmw', 'fam-x4', 'X4', /^x4/, 'x4'),
  F('bmw', 'fam-x5', 'X5', /^(x5|x5-m)/, 'x5'), F('bmw', 'fam-x6', 'X6', /^x6/, 'x6'),
  F('bmw', 'fam-z3', 'Z3', /^z3/, 'z3'), F('bmw', 'fam-z4', 'Z4', /^z4/, 'z4'),

  // Mercedes — clasa = familia
  F('mercedes-benz', 'fam-clasa-a', 'Clasa A', /^a\d\d|^a-class/, 'a250'),
  F('mercedes-benz', 'fam-clasa-c', 'Clasa C', /^c\d\d|^c-class|^amg-c/, 'c300'),
  F('mercedes-benz', 'fam-clasa-e', 'Clasa E', /^e\d\d|^e-class|^amg-e/, 'e350'),
  F('mercedes-benz', 'fam-clasa-s', 'Clasa S', /^s\d\d|^s-class|^amg-s/, 's500'),
  F('mercedes-benz', 'fam-cla', 'CLA', /^cla/, 'cla250'),
  F('mercedes-benz', 'fam-cls', 'CLS', /^cls/, 'cls550'),
  F('mercedes-benz', 'fam-slk', 'SLK/SLC', /^sl[kc]/, 'slk350'),

  // Audi — litera+cifra = familia; motorizările (2.0T, 3.0T) sunt în trim
  F('audi', 'fam-a3', 'A3 / S3 / RS3', /^(a3|s3|rs3|rs-3)/, 'a3'),
  F('audi', 'fam-a4', 'A4 / S4 / RS4', /^(a4|s4|rs4|rs-4)/, 'a4'),
  F('audi', 'fam-a5', 'A5 / S5 / RS5', /^(a5|s5|rs5|rs-5)/, 'a5'),
  F('audi', 'fam-a6', 'A6 / S6 / RS6', /^(a6|s6|rs6|rs-6)/, 'a6'),
  F('audi', 'fam-a7', 'A7 / S7 / RS7', /^(a7|s7|rs7|rs-7)/, 'a7'),
  F('audi', 'fam-tt', 'TT / TTS / TT RS', /^tt/, 'tt'),

  // VW — Golf și derivatele lui sunt aceeași platformă
  F('volkswagen', 'fam-golf', 'Golf / GTI / Golf R', /^(golf|gti|rabbit)/, 'gti'),
  F('volkswagen', 'fam-jetta', 'Jetta / GLI', /^(jetta|gli)/, 'jetta'),
];

export interface FamilyGroup {
  key: string;
  label: string;
  generation: GenerationInfo | null;
  models: { slug: string; name: string }[];
}

export interface GroupedModels {
  families: FamilyGroup[];
  /** Modele care nu aparțin niciunei familii — afișate individual, cu generația lor. */
  singles: { slug: string; name: string; generation: GenerationInfo | null }[];
}

/** Grupează modelele unei mărci în familii; generația se rezolvă pe anul dat. */
export function groupModels(
  makeSlug: string,
  models: { slug: string; name: string }[],
  year: number
): GroupedModels {
  const defs = FAMILY_DEFS.filter(d => d.makeSlug === makeSlug.toLowerCase());
  const byKey = new Map<string, FamilyGroup>();
  const singles: GroupedModels['singles'] = [];

  for (const m of models) {
    const def = defs.find(d => d.match.test(m.slug.toLowerCase()));
    if (def) {
      let fam = byKey.get(def.key);
      if (!fam) {
        fam = {
          key: def.key,
          label: def.label,
          generation: resolveGeneration(makeSlug, def.probeSlug, year),
          models: [],
        };
        byKey.set(def.key, fam);
      }
      fam.models.push(m);
    } else {
      singles.push({ ...m, generation: resolveGeneration(makeSlug, m.slug, year) });
    }
  }

  for (const fam of Array.from(byKey.values())) {
    fam.models.sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  }
  return {
    families: Array.from(byKey.values()).sort((a, b) => a.label.localeCompare(b.label, 'ro')),
    singles: singles.sort((a, b) => a.name.localeCompare(b.name, 'ro')),
  };
}

/**
 * Rezolvă parametrul `model` din URL (slug simplu SAU cheie de familie
 * 'fam-…') la lista de slug-uri de modele comerciale acoperite.
 */
export function resolveModelParam(
  makeSlug: string,
  modelParam: string,
  allModels: { slug: string; name: string }[]
): { slugs: string[]; label: string; probeSlug: string } | null {
  if (modelParam.startsWith('fam-')) {
    const def = FAMILY_DEFS.find(d => d.makeSlug === makeSlug.toLowerCase() && d.key === modelParam);
    if (!def) return null;
    const slugs = allModels.filter(m => def.match.test(m.slug.toLowerCase())).map(m => m.slug);
    return slugs.length ? { slugs, label: def.label, probeSlug: def.probeSlug } : null;
  }
  const m = allModels.find(x => x.slug === modelParam);
  return m ? { slugs: [m.slug], label: m.name, probeSlug: m.slug } : null;
}
