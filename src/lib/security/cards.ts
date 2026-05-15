import { createPublicClient } from './server-client';

export async function claimSecurityCard(cardId: string, userId: string): Promise<Record<string, unknown> | null> {
  const sb = createPublicClient();
  const { data: before } = await sb.from('intervention_cards').select('status,claimed_by').eq('id', cardId).single();
  await sb.from('intervention_cards').update({
    status: 'claimed', claimed_by: userId, claimed_at: new Date().toISOString(),
  }).eq('id', cardId);
  return (before as Record<string, unknown>) ?? null;
}

export async function resolveSecurityCard(cardId: string, userId: string, note: string): Promise<Record<string, unknown> | null> {
  const sb = createPublicClient();
  const { data: before } = await sb.from('intervention_cards').select('status,resolved_by').eq('id', cardId).single();
  await sb.from('intervention_cards').update({
    status: 'resolved', resolved_by: userId, resolved_at: new Date().toISOString(), resolution_note: note,
  }).eq('id', cardId);
  return (before as Record<string, unknown>) ?? null;
}

export async function snoozeSecurityCard(cardId: string, minutes: number): Promise<Record<string, unknown> | null> {
  const sb = createPublicClient();
  const { data: before } = await sb.from('intervention_cards').select('status,snoozed_until').eq('id', cardId).single();
  const until = new Date(Date.now() + minutes * 60_000).toISOString();
  await sb.from('intervention_cards').update({ status: 'snoozed', snoozed_until: until }).eq('id', cardId);
  return (before as Record<string, unknown>) ?? null;
}

export async function dismissSecurityCard(cardId: string, userId: string, note: string): Promise<Record<string, unknown> | null> {
  const sb = createPublicClient();
  const { data: before } = await sb.from('intervention_cards').select('status').eq('id', cardId).single();
  await sb.from('intervention_cards').update({
    status: 'dismissed', resolved_by: userId, resolved_at: new Date().toISOString(), resolution_note: note,
  }).eq('id', cardId);
  return (before as Record<string, unknown>) ?? null;
}
