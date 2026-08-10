/**
 * Design tokens for the places that need a JavaScript value rather than a
 * Tailwind class: AG Grid's theming parameters and the map's marker elements.
 *
 * These mirror the `@theme` block in index.css — change both together.
 */
export const TOKENS = {
  tealHeader: '#1B3A4B',
  tealHairline: '#2F5568',
  tealDeep: '#12303E',
  accent: '#7AC143',
  accentHover: '#6BB033',

  white: '#FFFFFF',
  surface: '#F8F9FA',
  body: '#1E293B',
  muted: '#5A6B76',

  line: '#C9D1D7',
  lineLight: '#E1E5E8',
  rowDivider: '#EAEDEF',
  toolbarLine: '#D9DEE3',

  markerOrange: '#E8833A',
  markerGreen: '#7AC143',
  markerBlue: '#3B82F6',
  markerGrey: '#94A3B8',
}

export const FONT_STACK = '"Helvetica Neue", Helvetica, Arial, sans-serif'

/** Grid row heights for the two density options. */
export const ROW_HEIGHT = { compact: 26, comfortable: 32 }
export const HEADER_HEIGHT = 30
