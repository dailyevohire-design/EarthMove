export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Terms of Service',
  description: 'EarthMove terms of service — the agreement governing your use of our platform.',
  alternates: { canonical: '/terms' },
}

export default function TermsPage() {
  return (
    <div className="container-main py-12 max-w-3xl">
      <h1 className="text-3xl font-extrabold text-gray-900 mb-8">Terms of Service</h1>
      <div className="prose prose-gray max-w-none text-sm leading-relaxed space-y-6">
        <p className="text-gray-500">Last updated: April 6, 2026</p>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mt-8 mb-3">1. Acceptance of Terms</h2>
          <p>By accessing or using EarthMove (&quot;the Platform&quot;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Platform.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mt-8 mb-3">2. Service Description</h2>
          <p>EarthMove is a marketplace that connects buyers of bulk construction materials (aggregate, sand, gravel, fill dirt, etc.) with local suppliers for delivery. EarthMove facilitates the transaction but does not own, produce, or directly deliver the materials.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mt-8 mb-3">3. Orders and Payment</h2>
          <p>All orders are subject to availability. Prices shown include the material cost and are subject to delivery fees and a platform service fee. Payment is processed at checkout via Stripe. Orders are confirmed upon successful payment.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mt-8 mb-3">4. Delivery</h2>
          <p>Delivery times are estimates and not guaranteed. Same-day delivery is subject to supplier availability and order timing. You are responsible for ensuring the delivery site is accessible for dump trucks and that the drop location is clearly communicated.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mt-8 mb-3">5. Cancellations and Refunds</h2>
          <p>Orders may be cancelled before dispatch for a full refund. Once a delivery is en route, cancellation is subject to a restocking and transport fee. Disputes about material quality should be reported within 48 hours of delivery by contacting support@earthmove.io.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mt-8 mb-3">6. Material Specifications</h2>
          <p>Material descriptions and images are representative. Natural aggregate materials may vary in color, size, and composition. We work with suppliers to ensure materials meet standard specifications for their type.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mt-8 mb-3">7. Limitation of Liability</h2>
          <p>EarthMove acts as a marketplace facilitator. Our liability is limited to the amount paid for the specific order in question. We are not liable for indirect, consequential, or incidental damages.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mt-8 mb-3">8. Governing Law</h2>
          <p>These terms are governed by the laws of the State of Texas. Any disputes shall be resolved in the courts of Dallas County, Texas.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mt-8 mb-3">9. Contact</h2>
          <p>For questions about these terms, contact us at support@earthmove.io or call (888) 555-DIRT.</p>
        </section>
      </div>
    </div>
  )
}
