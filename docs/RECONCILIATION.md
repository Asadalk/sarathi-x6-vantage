# Round-1 claims vs the Round-2 model

Every Round-1 headline was re-derived from `model/assumptions.yaml` by the tested engine (`web/lib/engine/`). `web/tests/tco.test.ts`, `physics.test.ts` and `sim.test.ts` lock these results in, so if an assumption changes and a claim stops holding, CI fails.

| Round-1 claim | Model value (default assumptions) | Gap | Cause | Decision |
|---|---|---|---|---|
| 5-yr TCO, CNG baseline ₹26.9 L | ₹26.88 L | 0.0 | — | **Kept** |
| 5-yr TCO, SARATHI-X6 ₹18.2 L | ₹18.17 L | 0.0 | — | **Kept** |
| "₹8.8 L saved / vehicle" | **₹8.71 L** | −0.1 | Round-1 rounding error: 26.9 − 18.2 = 8.7 | **Corrected to ₹8.7 L** everywhere (deck slide 6 says so explicitly) |
| 32% lower TCO | 32.4% | 0 | — | **Kept** |
| ≈ ₹1.75 L / year operator saving | ₹1.74 L / year (8.71 ÷ 5) | −0.01 | Follows from the ₹8.7 L correction | **Rounded: shown as ₹1.74 L** |
| +₹0.98 L / year driver earnings | +₹0.98 L | 0 | — | **Kept** (mechanism now explicit, see below) |
| ≈ +7,000 paid km / year | +6,929 | −71 | — | **Kept** (≈ 7k) |
| Paid-km share 65% → 72% (VANTAGE) | Simulator: seed 2035 **64.3% → 74.7%**; 10-seed mean **61.7% → 72.3%**; VANTAGE ahead by ≥ 9 pts in every seed | Baseline ~3 pts lower | Our stylised city has more empty airport/intercity returns and cruising than a real metro | **Kept 65% → 72% as the TCO planning assumption**; the deck headline reports the simulated **62% → 72%** |
| 500+ km combined range | 166 km EV + 336 km CNG = **502 km** | — | 21.6 kWh usable ÷ 0.13 kWh/km; 16 kg × 21 km/kg | **Kept** |
| ~70% of urban km on EV | TCO uses 70% EV share. Simulator: 98–100% of *urban* km on EV and 78% of *all* km (VANTAGE) | — | The simulator puts highway km on the range-extender, so the urban EV share is higher than 70% | **Kept** (conservative) |
| 60 kW DC, 10–80% in ~20 min | 16.8 kWh in 20 min = **50.4 kW average = 2.1C** | — | Within 60 kW and our stated 2.5C max, but aggressive for LFP | **Kept, with the C-rate stated** on slide 5 and `/vehicle` |
| 300 L / 800 L luggage, 8-yr duty, 6+ airbags, ESC, L2-ready ADAS | Unchanged concept targets | — | Not modelled numerically | **Kept**, labelled "target" |
| Roadmap 27–29 / 30–32 / 33–35 | Unchanged | — | — | **Kept** |

## What had to be made explicit to reproduce Round 1

1. **Driver uplift mechanism.** A 7-point paid-share gain on a single shift is only about 4.5k km. Round 1's "+7,000 paid km" holds because SARATHI also has **more productive time**. It spends 20 min/day refuelling or charging instead of about 40 min in CNG queues, and has 5 instead of 12 downtime days a year. Both are explicit, editable assumptions (`queueMinPerDay`, `downtimeDays`).
2. **Driver pay model.** The driver keeps 49% of the fare after a 20% commission, which is about ₹14.1 per paid km. The fare is ₹36 per paid km, the effective XL-class yield including base fare and per-minute charges. At a ₹33 fare the CNG baseline operator would make a loss, so we chose a fare where the baseline stays viable (₹0.59 L/yr profit).
3. **Cash purchase basis.** Round 1's TCO excluded financing. Use the *Financed* preset on `/tco` (20% down, 10%, 5 years) to see the financed view; the saving stays similar because both vehicles are financed.

## Honest sensitivity

- **Conservative preset** (public DC ₹18/kWh, depot ₹7.5, CNG ₹80/kg, SARATHI EV share 60%, residual 20%): the saving falls to **₹5.8 L (22%)**.
- **Tornado** (±20% one at a time): the lowest saving is **₹6.9 L**. The biggest drivers are CNG price, km/day and SARATHI's purchase price.
- **Pure BEV** (40 kWh) has a *lower* 5-yr TCO than SARATHI (₹17.5 L vs ₹18.2 L). It loses on uptime for mixed duty and wins in 100% intra-city duty. Both the app and the deck say so.
