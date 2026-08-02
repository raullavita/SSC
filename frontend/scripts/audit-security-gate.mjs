#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const ALLOWLIST = new Map([
  [
    1124282,
    {
      ghsa: 'GHSA-qwww-vcr4-c8h2',
      reason: 'Affects unstable React Router RSC APIs only; frontend does not use RSC paths.',
      expectedPath: 'react-router-dom>react-router',
    },
  ],
]);

function runAuditJson() {
  const result = spawnSync('yarn', ['audit', '--json', '--groups', 'dependencies'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  if (stderr.trim()) {
    process.stderr.write(stderr);
  }

  const advisories = [];
  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith('{')) {
      continue;
    }
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    if (parsed?.type === 'auditAdvisory' && parsed?.data) {
      advisories.push(parsed.data);
    }
  }

  return advisories;
}

function advisoryKey(data) {
  return Number(data?.advisory?.id ?? data?.resolution?.id ?? 0);
}

function summarizeEntry(data) {
  const id = advisoryKey(data);
  const title = data?.advisory?.title || 'unknown_advisory';
  const severity = data?.advisory?.severity || 'unknown';
  const path = data?.resolution?.path || 'unknown_path';
  return { id, title, severity, path };
}

const advisories = runAuditJson();
if (!advisories.length) {
  console.log('audit-security-gate: no advisories found');
  process.exit(0);
}

const blocked = [];
const allowed = [];

for (const entry of advisories) {
  const info = summarizeEntry(entry);
  const allow = ALLOWLIST.get(info.id);
  if (!allow) {
    blocked.push({ ...info, reason: 'not_allowlisted' });
    continue;
  }
  if (allow.expectedPath && info.path !== allow.expectedPath) {
    blocked.push({ ...info, reason: `unexpected_path:${info.path}` });
    continue;
  }
  allowed.push({ ...info, reason: allow.reason, ghsa: allow.ghsa });
}

if (allowed.length) {
  console.log('audit-security-gate: allowlisted advisories detected');
  for (const item of allowed) {
    console.log(
      `  - id=${item.id} severity=${item.severity} path=${item.path} ghsa=${item.ghsa} reason=${item.reason}`
    );
  }
}

if (blocked.length) {
  console.error('audit-security-gate: blocking advisories detected');
  for (const item of blocked) {
    console.error(
      `  - id=${item.id} severity=${item.severity} path=${item.path} title=${item.title} reason=${item.reason}`
    );
  }
  process.exit(1);
}

console.log('audit-security-gate: pass (only allowlisted advisory present)');
