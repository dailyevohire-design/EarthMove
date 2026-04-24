// Server + client safe. NEXT_PUBLIC_ prefix lets client components read it at
// build time. Default is false (OFF) — flipping requires both a Colorado- and
// a Texas-licensed attorney sign-off per docs/COLLECTIONS_LAUNCH_CHECKLIST.md.
export function isCollectionsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_COLLECTIONS_ENABLED === 'true'
}

export function assertCollectionsEnabled(): void {
  if (!isCollectionsEnabled()) throw new Error('COLLECTIONS_DISABLED')
}
