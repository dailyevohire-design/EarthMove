/**
 * Smoke: render HomeownerAlertsView with mock alerts, assert HTML.
 * Pure-component smoke. No env vars, no DB. Uses react-dom/server.
 */
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import {
  HomeownerAlertsView,
  type HomeownerAlert,
} from '../src/components/groundcheck/HomeownerAlerts';

let failures = 0;
function assertIncludes(html: string, needle: string, label: string) {
  if (!html.includes(needle)) {
    console.error(`  X ${label}: HTML missing "${needle}"`);
    failures++;
  }
}
function assertEq<T>(a: T, b: T, label: string) {
  if (a !== b) {
    console.error(`  X ${label}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
    failures++;
  }
}

console.log('-- empty + null cases --');
{
  const html1 = renderToString(
    React.createElement(HomeownerAlertsView, { alerts: null })
  );
  const html2 = renderToString(
    React.createElement(HomeownerAlertsView, { alerts: [] })
  );
  assertEq(html1, '', 'null alerts -> empty render');
  assertEq(html2, '', 'empty alerts -> empty render');
}

console.log('-- bedrock excavation real-shape alerts --');
const bedrockAlerts: HomeownerAlert[] = [
  {
    alert_code: 'NO_VERIFIABLE_STATE_REGISTRATION',
    severity: 'CRITICAL',
    headline: 'No state business registration on file',
    body:
      'Groundcheck could not verify a current business registration for "bedrock excavation" with the CO Secretary of State.',
    evidence_hint: 'Search the CO Secretary of State business database.',
    detected_at: new Date().toISOString(),
  },
  {
    alert_code: 'EXISTING_CRITICAL_RISK_REPORT',
    severity: 'CRITICAL',
    headline: 'A previous Groundcheck report flagged this business as CRITICAL risk',
    body: 'At least one prior trust report surfaced a critical-severity finding.',
    evidence_hint: 'See full trust report on this page.',
    detected_at: new Date().toISOString(),
  },
  {
    alert_code: 'NAME_CONFUSINGLY_SIMILAR_TO_LONGSTANDING_ENTITY',
    severity: 'HIGH',
    headline: 'Name is very similar to "bedrock excavating corp" — an established business',
    body:
      'Phoenix-LLC and impersonation scams often operate under names confusingly similar to longstanding legitimate businesses.',
    evidence_hint: 'Ask for the EIN.',
    detected_at: new Date().toISOString(),
  },
];

const html = renderToString(
  React.createElement(HomeownerAlertsView, { alerts: bedrockAlerts })
);

assertIncludes(html, 'Before you sign or pay a deposit', 'section header');
assertIncludes(html, 'No state business registration on file', 'CRITICAL #1 headline');
assertIncludes(html, 'A previous Groundcheck report flagged', 'CRITICAL #2 headline');
assertIncludes(html, 'Name is very similar', 'HIGH headline');
assertIncludes(html, 'data-severity="CRITICAL"', 'CRITICAL severity attr');
assertIncludes(html, 'data-severity="HIGH"', 'HIGH severity attr');
assertIncludes(html, 'data-alert-code="NO_VERIFIABLE_STATE_REGISTRATION"', 'alert code attr');
assertIncludes(html, '2 critical', '2 critical in header');
assertIncludes(html, '1 high', '1 high in header');
assertIncludes(html, 'not a consumer report under FCRA', 'FCRA disclaimer');

// Order: CRITICAL before HIGH
const critIdx = html.indexOf('No state business registration');
const highIdx = html.indexOf('Name is very similar');
if (critIdx === -1 || highIdx === -1 || critIdx > highIdx) {
  console.error('  X severity ordering: CRITICAL should appear before HIGH');
  failures++;
}

console.log('-- INFO-only renders without false escalation --');
const infoOnly: HomeownerAlert[] = [
  {
    alert_code: 'ESCROW_AVAILABLE',
    severity: 'INFO',
    headline: 'Consider an escrow service',
    body: 'Independent escrow services include Escrow.com.',
    evidence_hint: null,
    detected_at: new Date().toISOString(),
  },
];
const infoHtml = renderToString(
  React.createElement(HomeownerAlertsView, { alerts: infoOnly })
);
assertIncludes(infoHtml, 'Consider an escrow service', 'INFO headline');
if (infoHtml.includes('critical')) {
  console.error('  X INFO-only render leaked "critical" into header');
  failures++;
}

if (failures > 0) {
  console.error(`\nFAILED: ${failures} assertion(s) failed`);
  process.exit(1);
}
console.log('');
console.log('OK HomeownerAlerts smoke: ALL TESTS PASSED');
console.log(`  rendered_chars=${html.length}`);
process.exit(0);
