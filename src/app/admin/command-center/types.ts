export type TaskStatus = 'Not Started' | 'In Progress' | 'Blocked' | 'Done' | 'Skipped'
export type GateStatus = 'Red' | 'Yellow' | 'Green'
export type RiskStatus = 'Open' | 'Mitigating' | 'Contained' | 'Realized' | 'Closed'
export type PatentStatus = 'Pending' | 'Drafting' | 'In Counsel Review' | 'Filed' | 'Granted' | 'Abandoned'

export interface SeedTask {
  id: string
  week: number
  weekLabel: string
  weekRange: string
  tMinus: string
  workstream: string
  owner: string
  title: string
  exit: string
  kill: string
  spend: number
  tier: 1 | 2 | 3
}

export interface SeedGate {
  id: string
  title: string
  owner: string
  verify: string
  category: string
}

export interface SeedRisk {
  id: string
  name: string
  severity: 1 | 2 | 3 | 4 | 5
  likelihood: 1 | 2 | 3 | 4 | 5
  roles: string[]
  mitigation: string
}

export interface SeedDecisionOption {
  key: 'A' | 'B' | 'C'
  label: string
  detail: string
  recommended?: boolean
}

export interface SeedDecision {
  id: string
  question: string
  urgency: string
  context: string
  options: SeedDecisionOption[]
}

export interface SeedPatent {
  id: string
  title: string
  cost: string
  type: string
  dueDate: string
  notes: string
}

// ───────── Per-user state shape (stored in public.dashboard_state.state jsonb) ─────────

export interface TaskState {
  status: TaskStatus
  notes: string
  updatedAt: string | null
}

export interface GateState {
  status: GateStatus
  notes: string
}

export interface RiskState {
  status: RiskStatus
  changeMyMind: string
  owner: string
}

export interface DecisionState {
  choice: '' | 'A' | 'B' | 'C'
  resolvedAt: string | null
}

export interface ProvisionalState {
  filed: boolean
  receipt: string
  filedDate: string
}

export interface PatentState {
  status: PatentStatus
  serial: string
  counsel: string
  notes: string
}

export interface DashboardState {
  tasks: Record<string, TaskState>
  gates: Record<string, GateState>
  risks: Record<string, RiskState>
  decisions: Record<string, DecisionState>
  provisional: ProvisionalState
  patents: Record<string, PatentState>
  signoffs: Record<string, boolean>
}

export type TabKey = 'sprint' | 'gates' | 'risks' | 'decisions' | 'patents'
