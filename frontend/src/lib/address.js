/**
 * Derive City and Province from a tracker address string.
 *
 * The Site model stores the address as one free-text field, so the grid's
 * City and Prov. columns have to be read back out of it. The tracker's rows
 * are mostly "<street> <city> <PROV>[, <postal>]", which this walks backwards:
 * find the last province code, then collect the words before it until a
 * street-type token, a number, or a direction stops the walk.
 *
 * Roughly 99% of the current export resolves; the rest (addresses with no
 * province, or a city written after the postal code) yield empty strings,
 * which render as blank cells rather than a wrong guess.
 */

const PROVINCES = new Set([
  'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT',
])

/** Tokens that mean the walk-back has re-entered the street portion. */
const STREET_TOKENS = new Set([
  'RD', 'ST', 'AVE', 'AV', 'DR', 'BLVD', 'CRES', 'WAY', 'HWY', 'HIGHWAY', 'PVT',
  'CRT', 'CT', 'PL', 'LN', 'TRAIL', 'TRL', 'PKWY', 'PARKWAY', 'ROAD', 'STREET',
  'AVENUE', 'DRIVE', 'CIR', 'CIRCLE', 'SQ', 'TERR', 'LINE', 'RR', 'BOX',
  'UNIT', 'STE', 'SUITE', 'FL', 'FLOOR', 'BU', 'C/O',
])

const DIRECTIONS = new Set(['N', 'S', 'E', 'W', 'NW', 'NE', 'SW', 'SE'])

/** Longest city name the walk-back will accept, e.g. "WEST VANCOUVER". */
const MAX_CITY_WORDS = 3

/** Strip punctuation so "AVE." matches the "AVE" street token. */
function normalizeToken(token) {
  return token.toUpperCase().replace(/[^A-Z/]/g, '')
}

/**
 * @param {string} address Raw `Site.address` text.
 * @returns {{city: string, province: string}} Empty strings when unparseable.
 */
export function splitCityProvince(address) {
  const empty = { city: '', province: '' }
  if (!address) return empty

  const tokens = String(address).replace(/\s+/g, ' ').trim().split(/[\s,]+/)
  if (tokens.length < 2) return empty

  let provinceIndex = -1
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    if (PROVINCES.has(normalizeToken(tokens[index]))) {
      provinceIndex = index
      break
    }
  }
  // Index 0 would mean the address begins with a province code, which is a
  // malformed row rather than a city we can name.
  if (provinceIndex <= 0) return empty

  const cityWords = []
  for (
    let index = provinceIndex - 1;
    index >= 0 && cityWords.length < MAX_CITY_WORDS;
    index -= 1
  ) {
    const word = tokens[index]
    if (/\d/.test(word)) break

    const normalized = normalizeToken(word)
    if (STREET_TOKENS.has(normalized) || DIRECTIONS.has(normalized)) break

    cityWords.unshift(word)
  }

  return { city: cityWords.join(' '), province: normalizeToken(tokens[provinceIndex]) }
}
