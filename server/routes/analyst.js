/**
 * In-app Mira analyst chat — single thread with SSE streaming.
 * Mira orchestrates; Pricing is consulted automatically when needed.
 */
import { Router } from 'express';
import { requireAuth, resolveWorkspace } from '../middleware/auth.js';
import { attachEntitlements, requireFeature } from '../middleware/entitlements.js';
import { listCompetitors, listRecentChanges, getLatestSnapshot } from '../db/index.js';
import { getProduct } from '../db/products.js';
import { completeJSON, streamComplete } from '../services/ai.js';
import { listAgentStatus, recordHeartbeat } from '../services/agentPresence.js';

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const requireAskMira = [requireAuth, resolveWorkspace, attachEntitlements, requireFeature('ask_mira_analyst')];

/** Roster + live status for Ask Mira UI (in-app ready + Band heartbeats). */
router.get(
  '/agents',
  ...requireAskMira,
  wrap(async (_req, res) => {
    res.json({ agents: listAgentStatus() });
  })
);

/** Band agent processes POST here every ~15s while running. */
router.post(
  '/agents/heartbeat',
  requireAuth,
  resolveWorkspace,
  wrap(async (req, res) => {
    const id = String(req.body?.id || req.body?.agent || '').toLowerCase().trim();
    const ok = recordHeartbeat(id, {
      source: req.body?.source || 'band',
      pid: req.body?.pid || null,
    });
    if (!ok) {
      return res.status(400).json({ error: 'Unknown agent id', code: 'BAD_AGENT' });
    }
    res.json({ ok: true, id, agents: listAgentStatus() });
  })
);

const MIRA_SYSTEM = `You are Mira, a competitive and market intelligence analyst inside the Mira product.
Answer founders using the workspace CONTEXT below. Be concise, decision-oriented, and specific
(name competitors and prices when present). Prefer bullets. If data is missing, say what to
check in Mira (Competitors, Changes, Positioning). Do not invent prices or rivals.
When PRICING SPECIALIST NOTES are provided, weave the useful numbers into your answer
(you may add a short **Pricing** subsection). Speak as Mira in one cohesive reply.

ALWAYS use this exact two-part format (both labels required):
REASONING:
- 3–6 short bullets: what in CONTEXT you're using and how you're deciding
ANSWER:
(the user-facing reply in markdown — no "REASONING"/"ANSWER" labels here)`;

const PRICING_SYSTEM = `You are Pricing, Mira's pricing specialist.
Focus on entry prices, tiers, and pricing-related changes from CONTEXT. Be numeric and clear.
Call out who looks overpriced vs best value when the data supports it. Do not invent prices.
Write notes for Mira to use — tight bullets, no fluff.`;

async function buildContext(workspaceId) {
  const [product, competitors, changes] = await Promise.all([
    getProduct(workspaceId),
    listCompetitors('approved', workspaceId),
    listRecentChanges(25, workspaceId),
  ]);

  const competitorBlocks = await Promise.all(
    (competitors || []).slice(0, 12).map(async (c) => {
      const snap = await getLatestSnapshot(c.id);
      const snippet = String(snap?.content || '').slice(0, 900);
      return [
        `### ${c.name}`,
        `website: ${c.website || 'n/a'}`,
        `pricing_url: ${c.pricing_url || 'n/a'}`,
        `value_score: ${c.value_score ?? 'n/a'}`,
        `entry_price_hint: ${c.entry_price ?? c.price_monthly ?? 'n/a'}`,
        snippet ? `snapshot:\n${snippet}` : 'snapshot: (none)',
      ].join('\n');
    })
  );

  const changeLines = (changes || []).slice(0, 20).map((ch) => {
    const when = ch.created_at || ch.detected_at || '';
    const name = ch.competitor_name || ch.name || 'competitor';
    const summary = ch.summary || ch.title || ch.change_type || JSON.stringify(ch).slice(0, 160);
    return `- [${when}] ${name}: ${summary}`;
  });

  const productBlock = product
    ? `PRODUCT: ${product.name}\n${product.description || ''}\npricing_url: ${product.pricing_url || 'n/a'}`
    : 'PRODUCT: (not set yet)';

  return [
    productBlock,
    '',
    'COMPETITORS:',
    competitorBlocks.length ? competitorBlocks.join('\n\n') : '(none tracked)',
    '',
    'RECENT CHANGES:',
    changeLines.length ? changeLines.join('\n') : '(none)',
  ].join('\n');
}

