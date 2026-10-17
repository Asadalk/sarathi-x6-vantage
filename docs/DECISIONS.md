# Decision log

| # | Decision | Why |
|---|---|---|
| 1 | All money in **real 2026 rupees**, used as 2035 planning values | We avoid inventing an inflation path. Today's sourced prices (CNG ₹87–89/kg, DC ₹15–26/kWh) anchor the 2035 assumptions directly. |
| 2 | **One YAML** (`model/assumptions.yaml`) exported verbatim to `web/public/data/assumptions.json` | The Python and TypeScript engines can't drift; `model/tests/test_model.py` fails if they do. |
| 3 | TCO uses **cash purchase** by default | Matches the Round-1 basis. A financing preset is provided. |
| 4 | Downtime counted as a **TCO cost** (lost operator contribution, ₹2,000/day) and as **lost km** | Uptime is the core of the SARATHI argument, so it has to show up in both cost and revenue. |
| 5 | **Refuel/charge queue minutes** per powertrain, interpolated by duty mix | This is what lets pure BEV honestly win in city-only duty but lose with highway duty. |
| 6 | Driver = **revenue share** (49% of the fare after commission) | Simple and transparent, and it makes the driver benefit directly from more paid km. |
| 7 | Fare ₹36 per paid km | At ₹33 the CNG baseline operator makes a loss, which isn't credible. ₹36 matches an XL-class effective yield including base fare and per-minute charges. |
| 8 | Simulator: both policies get the **same request stream**; baseline realism (cruising when idle, airport pickup radius, return fares) was set *before* tuning VANTAGE | A fair comparison. Policy parameters were tuned only for VANTAGE (repositioning hysteresis, range-extender SOC threshold); see RECONCILIATION.md. |
| 9 | Simulator demand comes from a **trained forecast** (Poisson GBM on synthetic logs), while actual requests are sampled from the hidden ground truth | VANTAGE gets a realistic, imperfect forecast instead of perfect information. |
| 10 | Presentation headline uses the **simulated 62% → 72%** rather than the Round-1 65% → 72% | Honesty: the 7–10 point gain reproduces, but our toy city's baseline is lower. TCO keeps 65/72 as the planning assumption. |
| 11 | LLM explanation: `claude-opus-5-5`, low effort, server-side refusal fallbacks enabled (`fallbacks: "default"`), plus a **numbers-in-facts guard** | The model can't introduce numbers. With no key, a deterministic template is used and the app works fully. |
| 12 | No database, no auth, client-side engine; one serverless route | Free tier, fast, and works offline once loaded. |
| 13 | Vehicle illustration is an **original SVG** in the app; our Round-1 presentation used our own render | No copyrighted car photos. |
| 14 | Git author email set to the GitHub **noreply** address for this repo | Keeps team email addresses out of public history. |
| 15 | Deployed on **Vercel** (project `sarathi-x6-vantage`) and never on GitHub Pages | Per brief. |
