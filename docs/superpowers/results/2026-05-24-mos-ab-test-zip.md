# A/B Test (zip): legacy MoS vs computed MoS

**Date:** 2026-05-24
**Geo level:** zip
**Zero-crossing:** 33.4 (v4 default for this geo)
**Joined panel:** 1,614,110 rows (23,826 zips)
**Date range:** 2019-06-30 to 2026-03-31
**Hold constant:** sold_above_list, median_dom (legacy source)
**Swap:** months_of_supply
- A (current prod): `redfin_zip.months_of_supply`
- B (new RFDC): `redfin_dc_housing_market_zip.active_listings / homes_sold`

## Raw MoS comparison

- Spearman: **nan**
