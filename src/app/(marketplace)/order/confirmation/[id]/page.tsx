// src/app/(marketplace)/order/confirmation/[id]/page.tsx
// STUB for C3a — real artboard implementation lands in C3b.
//
// Auth posture: signed-in users only see their own orders. Guest path renders
// a generic placeholder (no data exposed via leaked URL). C3b wires the
// signed-JWT token check (orders_guest_read_signed RLS, ORDER_TOKEN_SECRET).
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/user-context';

export const dynamic = 'force-dynamic';

const POLL_WINDOW_MS = 60_000;

export default async function ConfirmationStub({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getUserContext();

  // Guest path: no order detail until C3b wires JWT token validation.
  // Stripe sends them a receipt email regardless; this is just a landing page.
  if (!ctx.isAuthenticated) {
    return <GenericGuestLanding />;
  }

  const db = await createClient();
  const { data: order, error } = await db
    .from('orders')
    .select('id, status, total_amount, material_name_snapshot, quantity, created_at')
    .eq('id', id)
    .eq('customer_id', ctx.userId!)  // RLS-enforced; double-belt at query layer
    .maybeSingle();

  if (error || !order) notFound();

  const orderAgeMs = Date.now() - new Date(order.created_at).getTime();
  const isPollingWindow = order.status === 'pending_payment' && orderAgeMs < POLL_WINDOW_MS;

  return (
    <main className="min-h-screen bg-stone-50">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center">
          {isPollingWindow && (
            <>
              <h1 className="font-fraunces text-3xl text-stone-900 mb-3">Payment processing</h1>
              <p className="text-stone-600">Your payment is finalizing. This page will update in a moment.</p>
              <meta httpEquiv="refresh" content="3" />
            </>
          )}
          {order.status === 'pending_payment' && !isPollingWindow && (
            <>
              <h1 className="font-fraunces text-3xl text-stone-900 mb-3">Still processing</h1>
              <p className="text-stone-600">This is taking a moment longer than usual. Check your email for a Stripe receipt — if you received one, your order is confirmed and full detail will follow shortly.</p>
            </>
          )}
          {order.status === 'confirmed' && (
            <>
              <h1 className="font-fraunces text-3xl text-stone-900 mb-3">Order confirmed</h1>
              <p className="text-stone-600 mb-2">Order #{order.id.slice(0, 8).toUpperCase()}</p>
              <p className="text-stone-600 mb-6">
                {order.quantity} tons of {order.material_name_snapshot} · ${Number(order.total_amount).toFixed(2)}
              </p>
              <p className="text-sm text-stone-500">A receipt is on its way to your email. Tracking detail coming soon.</p>
            </>
          )}
          {order.status === 'payment_failed' && (
            <>
              <h1 className="font-fraunces text-3xl text-stone-900 mb-3">Payment didn&apos;t go through</h1>
              <p className="text-stone-600">Try checkout again or contact support.</p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function GenericGuestLanding() {
  return (
    <main className="min-h-screen bg-stone-50">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center">
          <h1 className="font-fraunces text-3xl text-stone-900 mb-3">Thanks — check your email</h1>
          <p className="text-stone-600 mb-6">
            We sent your order confirmation and tracking link to the email you provided at checkout.
            Open it to view your full order detail.
          </p>
          <p className="text-sm text-stone-500">
            Already have an account? <Link href="/login?next=/account/orders" className="text-emerald-700 underline underline-offset-2">Sign in</Link> to manage past orders.
          </p>
        </div>
      </div>
    </main>
  );
}
