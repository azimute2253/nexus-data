# Parity Validation Report

**Date:** 2026-03-22T23:54:27.298Z
**Tolerance:** R$ 1.00/asset
**Fixture:** /home/centr/Projects/nexus-data/tests/fixtures/spreadsheet-reference.json

## ✅ scenario-1: Reference scenario 1: R$12,000 contribution with real portfolio data (FIIs overweight)

- **Contribution:** R$ 12.000,00
- **Total Spent:** R$ 11948.69
- **Total Remainder:** R$ 51.31
- **Assets:** 18/18 match

| Ticker | Allocated (R$) | Est. Cost (R$) | Shares | Status |
|--------|---------------|----------------|--------|--------|
| ROMP | 1058.47 | 1058.47 | 105847.4020 | ✅ PASS |
| OURO | 900.93 | 900.93 | 2.7301 | ✅ PASS |
| IPCA+ | 640.05 | 640.05 | 0.2063 | ✅ PASS |
| SELIC | 457.18 | 457.18 | 0.0586 | ✅ PASS |
| BTLG11 | 0.00 | 0.00 | 0.0000 | ✅ PASS |
| XPLG11 | 0.00 | 0.00 | 0.0000 | ✅ PASS |
| HGLG11 | 0.00 | 0.00 | 0.0000 | ✅ PASS |
| VALE3 | 2806.12 | 2776.68 | 36.0000 | ✅ PASS |
| BBAS3 | 1403.06 | 1381.19 | 59.0000 | ✅ PASS |
| PETR4 | 0.00 | 0.00 | 0.0000 | ✅ PASS |
| VOO | 1154.97 | 1154.97 | 0.3609 | ✅ PASS |
| QQQM | 1010.60 | 1010.60 | 0.7834 | ✅ PASS |
| SCHD | 866.23 | 866.23 | 5.3803 | ✅ PASS |
| VNQ | 0.00 | 0.00 | 0.0000 | ✅ PASS |
| BND | 321.96 | 321.96 | 0.8301 | ✅ PASS |
| IAU | 321.96 | 321.96 | 0.6707 | ✅ PASS |
| VGK | 635.08 | 635.08 | 1.8145 | ✅ PASS |
| VPL | 423.39 | 423.39 | 1.0585 | ✅ PASS |

## ✅ scenario-2: Reference scenario 2: R$5,000 contribution with simplified 3-type portfolio

- **Contribution:** R$ 5.000,00
- **Total Spent:** R$ 4780.26
- **Total Remainder:** R$ 219.74
- **Assets:** 7/7 match

| Ticker | Allocated (R$) | Est. Cost (R$) | Shares | Status |
|--------|---------------|----------------|--------|--------|
| VALE3 | 215.38 | 154.26 | 2.0000 | ✅ PASS |
| PETR4 | 134.62 | 94.00 | 2.0000 | ✅ PASS |
| CSMG3 | 150.00 | 108.40 | 2.0000 | ✅ PASS |
| BTLG11 | 1260.00 | 1245.60 | 12.0000 | ✅ PASS |
| XPLG11 | 0.00 | 0.00 | 0.0000 | ✅ PASS |
| HGLG11 | 840.00 | 778.00 | 5.0000 | ✅ PASS |
| CDB-120 | 2400.00 | 2400.00 | 2.4000 | ✅ PASS |

## ✅ scenario-3: Reference scenario 3: R$20,000 contribution with 2-type portfolio and edge allocation

- **Contribution:** R$ 20.000,00
- **Total Spent:** R$ 19934.72
- **Total Remainder:** R$ 65.28
- **Assets:** 5/5 match

| Ticker | Allocated (R$) | Est. Cost (R$) | Shares | Status |
|--------|---------------|----------------|--------|--------|
| VALE3 | 9500.00 | 9486.99 | 123.0000 | ✅ PASS |
| BBAS3 | 5937.50 | 5922.73 | 253.0000 | ✅ PASS |
| PETR4 | 3562.50 | 3525.00 | 75.0000 | ✅ PASS |
| CDB-120 | 583.33 | 583.33 | 0.5833 | ✅ PASS |
| LCI-90 | 416.67 | 416.67 | 0.8333 | ✅ PASS |

## ✅ Determinism Check

Two identical runs produced bit-for-bit identical results.

## ✅ Zero Contribution Check

All allocations are R$0 when contribution is R$0.

---

## ✅ OVERALL: PASS — All parity checks passed.
