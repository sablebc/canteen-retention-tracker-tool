/**
 * Thin fetch wrapper around the Django REST API.
 *
 * The base URL is resolved at runtime from the address the page was served
 * from, rather than baked in at build time. Vite inlines `import.meta.env`
 * values when the bundle is compiled, so a hardcoded host would have to be
 * correct before `npm run build` and would need a rebuild every time the
 * server's address changed — and a stale value points the browser at a machine
 * that isn't there, which surfaces only as an opaque "NetworkError".
 *
 * Deriving it from `window.location` means a page served from
 * http://192.168.2.17:5173 talks to http://192.168.2.17:8001/api without any
 * configuration at all. VITE_API_BASE_URL still overrides for the cases that
 * need it (a backend on another machine, or behind a reverse proxy).
 */

/** The port Django is served on, matching BACKEND_PORT in the compose file. */
const DEFAULT_BACKEND_PORT = '8001'

/** Used only where there is no browser to ask, e.g. a test environment. */
const FALLBACK_API_BASE_URL = `http://localhost:${DEFAULT_BACKEND_PORT}/api`

function resolveApiBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL
  if (configured) return configured

  if (typeof window === 'undefined') return FALLBACK_API_BASE_URL

  const port = import.meta.env.VITE_API_PORT || DEFAULT_BACKEND_PORT
  const { protocol, hostname } = window.location
  return `${protocol}//${hostname}:${port}/api`
}

export const API_BASE_URL = resolveApiBaseUrl()

/**
 * Turn a DRF error body into one readable line.
 *
 * DRF reports validation failures as `{field: [message, ...]}`, which stringifies
 * to "[object Object]" if passed straight to an Error. Without this the panel
 * would tell the user "Request failed with status 400" and nothing more.
 */
function describeErrorBody(body, status) {
  if (!body) return `status ${status}`
  if (typeof body === 'string') return body
  if (typeof body.detail === 'string') return body.detail

  const parts = Object.entries(body).map(([field, messages]) => {
    const text = Array.isArray(messages) ? messages.join(' ') : String(messages)
    return `${field}: ${text}`
  })

  return parts.length > 0 ? parts.join('; ') : `status ${status}`
}

/**
 * Perform a request against the API and return the parsed JSON body.
 *
 * @param {string} path Path relative to the API base, e.g. '/retention/sites/'.
 * @param {RequestInit} [options] Extra fetch options.
 * @returns {Promise<unknown>} The decoded response body.
 * @throws {Error} If the network call fails or the response is not 2xx.
 */
async function request(path, options = {}) {
  const url = `${API_BASE_URL}${path}`
  // FormData carries its own multipart content type, including the boundary
  // the browser generates; setting the header by hand would corrupt it.
  const isFormData = options.body instanceof FormData

  let response
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body && !isFormData
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...options.headers,
      },
    })
  } catch (cause) {
    throw new Error(`Network request to ${url} failed: ${cause.message}`, {
      cause,
    })
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(describeErrorBody(body, response.status))
  }

  return response.json()
}

/** Fetch every tracked site. */
export function getSites() {
  return request('/retention/sites/')
}

/** Fetch every call record. */
export function getCalls() {
  return request('/retention/calls/')
}

/** Fetch one site's call records, newest first. */
export function getCallsForSite(siteId) {
  return request(`/retention/calls/?site=${encodeURIComponent(siteId)}`)
}

/**
 * Apply a partial update to a site.
 *
 * Only method_of_ordering, contact_name, lob, and phone_number are accepted;
 * the API rejects the whole request if it carries anything else.
 *
 * @returns {Promise<object>} The updated site, in the list endpoint's shape.
 */
export function patchSite(siteId, changes) {
  return request(`/retention/sites/${encodeURIComponent(siteId)}/`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  })
}

/** Create a call record and return it. */
export function createCall(call) {
  return request('/retention/calls/', {
    method: 'POST',
    body: JSON.stringify(call),
  })
}

/** Fetch the revenue-risk scores. */
export function getRevenueRisk() {
  return request('/analysis/revenue-risk-score/')
}

/** Fetch the tracker import history, newest first. */
export function getImportLogs() {
  return request('/retention/imports/')
}

/**
 * Upload a tracker .xlsx and re-run the ingest over it.
 *
 * Sent as multipart form data, so `Content-Type` is deliberately left unset:
 * the browser has to supply it along with the multipart boundary.
 *
 * @param {File} file The .xlsx export chosen by the user.
 * @returns {Promise<object>} The ingest summary.
 */
export function importTracker(file) {
  const body = new FormData()
  body.append('file', file)
  return request('/retention/import/', { method: 'POST', body })
}
