import { inngest } from '@/lib/inngest';
import { createPublicClient } from '@/lib/security/server-client';

export const securityCanaryAlert = inngest.createFunction(
  {
    id: 'security-canary-alert',
    name: 'Security: canary hit alert',
    triggers: [{ event: 'security/canary.hit' }],
  },
  async ({ event, step }) => {
    const { canaryId, identifier, hitSource, callerId } = event.data as {
      canaryId: string; identifier: string; hitSource: string; callerId?: string;
    };

    const shouldSend = await step.run('dedup-check', async () => {
      const sb = createPublicClient();
      const { data } = await sb.schema('security').rpc('fn_should_send_alert', {
        p_dedup_key: `canary_alert:${canaryId}`,
        p_min_interval_sec: 900,
      });
      return Boolean(data);
    });

    if (!shouldSend) return { canaryId, sent: false, reason: 'deduped' };

    await step.run('sms-ops-pager', async () => {
      const opsPhone = process.env.OPS_PHONE_E164;
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const from = process.env.TWILIO_FROM_E164;
      if (!opsPhone || !accountSid || !authToken || !from) return { skipped: 'missing_twilio_env' };

      const body = `🐦 CANARY HIT: ${identifier} via ${hitSource}${callerId ? ` from ${callerId}` : ''}. Confirmed exfiltration signal. Open /admin/security.`;
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: opsPhone, From: from, Body: body }).toString(),
      });
      return { status: res.status };
    });

    return { canaryId, sent: true };
  }
);
