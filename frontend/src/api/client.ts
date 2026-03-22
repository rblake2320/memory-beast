const BASE_URL = ''  // Same origin; Vite proxies /api to :8100

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('mb_token')
  const apiKey = localStorage.getItem('mb_api_key')
  if (token) return { Authorization: `Bearer ${token}` }
  if (apiKey) return { 'X-API-Key': apiKey }
  return {}
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
      ...options.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw Object.assign(new Error(err.detail ?? 'Request failed'), { status: res.status, data: err })
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
