/* Dedicated scheduled dispatcher. Store the GitHub token only as a Worker Secret. */
const REPOSITORY = 'kdcamir5-crypto/Task-Reward-Hub';
const WORKFLOWS = Object.freeze(['auto-mining.yml', 'verify-referrals.yml']);
const API = 'https://api.github.com/repos/' + REPOSITORY + '/actions/workflows/';
const SUCCESS_MAX_AGE_MS = 5 * 60 * 1000;
const ACTIVE_MAX_AGE_MS = 12 * 60 * 1000;
const FUTURE_SKEW_MS = 60 * 1000;
const ACTIVE = new Set(['queued', 'in_progress', 'waiting', 'requested', 'pending']);
const EVENTS = new Set(['schedule', 'workflow_dispatch', 'push']);

export function hasRecentRun(runs, now = Date.now()) {
  return runs.some(run => {
    if (!run || run.head_branch !== 'main' || !EVENTS.has(run.event)) return false;
    const active = ACTIVE.has(run.status);
    const success = run.status === 'completed' && run.conclusion === 'success';
    if (!active && !success) return false;
    const timestamp = Date.parse(active ? run.created_at : (run.updated_at || run.created_at));
    const age = now - timestamp;
    return Number.isFinite(timestamp) && age >= -FUTURE_SKEW_MS && age <= (active ? ACTIVE_MAX_AGE_MS : SUCCESS_MAX_AGE_MS);
  });
}

async function github(fetcher, url, token, method = 'GET') {
  const headers = {
    'Accept': 'application/vnd.github+json',
    'Authorization': 'Bearer ' + token,
    'User-Agent': 'TaskRewardHubScheduler',
    'X-GitHub-Api-Version': '2026-03-10'
  };
  if (method === 'POST') headers['Content-Type'] = 'application/json';
  let response;
  try {
    response = await fetcher(url, {
      method, headers, redirect: 'error', signal: AbortSignal.timeout(15000),
      ...(method === 'POST' ? {body: JSON.stringify({ref: 'main'})} : {})
    });
  } catch (error) {
    const message = String(error?.message || '');
    const code = /illegal invocation/i.test(message) ? 'ILLEGAL_INVOCATION'
      : /abortsignal.*timeout|timeout.*not a function/i.test(message) ? 'TIMEOUT_UNSUPPORTED'
      : /header|character|invalid.*value/i.test(message) ? 'INVALID_HEADER'
      : error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'TIMEOUT'
      : error?.name === 'TypeError' ? 'TYPE_ERROR' : 'OTHER';
    throw new Error('GITHUB_CONNECTION_' + code);
  }
  if (!response.ok) throw new Error('GITHUB_HTTP_' + response.status);
  if (method === 'POST') return null;
  try {
    const body = await response.json();
    if (!Array.isArray(body.workflow_runs)) throw new Error();
    return body.workflow_runs;
  } catch (_) { throw new Error('GITHUB_RESPONSE_INVALID'); }
}

export async function checkAndDispatch(workflow, token, fetcher = (...args) => globalThis.fetch(...args), now = Date.now()) {
  if (!WORKFLOWS.includes(workflow)) throw new Error('UNKNOWN_WORKFLOW');
  const base = API + workflow;
  const runs = await github(fetcher, base + '/runs?per_page=20', token);
  if (hasRecentRun(runs, now)) return 'recent';
  await github(fetcher, base + '/dispatches', token, 'POST');
  return 'dispatched';
}

export async function runScheduled(env, fetcher = (...args) => globalThis.fetch(...args), now = Date.now()) {
  const token = env.GITHUB_ACTIONS_TOKEN;
  if (typeof token !== 'string' || !token.trim() || token.length > 512) throw new Error('TOKEN_NOT_CONFIGURED');
  const settled = await Promise.allSettled(WORKFLOWS.map(workflow => checkAndDispatch(workflow, token, fetcher, now)));
  let failed = false;
  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') console.log('SCHEDULER', WORKFLOWS[index], result.value);
    else { failed = true; const safe = /^(GITHUB_CONNECTION_(?:FAILED|ILLEGAL_INVOCATION|TIMEOUT_UNSUPPORTED|INVALID_HEADER|TIMEOUT|TYPE_ERROR|OTHER)|GITHUB_RESPONSE_INVALID|GITHUB_HTTP_\d{3})$/.test(result.reason?.message || '') ? result.reason.message : 'DISPATCH_FAILED'; console.error('SCHEDULER', WORKFLOWS[index], safe); }
  });
  if (failed) throw new Error('SCHEDULER_DISPATCH_FAILED');
}

export default {
  async scheduled(_event, env) { await runScheduled(env); },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.pathname !== '/health') return new Response('Not found', {status: 404});
    return Response.json({ok: true, service: 'workflow-scheduler', configured: typeof env.GITHUB_ACTIONS_TOKEN === 'string' && env.GITHUB_ACTIONS_TOKEN.trim().length > 0, version: 1}, {headers: {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}});
  }
};
