/**
 * Thin fetch wrapper around the Django REST API.
 *
 * The base URL is configurable per environment via VITE_API_BASE_URL so the
 * same build can point at local, staging, or production backends.
 */

const DEFAULT_API_BASE_URL = 'http://localhost:8000/api'

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL

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

  let response
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
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