function normalizeMessages(incoming) {
  return (Array.isArray(incoming) ? incoming : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
    .slice(-16)
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));
}

/** Fast path — avoid an extra LLM round-trip when intent is obvious. */
function keywordRoute(text) {
  const t = String(text || '').toLowerCase();
  const pricing = /price|pricing|tier|\$\/mo|\$\d|overpriced|underpriced|plan|subscription|value for money|entry price/.test(t);
  const general = /position|competitor|watchlist|change|strateg|risk|market|rival|expose|dangerous/.test(t);
  if (pricing && general) return { consult: ['mira', 'pricing'], via: 'keywords' };
  if (pricing && !general) return { consult: ['pricing'], via: 'keywords' };
  if (general && !pricing) return { consult: ['mira'], via: 'keywords' };
  return null;
}

async function routeAgents(latestUserText) {
  const fast = keywordRoute(latestUserText);
  if (fast) return fast;

  try {
    const routed = await completeJSON({
      system: `You route founder questions to Mira analysts.
Return ONLY JSON: { "consult": ["mira"] } or { "consult": ["pricing"] } or { "consult": ["mira","pricing"] }.
Rules:
- pricing-only → ["pricing"]
- strategy/positioning/watchlist/changes without deep price compare → ["mira"]
- both → ["mira","pricing"]
Always include at least one agent.`,
      user: latestUserText.slice(0, 2000),
      maxTokens: 80,
      temperature: 0,
    });
    const consult = Array.isArray(routed?.consult) ? routed.consult : [];
    const clean = [...new Set(consult.map((x) => String(x).toLowerCase()))]
      .filter((x) => x === 'mira' || x === 'pricing');
    return { consult: clean.length ? clean : ['mira'], via: 'router' };
  } catch {
    return { consult: ['mira'], via: 'fallback' };
  }
}

