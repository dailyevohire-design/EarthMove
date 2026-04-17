import type { ContractorTeamMember } from './access'

export function checkIfApprovalRequired(
  teamMember: ContractorTeamMember | null,
  orderTotalCents: number
): boolean {
  if (!teamMember) return false
  if (teamMember.spend_limit_cents == null) return false
  return orderTotalCents > teamMember.spend_limit_cents
}
