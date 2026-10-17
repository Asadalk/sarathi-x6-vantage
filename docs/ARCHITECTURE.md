# Architecture

```mermaid
flowchart LR
  subgraph model["model/ (Python, offline)"]
    Y[assumptions.yaml] --> E[export.py]
    S[synth_telematics.py<br/>seeded synthetic data] --> T[train_models.py<br/>Poisson GBM demand<br/>IsolationForest health]
    T --> E
    M[market_sizing.py] --> E
    SRC[docs/SOURCES.md] --> E
  end
  E -->|JSON| D[(web/public/data/<br/>assumptions · market · demand · health · sources)]
  subgraph web["web/ (Next.js on Vercel)"]
    D --> ENG[lib/engine<br/>tco · scoring · market · physics · sim<br/>pure TypeScript, Vitest]
    ENG --> P[pages: / market vehicle powertrain tco<br/>vantage health apps roadmap assumptions]
    P -->|decision facts| API[/api/explain<br/>bounded AI, optional key/]
    API -->|text or template| P
  end
  ENG --> N[scripts/deck-numbers.ts] --> DN[deck/numbers.json]
  P -->|Playwright| SH[deck/screenshots]
  DN --> B[deck/build_deck.py<br/>official template] --> PDF[SARATHI-X6_Round2.pdf]
  SH --> B
```

## Principles

- **Deterministic numbers, bounded AI.** Every number comes from pure, tested functions. `/api/explain` only rewords a decision's facts, and `lib/engine/guard.ts` rejects any output containing a number that isn't in those facts.
- **One source of truth.** Python and TypeScript read the same exported JSON, and a pytest checks the two match.
- **Deck = code output.** Slide numbers come from `deck/numbers.json`, which the same engine writes, and screenshots come from the production URL.

## Testing

| Suite | What it checks |
|---|---|
| `web/tests/tco.test.ts` | Round-1 reproduction, TCO invariants (components sum, residual subtracted, subsidy one-for-one), EMI, break-even, tornado |
| `web/tests/physics.test.ts` | DC power/C-rate limits, EV range, 500+ km, 70% EV feasibility |
| `web/tests/scoring-market.test.ts` | EREV wins mixed duty, BEV wins city-only, CNG wins upfront; market sums |
| `web/tests/sim.test.ts` | Determinism, paid + dead + charge km = total, revenue = paid km × fare, robustness over 10 seeds, explanations use fact numbers only |
| `model/tests/test_model.py` | YAML ↔ JSON drift, market parity, generator determinism, health model detection |
