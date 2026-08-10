/**
 * Badge styling per normalised account status.
 *
 * The tracker's statuses are not all equal in tone — an "Inactive" site
 * should not wear the same colour as an "Active" one — so each gets its own
 * pair, with a neutral fallback for anything new the export starts using.
 */
const STATUS_STYLES = {
  Active: 'bg-[#C6E7C8] text-[#12303E]',
  Inactive: 'bg-[#FFCCD2] text-[#12303E]',
  Potential: 'bg-[#FEFF85] text-[#12303E]',
  'Undeployed/Removed': 'bg-[#D6DCE4] text-[#12303E]',
  Unknown: 'bg-surface text-muted',
}

export function statusClasses(status) {
  return STATUS_STYLES[status] ?? STATUS_STYLES.Unknown
}
