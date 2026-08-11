/**
 * How a site's contact prefers to be reached.
 *
 * Deliberately separate from the tracker's "Method of Ordering", which records
 * how the site places orders rather than how to reach the person about them -
 * a site that orders through a web portal may still only answer the phone.
 *
 * `value` matches `retention.models.ContactMethod`; keep the two in step.
 */
export const CONTACT_METHODS = [
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'text', label: 'Text message' },
  { value: 'in_person', label: 'In person' },
]

const BY_VALUE = new Map(CONTACT_METHODS.map((method) => [method.value, method]))

/** Label for a stored value, or '' when no preference has been recorded. */
export function contactMethodLabel(value) {
  return BY_VALUE.get(value)?.label ?? ''
}
