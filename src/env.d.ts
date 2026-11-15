interface ImportMetaEnv {
  /** The `version` field of package.json, set in vite.config.ts. */
  readonly VITE_APP_VERSION: string
  /** The day this build was made, as YYYY-MM-DD in China time. */
  readonly VITE_BUILD_DATE: string
}
