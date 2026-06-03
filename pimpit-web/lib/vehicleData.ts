/**
 * Static vehicle catalog for the homepage / fitment-checker selector.
 *
 * Pimpit's product schema is part-number based (no vehicle FK), so the
 * selector is currently UI-only — submitting redirects to /jante with the
 * selection captured in the `?vehicle=` query for future fitment lookups.
 */

const CURRENT_YEAR = new Date().getFullYear() + 1

export const YEARS = Array.from({ length: 36 }, (_, i) => CURRENT_YEAR - i)

export const VEHICLE_MAKES: Record<string, string[]> = {
  'Alfa Romeo': ['147', '156', '159', 'Giulia', 'Giulietta', 'Stelvio'],
  Audi: ['A1', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'Q3', 'Q5', 'Q7', 'Q8', 'RS3', 'RS6', 'TT'],
  BMW: ['Seria 1', 'Seria 2', 'Seria 3', 'Seria 4', 'Seria 5', 'Seria 6', 'Seria 7', 'X1', 'X3', 'X5', 'X6', 'M3', 'M4', 'M5'],
  Citroen: ['C3', 'C4', 'C5', 'DS3', 'DS4', 'DS5'],
  Dacia: ['Duster', 'Logan', 'Sandero', 'Spring', 'Jogger'],
  Fiat: ['500', '500X', 'Bravo', 'Panda', 'Tipo'],
  Ford: ['Fiesta', 'Focus', 'Mondeo', 'Kuga', 'Puma', 'Mustang'],
  Honda: ['Civic', 'CR-V', 'HR-V', 'Jazz', 'NSX'],
  Hyundai: ['i10', 'i20', 'i30', 'Tucson', 'Kona', 'Santa Fe'],
  Kia: ['Picanto', 'Rio', 'Ceed', 'Sportage', 'Sorento', 'Stinger'],
  Mazda: ['2', '3', '6', 'CX-3', 'CX-5', 'MX-5'],
  'Mercedes-Benz': ['Clasa A', 'Clasa B', 'Clasa C', 'Clasa E', 'Clasa S', 'GLA', 'GLC', 'GLE', 'AMG GT'],
  Mini: ['Cooper', 'Countryman', 'Clubman'],
  Nissan: ['Juke', 'Qashqai', 'X-Trail', 'GT-R', '370Z'],
  Opel: ['Astra', 'Corsa', 'Insignia', 'Mokka', 'Grandland'],
  Peugeot: ['208', '308', '508', '2008', '3008', '5008'],
  Porsche: ['911', 'Cayenne', 'Macan', 'Panamera', 'Taycan'],
  Renault: ['Clio', 'Megane', 'Captur', 'Kadjar', 'Talisman'],
  Seat: ['Ibiza', 'Leon', 'Arona', 'Ateca', 'Tarraco'],
  Skoda: ['Fabia', 'Octavia', 'Superb', 'Karoq', 'Kodiaq'],
  Subaru: ['Impreza', 'Forester', 'Outback', 'WRX', 'BRZ'],
  Suzuki: ['Swift', 'Vitara', 'S-Cross', 'Jimny'],
  Tesla: ['Model 3', 'Model S', 'Model X', 'Model Y'],
  Toyota: ['Yaris', 'Corolla', 'C-HR', 'RAV4', 'Supra', 'GR86'],
  Volkswagen: ['Polo', 'Golf', 'Passat', 'Tiguan', 'Touareg', 'T-Roc', 'Arteon'],
  Volvo: ['XC40', 'XC60', 'XC90', 'S60', 'V60'],
}

export const MAKE_NAMES = Object.keys(VEHICLE_MAKES).sort()
