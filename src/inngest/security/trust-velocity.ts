import { inngest } from '@/lib/inngest';
import { createPublicClient } from '@/lib/security/server-client';

export const securityTrustVelocity = inngest.createFunction(
  {
    id: 'security-trust-velocity',
    name: 'Security: trust report velocity alert',
    triggers: [
      { event: 'security/trust.velocity_spike' },
      { event: 'security/trust.score_pump' },
    ],
  },
  async ({ event, step }) => {
    const { kind, recentCount } = event.data as { kind: string; recentCount: number };

    const shouldSend = await step.run('dedup-check', async () => {
      const sb = createPublicClient();
      const { data } = await sb.schema('security').rpc('fn_should_send_alert', {
        p_dedup_key: `trust_velocity_alert:${kind}`,
        p_min_interval_sec: 3600,
      });
      return Boolean(data);
    });
    if (!shouldSend) return { sent: false, reason: 'deduped' };

    await step.run('notify-ops', async () => {
      const opsPhone = process.env.OPS_PHONE_E164;
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const from = process.env.TWILIO_FROM_E164;
      if (!opsPhone || !accountSid || !authToken || !from) return { skipped: 'missing_twilio_env' };

      const body = `🚨 Trust report ${kind}: ${recentCount} recent writes. Review /admin/security and trust_reports table.`;
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: opsPhone, From: from, Body: body }).toString(),
      });
    });
    return { sent: true };
  }
);
