import Anthropic from "@anthropic-ai/sdk";
import { onlyFactNumbers } from "@/lib/engine/guard";
import { explainDecision, type Decision } from "@/lib/engine/sim";

/**
 * Bounded-AI explanation of a simulator decision.
 * The engine has already decided; the model may only re-word the facts it is given.
 * Without ANTHROPIC_API_KEY (or on any error / unsupported number) the deterministic
 * template explanation is returned, so the app works fully with no key.
 */

const SYSTEM =
  "You explain fleet-charging decisions to a ride-hailing driver in plain English. " +
  "Explain the decision using ONLY the provided JSON facts. Do not introduce numbers not in the facts. " +
  "Do not change or second-guess the decision. Two or three short sentences, under 80 words, no lists, no markdown.";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

function isDecision(x: unknown): x is Decision {
  if (!x || typeof x !== "object") return false;
  const d = x as Record<string, unknown>;
  const f = d.facts as Record<string, unknown> | undefined;
  return (
    (d.answer === "YES" || d.answer === "NO") &&
    typeof d.rule === "string" &&
    typeof d.tick === "number" &&
    typeof d.vehicle === "number" &&
    !!f &&
    ["socPct", "evRangeKm", "cngKg", "hour", "waitingNearby", "forecastNextHour", "bestHubQueue", "bestHubKm", "tariffNow"].every((k) => typeof f[k] === "number")
  );
}

export async function POST(req: Request) {
  let decision: Decision | null = null;
  try {
    const body = (await req.json()) as { decision?: unknown };
    if (isDecision(body.decision)) decision = body.decision;
  } catch {
    /* fall through */
  }
  if (!decision) return Response.json({ error: "invalid decision" }, { status: 400 });

  const template = explainDecision(decision);
  const key = process.env.ANTHROPIC_API_KEY;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!key || rateLimited(ip)) return Response.json({ text: template, source: "template" });

  try {
    const client = new Anthropic({ apiKey: key, timeout: 20_000, maxRetries: 1 });
    const facts = { decision: decision.answer === "NO" ? "DON'T CHARGE NOW" : "CHARGE NOW", rule: decision.rule, ...decision.facts };
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 2000,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [{ role: "user", content: `Facts (JSON): ${JSON.stringify(facts)}\n\nExplain this decision.` }],
    });
    if (response.stop_reason === "refusal") return Response.json({ text: template, source: "template" });
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .trim();
    if (!text || !onlyFactNumbers(text, decision)) return Response.json({ text: template, source: "template" });
    return Response.json({ text, source: "llm" });
  } catch {
    return Response.json({ text: template, source: "template" });
  }
}
