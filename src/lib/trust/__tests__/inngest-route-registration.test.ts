import { describe, it, expect } from 'vitest'
import * as inngestModule from '../inngest-functions'
import { inngestFunctions } from '@/lib/inngest-functions-registry'

// Inngest's SDK doesn't export the InngestFunction class symbol, so this test
// ducktypes via the runtime constructor name. Verified against the SDK in use:
// every value returned by `inngest.createFunction(...)` has a prototype whose
// constructor is named "InngestFunction".
function isInngestFunction(x: unknown): x is { id: () => string } {
  return (
    typeof x === 'object'
    && x !== null
    && Object.getPrototypeOf(x)?.constructor?.name === 'InngestFunction'
  )
}

describe('Inngest serve route function registration', () => {
  it('every exported Inngest function in inngest-functions.ts is registered in the route', () => {
    const exportedFns = Object.entries(inngestModule)
      .filter(([, v]) => isInngestFunction(v))
      .map(([name, v]) => ({ name, fn: v as { id: () => string } }))

    // Sanity: there's at least one Inngest function in the module. If this
    // ever falls to zero, the ducktype broke after an SDK upgrade.
    expect(exportedFns.length).toBeGreaterThan(0)

    const registeredIds = new Set(
      inngestFunctions.map((f) => (f as { id: () => string }).id()),
    )

    const missing = exportedFns.filter(({ fn }) => !registeredIds.has(fn.id()))

    if (missing.length > 0) {
      const detail = missing
        .map((m) => `  - ${m.name} (id: "${m.fn.id()}")`)
        .join('\n')
      throw new Error(
        `Inngest function(s) exported from inngest-functions.ts but NOT registered ` +
        `in src/app/api/inngest/route.ts inngestFunctions array:\n${detail}\n\n` +
        `Add them to the import + array, or remove the export if intentionally unused. ` +
        `Reminder: PR #10 shipped onTrustEvidenceAppended + onTrustReportCreated as code ` +
        `but missed this registration step — events were accepted by Inngest with no handler.`,
      )
    }
  })
})
