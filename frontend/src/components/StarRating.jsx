/**
 * Star-based readout for the 1-5 call rating, shared by the grid, the call
 * history, and the My Calls view. The call-logging form reuses the bare
 * `Star` shape for its clickable input.
 */
import { isBlank } from '../lib/sites'

/** The accent green for filled stars; empty stars stay light grey. */
export const STAR_FILLED_CLASS = 'text-[#7AC143]'
export const STAR_EMPTY_CLASS = 'text-gray-300'

/** Heroicons solid star (20×20 viewBox). */
const STAR_PATH =
  'M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.' +
  '969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.92' +
  '1-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1' +
  '.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.363-1.118L2.98 8.72c-.783-.57-' +
  '.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z'

export function Star({ filled, className = 'h-4 w-4' }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      className={`${className} ${filled ? STAR_FILLED_CLASS : STAR_EMPTY_CLASS}`}
    >
      <path d={STAR_PATH} />
    </svg>
  )
}

const MAX_RATING = 5

/**
 * AG Grid React cell renderer: the rating as stars, or an empty cell.
 * Sized to fit the handoff's 62px Rating column.
 */
export function RatingCell(params) {
  if (isBlank(params.value)) return null
  return <StarRating value={params.value} starClassName="h-2.5 w-2.5" tight />
}

/** A row of five stars, the first `value` of them filled. */
export default function StarRating({ value, starClassName = 'h-4 w-4', tight }) {
  const rating = Number(value)

  return (
    <span
      role="img"
      aria-label={`Rated ${rating} out of ${MAX_RATING}`}
      className={`inline-flex items-center align-middle ${tight ? '' : 'gap-0.5'}`}
    >
      {Array.from({ length: MAX_RATING }, (_, index) => (
        <Star key={index} filled={index < rating} className={starClassName} />
      ))}
    </span>
  )
}
