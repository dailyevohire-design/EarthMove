import { inngest } from '@/lib/inngest';
import { createPublicClient } from '@/lib/security/server-client';

export const securityHoneypotSwarm = inngest.createFunction(
  {
    id: 'security-honeypot-swarm',
    name: 'Security: honeypot swarm escalation',
    triggers: [{ event: 'security/honeypot.swarm' }],
  },
  async ({ event, step }) => {
    const { ip, hitCount } = event.data as { ip: string; hitCount: number };
    if (hitCount < 10) return { escalated: false };

    const shouldSend = await step.run('dedup-check', async () => {
      const sb = createPublicClient();
      const { data } = await sb.schema('security').rpc('fn_should_send_alert', {
        p_dedup_key: `honeypot_alert:${ip}`,
        p_min_interval_sec: 1800,
      });
      return Boolean(data);
    });
    if (!shouldSend) return { escalated: false, reason: 'deduped' };

    await step.run('notify-ops', async () => {
      const opsPhone = process.env.OPS_PHONE_E164;
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const from = process.env.TWILIO_FROM_E164;
      if (!opsPhone || !accountSid || !authToken || !from) return { skipped: 'missing_twilio_env' };

      const body = `⚠️ Honeypot swarm: ${ip} fired ${hitCount} probes. IP banned 7d. Review /admin/security/bans.`;
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: opsPhone, From: from, Body: body }).toString(),
      });
    });

    return { escalated: true };
  }
);
