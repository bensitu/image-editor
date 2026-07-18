# Redaction comparison report

This report compares the two executable adapters in this directory. It does
not claim that a purpose-built Fabric adapter and a general Plugin framework
provide the same breadth of behavior. Both run the exact shared scenario; the
differences below explain what each adapter owns.

## Reproduce

From the repository root:

```bash
npm run test:comparison
npm run check:comparison
```

The measurement command bundles each adapter as ESM, minifies it, compresses it
with gzip level 9, and keeps the shared `fabric` peer external. Application glue
LOC counts non-blank, non-comment physical lines in each adapter; the common
scenario is excluded from both counts. The checked ceilings live in
`config/release/framework-comparison.json`.

## Measured result

| Metric                      | Pure Fabric | Image Editor Framework |
| --------------------------- | ----------- | ---------------------- |
| Application glue LOC        | 122         | 39                     |
| Development bundle          | 4,054 bytes | 666,230 bytes          |
| Minified bundle             | 1,667 bytes | 328,434 bytes          |
| Minified gzip               | 893 bytes   | 79,632 bytes           |
| Modules, excluding Fabric   | 1           | 95                     |
| Direct comparison scenarios | 1           | 1                      |
| Fabric bundled modules      | 0           | 0                      |
| Failed-load mutation count  | 0           | 0                      |

The framework measurement intentionally includes the complete Redaction Preset,
including Filters, Crop, Mosaic, Overlay State, and their coordination code even
though the shared scenario uses only Transform, History, and Mask. The pure
Fabric number contains only the narrow adapter. Treat the 78,739-byte gzip
difference as the cost of that broader composition and its contracts, not as a
like-for-like mask primitive overhead. Applications can choose direct Plugin
composition when they do not need the complete Preset.

## Ownership comparison

| Responsibility             | Pure Fabric                                                    | Image Editor Framework                                             |
| -------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------ |
| Rollback logic             | Captures Fabric JSON and restores it in the image-load catch.  | Core validates and runs image loading as a document transaction.   |
| Coordinate synchronization | Places the image and mask with explicit canvas coordinates.    | Transform and Overlay/Mask participants coordinate geometry.       |
| History logic              | Owns a string stack, truncation, and `loadFromJSON()` restore. | History Plugin records committed document and Overlay mutations.   |
| Snapshot logic             | Exposes unversioned raw Fabric JSON for this adapter.          | Core emits a validated, versioned Snapshot with Plugin slices.     |
| Dispose logic              | Clears local state and disposes one Fabric Canvas.             | Core disposes Feature APIs, registrations, listeners, then canvas. |
| Failure proof              | Shared scenario compares Snapshot bytes after rejected load.   | The same shared scenario compares current Snapshot bytes.          |

## Adding another persistent Overlay kind

With pure Fabric, the application must define object identity, serialization
and validation, coordinate updates for transforms, History capture/restore,
export behavior, selection rules, failure rollback, and disposal. The small
adapter can remain appropriate when the object is local and those contracts are
not needed.

With the framework, a Plugin registers a namespaced persistent kind, Codec,
geometry participant, and any export contribution through public Capabilities.
That has more up-front contract work than constructing a Fabric object, but the
existing Snapshot, History, rollback, operation, and lifecycle authorities stay
shared. The [Watermark reference Plugin](../reference-plugins/watermark) is the
executable example of this extension path.

## Limits of the proof

The pure adapter accepts image data URLs, uses one base image and rectangle-mask
kind, and implements a linear in-memory undo stack. It does not reproduce Core
resource limits, schema migration, concurrent-operation rules, Plugin state,
export contribution, or multi-instance conformance. The framework adapter uses
those general facilities but consequently ships substantially more code. The
report keeps these differences visible so neither implementation is optimized
away merely to improve the comparison.
