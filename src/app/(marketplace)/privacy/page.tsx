export const metadata = {
  title: 'Privacy Policy',
  description: 'EarthMove privacy policy — how we collect, use, and protect your information.',
  alternates: { canonical: '/privacy' },
}

export default function PrivacyPage() {
  return (
    <div className="container-main py-12 max-w-3xl">
      <h1 className="text-3xl font-extrabold text-gray-900 mb-8">Privacy Policy</h1>
      <div className="prose prose-gray max-w-none text-sm leading-relaxed space-y-6">
        <p className="text-gray-500">Last updated: April 6, 2026</p>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mt-8 mb-3">1. Information We Collect</h2>
          <p>When you use EarthMove, we collect information you provide directly: your name, email address, phone number, company name, delivery address, and payment information. We also collect usage data such as pages visited, browser type, and IP address.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mt-8 mb-3">2. How We Use Your Information</h2>
          <p>We use your information to process orders, coordinate deliveries with suppliers, communicate about your orders, improve our services, and send relevant marketing communications (which you can opt out of at any time).</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mt-8 mb-3">3. Payment Processing</h2>
          <p>Payment is processed securely through Stripe. We do not store your full credit card number on our servers. Stripe&apos;s privacy policy governs payment data handling.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mt-8 mb-3">4. Information Sharing</h2>
          <p>We share your delivery address and contact information with the supplier fulfilling your order. We do not sell your personal information to third parties. We may share anonymized, aggregated data for analytics purposes.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mt-8 mb-3">5. Data Security</h2>
          <p>We implement industry-standard security measures including encrypted connections (HTTPS), secure authentication, and access controls. However, no method of transmission over the internet is 100% secure.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mt-8 mb-3">6. Cookies</h2>
          <p>We use cookies to remember your market selection, maintain your session, and improve your browsing experience. You can disable cookies in your browser settings, though some features may not work properly.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mt-8 mb-3">7. Your Rights</h2>
          <p>You may request access to, correction of, or deletion of your personal data by contacting us at support@earthmove.io. We will respond within 30 days.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mt-8 mb-3">8. Contact</h2>
          <p>For privacy-related questions, contact us at support@earthmove.io or call (888) 555-DIRT.</p>
        </section>
      </div>
    </div>
  )
}
