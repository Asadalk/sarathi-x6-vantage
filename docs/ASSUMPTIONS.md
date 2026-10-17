# Assumptions

The single source of truth is [`model/assumptions.yaml`](../model/assumptions.yaml). Every scalar has a `value`, a `unit`, and either a `src` (an ID in [SOURCES.md](SOURCES.md)) or a `why` rationale. The live, browsable version is the app's [`/assumptions`](https://sarathi-x6-vantage.vercel.app/assumptions) page, which also shows which pages use each input.

## The ones that matter most (from the tornado on `/tco`)

| Input | Value | Basis |
|---|---|---|
| CNG price | ₹85/kg | S5/S6: Delhi ₹86.98, Mumbai ₹89 (2026); held flat in real terms |
| km per day | 210 (before refuel losses) | Double-shift ride-hail duty; tuned to reproduce the Round-1 CNG baseline |
| SARATHI price | ₹11.8 L | CNG MPV ₹10.5 L (Ertiga Tour CNG ≈ ₹10.97 L, S22) + ~₹1.3 L for the 24 kWh LFP pack (S18: $81/kWh in 2025, lower by 2035), motor and generator |
| SARATHI EV share of km | 70% | Round-1 planning assumption; the simulator shows urban km are almost all EV |
| Depot / public DC tariff | ₹6.0 / ₹13 per kWh | Depot: commercial EV tariff + solar (assumption, state tariffs not verified). DC: S7/S8 ₹15–26 today, fleet-negotiated 2035 rate |
| Residual after 5 yr | 27% SARATHI / 18% CNG | Lower wear and SOH telematics support EV resale; the Conservative preset tests 20% |
| Queue minutes / day | CNG 40, SARATHI 20, BEV 60 (mixed duty) | CNG station queues; BEV mid-shift DC with highway duty |

## What is synthetic

- Simulator demand (`model/synth_telematics.py → trip_logs`), city layout, and request stream.
- Fleet health telematics (`fleet_health`), with four injected faults.

Both generators are seeded and deterministic.
