export interface VehicleModelAlias {
  makeSlug: string;
  slug: string;
  alsoMatches?: string[];
  name: string;
  modelSlugs: string[];
  yearFrom?: number;
  yearTo?: number;
  pcds?: string[];
  note?: string;
}

export const VEHICLE_MODEL_ALIASES: VehicleModelAlias[] = [
  {
    makeSlug: 'bmw',
    slug: 'e60',
    alsoMatches: ['e61', 'e60-e61', '5-series-e60', '5-series-e61'],
    name: 'E60/E61 5 Series (2004-2010)',
    modelSlugs: [
      '5-series',
      '525i',
      '525xi',
      '528i',
      '528i-xdrive',
      '528xi',
      '530i',
      '530xi',
      '535i',
      '535i-xdrive',
      '535xi',
      '540i',
      '545i',
      '550i',
      'm5',
    ],
    yearFrom: 2004,
    yearTo: 2010,
    pcds: ['5X120'],
    note: 'Alias de sasiu peste modelele comerciale din galeria Fitment Industries.',
  },
];

export function getAliasesForMake(makeSlug: string): VehicleModelAlias[] {
  const needle = makeSlug.toLowerCase();
  return VEHICLE_MODEL_ALIASES.filter(alias => alias.makeSlug === needle);
}

export function getModelAlias(makeSlug: string, modelSlug: string): VehicleModelAlias | null {
  const needle = modelSlug.toLowerCase();
  return getAliasesForMake(makeSlug).find(alias =>
    alias.slug === needle || (alias.alsoMatches ?? []).includes(needle)
  ) ?? null;
}
