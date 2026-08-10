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
 * Perform a GET against the API and return the parsed JSON body.
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
      headers: { Accept: 'application/json' },
      ...options,
    })
  } catch (cause) {
    throw new Error(`Network request to ${url} failed: ${cause.message}`, {
      cause,
    })
  }

  if (!response.ok) {
    throw new Error(`Request to ${url} failed with status ${response.status}`)
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

/** Fetch the revenue-risk scores. */
export function getRevenueRisk() {
  return request('/analysis/revenue-risk-score/')
}