function sseWrite(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function runAnalystTurn({ workspaceId, messages, onEvent }) {
  const latestUser = messages[messages.length - 1].content;

  await onEvent('status', { step: 'routing', label: 'Choosing which specialists to call…' });

  // Context load + routing in parallel when router needs LLM; keyword path is instant.
  const routePromise = routeAgents(latestUser);
  const contextPromise = buildContext(workspaceId);

  const [{ consult, via }, context] = await Promise.all([routePromise, contextPromise]);
  const needPricing = consult.includes('pricing');
  const needMira = consult.includes('mira') || !needPricing;

  const consultedLabels = [];
  if (needMira || needPricing) consultedLabels.push('Mira');
  if (needPricing) consultedLabels.push('Pricing');

  await onEvent('status', {
    step: 'routed',
    label: needPricing
      ? 'Bringing in Pricing for the numbers…'
      : 'Mira can handle this directly…',
    consult,
    via,
  });

  const contextBlock = `--- WORKSPACE CONTEXT ---\n${context.slice(0, 28000)}\n--- END CONTEXT ---`;
  let pricingNotes = '';

  if (needPricing) {
    await onEvent('status', { step: 'pricing', label: 'Pricing is reviewing tiers…', agent: 'Pricing' });
    let notes = '';
    for await (const delta of streamComplete({
      system: `${PRICING_SYSTEM}\n\n${contextBlock}`,
      messages,
      temperature: 0.2,
      maxTokens: 900,
    })) {
      notes += delta;
      await onEvent('reasoning', { agent: 'Pricing', delta });
    }
    pricingNotes = notes;
    await onEvent('status', { step: 'pricing_done', label: 'Pricing notes ready', agent: 'Pricing' });
  }

  await onEvent('status', { step: 'mira', label: 'Mira is thinking…', agent: 'Mira' });

  const miraSystem = [
    MIRA_SYSTEM,
    contextBlock,
    pricingNotes
      ? `\n--- PRICING SPECIALIST NOTES (from Pricing agent) ---\n${pricingNotes.slice(0, 6000)}\n--- END PRICING NOTES ---`
      : '',
  ].filter(Boolean).join('\n');

  const { reply, reasoning: miraReasoning } = await streamMiraSplit({
    system: miraSystem,
    messages,
    onEvent,
  });

  await onEvent('done', {
    agent: 'mira',
    agentName: 'Mira',
    consulted: consultedLabels.length ? consultedLabels : ['Mira'],
    reply: reply || '(No response)',
    miraReasoning: miraReasoning || undefined,
  });

  return { reply, consulted: consultedLabels };
}

/**
 * Stream Mira output split into REASONING (reasoning events) + ANSWER (token events).
 * Falls back to treating the whole stream as the answer if markers are missing.
 */
async function streamMiraSplit({ system, messages, onEvent }) {
  let mode = 'seek'; // seek | reasoning | answer
  let hold = '';
  let reasoning = '';
  let reply = '';
  let announcedAnswer = false;

  const emitReasoning = async (text) => {
    if (!text) return;
    reasoning += text;
    await onEvent('reasoning', { agent: 'Mira', delta: text });
  };

  const emitAnswer = async (text) => {
    if (!text) return;
    if (!announcedAnswer) {
      announcedAnswer = true;
      await onEvent('status', { step: 'mira_answer', label: 'Mira is writing the answer…', agent: 'Mira' });
    }
    reply += text;
    await onEvent('token', { delta: text });
  };

  for await (const delta of streamComplete({
    system,
    messages,
    temperature: 0.3,
    maxTokens: 1400,
  })) {
    hold += delta;

    if (mode === 'seek') {
      const rMatch = hold.match(/REASONING\s*:/i);
      const aMatch = hold.match(/ANSWER\s*:/i);
      if (rMatch) {
        mode = 'reasoning';
        hold = hold.slice(rMatch.index + rMatch[0].length).replace(/^\s*/, '');
      } else if (aMatch) {
        mode = 'answer';
        hold = hold.slice(aMatch.index + aMatch[0].length).replace(/^\s*/, '');
        await emitAnswer(hold);
        hold = '';
      } else if (hold.length > 100) {
        // Model skipped markers — treat everything as the answer.
        mode = 'answer';
        await emitAnswer(hold);
        hold = '';
      }
      continue;
    }

    if (mode === 'reasoning') {
      const aMatch = hold.match(/\n\s*ANSWER\s*:/i);
      if (aMatch) {
        const before = hold.slice(0, aMatch.index);
        await emitReasoning(before);
        mode = 'answer';
        hold = hold.slice(aMatch.index + aMatch[0].length).replace(/^\s*/, '');
        await emitAnswer(hold);
        hold = '';
      } else {
        // Keep a short tail so we don't split mid-"ANSWER:".
        const keep = 20;
        if (hold.length > keep) {
          await emitReasoning(hold.slice(0, -keep));
          hold = hold.slice(-keep);
        }
      }
      continue;
    }

    // answer
    await emitAnswer(hold);
    hold = '';
  }

  if (hold) {
    if (mode === 'reasoning' || mode === 'seek') {
      // Never got ANSWER: — if we have reasoning-looking content, still surface remainder as answer.
      if (mode === 'reasoning' && reasoning) {
        await emitReasoning(hold);
      } else {
        await emitAnswer(hold);
      }
    } else {
      await emitAnswer(hold);
    }
  }

  return { reply: reply.trim(), reasoning: reasoning.trim() };
}

router.post(
  '/chat',
  ...requireAskMira,
  wrap(async (req, res) => {
    const messages = normalizeMessages(req.body?.messages);
    if (!messages.length || messages[messages.length - 1].role !== 'user') {
      return res.status(400).json({ error: 'Send a user message.', code: 'BAD_REQUEST' });
    }

    const wantsStream = req.query.stream === '1'
      || String(req.headers.accept || '').includes('text/event-stream');

    if (!wantsStream) {
      const events = [];
      let result = null;
      await runAnalystTurn({
        workspaceId: req.workspaceId,
        messages,
        onEvent: async (event, data) => {
          if (event === 'done') result = data;
          else events.push({ event, data });
        },
      });
      return res.json(result || { reply: '(No response)', consulted: ['Mira'], agentName: 'Mira' });
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    try {
      await runAnalystTurn({
        workspaceId: req.workspaceId,
        messages,
        onEvent: async (event, data) => {
          sseWrite(res, event, data);
          if (typeof res.flush === 'function') res.flush();
        },
      });
    } catch (err) {
      sseWrite(res, 'error', {
        error: err?.message || 'Chat failed',
        code: err?.code || 'ERROR',
      });
    }
    res.end();
  })
);

export default router;
