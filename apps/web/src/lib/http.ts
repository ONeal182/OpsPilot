import axios from 'axios'

/**
 * Shared axios instance.
 *
 * The base URL is the relative `/api` path so the same code works in every
 * context: in the browser and inside the `web` container the request is served
 * by the Vite dev-server proxy (see `vite.config.ts` -> `server.proxy`), which
 * forwards `/api/*` to the Laravel API (`http://nginx:80` in the container,
 * `http://localhost:8080` on the host).
 */
export const http = axios.create({
  baseURL: '/api',
  headers: { Accept: 'application/json' },
})

export default http
