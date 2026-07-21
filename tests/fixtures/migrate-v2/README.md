# Frozen snapshot fixtures

These synthetic, non-user fixtures reproduce the public snapshot schema frozen at:

- branch: `legacy/v2`
- commit: `ae8c34347d6c849f204332038e85e046e917f05e`
- tree: `3042a8c661fcb5bba57aa1339f0fa2891922a271`

The fixtures were derived from the frozen `src/core/state-serializer.ts` contract. They contain no private or proprietary data. The committed-raster fixture represents Crop/Mosaic output after the operation has already been baked into the Base Image; transient sessions and History records are intentionally absent from this format.
