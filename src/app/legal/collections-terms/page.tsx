import { UPL_DISCLAIMER } from '@/lib/collections/disclaimer'

export const metadata = { title: 'Collections Assist — Terms of Service' }

export default function CollectionsTermsPage() {
  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-3xl mx-auto px-4 py-10 sm:px-6 lg:px-8 prose prose-stone">
        <h1 className="text-2xl font-extrabold text-stone-900">Collections Assist — Terms of Service</h1>
        <p className="text-xs text-stone-500">Earth Pro Connect LLC, a Delaware LLC, operates earthmove.io.</p>

        <h2 className="text-lg font-bold mt-6">1. Not a law firm</h2>
        <p>{UPL_DISCLAIMER}</p>

        <h2 className="text-lg font-bold mt-6">2. Refunds</h2>
        <p>
          The $99 Collections Assist fee is non-refundable once documents have been generated and made available
          for download, except where the failure to deliver usable documents is attributable to an error on our part.
          Refund requests may be sent to support@earthmove.io.
        </p>

        <h2 className="text-lg font-bold mt-6">3. Representations by the claimant</h2>
        <p>
          By using Collections Assist, you represent and warrant that: (a) the information you provide is true and
          complete to the best of your knowledge; (b) you are the party owed the amount claimed or are authorized
          to act on that party’s behalf; (c) you have the right to use and distribute the generated documents; and
          (d) you will not file any generated document without attorney review.
        </p>

        <h2 className="text-lg font-bold mt-6">4. Disclaimer of warranties</h2>
        <p>
          The service is provided &ldquo;as is.&rdquo; Earth Pro Connect LLC disclaims all warranties, express or implied,
          including without limitation any warranty of merchantability, fitness for a particular purpose, or
          non-infringement. We do not warrant that the generated documents are suitable for any particular case
          or jurisdiction — that is a matter for the attorney you must consult.
        </p>

        <h2 className="text-lg font-bold mt-6">5. Operating entity</h2>
        <p>Earth Pro Connect LLC is a Delaware limited liability company operating the earthmove.io service.</p>

        <h2 className="text-lg font-bold mt-6">6. Governing law &amp; venue</h2>
        <p>
          These terms are governed by the laws of the State of Colorado, and any dispute arising under them shall
          be resolved in the state or federal courts located in Denver County, Colorado.
        </p>

        <p className="mt-6 text-xs text-red-700 font-bold">
          [VERIFY WITH COLORADO ATTORNEY: Terms of service review — particularly indemnification, warranties,
          limitation of liability, dispute resolution venue]
        </p>
      </div>
    </div>
  )
}
