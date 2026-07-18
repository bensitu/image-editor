# Frozen snapshot fixtures

These synthetic, non-user fixtures reproduce the public snapshot schema frozen at:

- branch: `legacy/v2.9-freeze`
- commit: `3dc43d6af4982574846203cfce201d49b97ca957`
- tree: `b68f9035aaa927bbdfc3851bbe8226140bdce203`

The fixtures were derived from the frozen `src/core/state-serializer.ts` contract. They contain no private or proprietary data. The committed-raster fixture represents Crop/Mosaic output after the operation has already been baked into the Base Image; transient sessions and History records are intentionally absent from this format.
