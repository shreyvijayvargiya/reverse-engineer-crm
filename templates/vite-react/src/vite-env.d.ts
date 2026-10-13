/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** When set, service stubs call `${VITE_API_BASE_URL}/<tool>/<method>` instead of returning mock data. */
  readonly VITE_API_BASE_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
