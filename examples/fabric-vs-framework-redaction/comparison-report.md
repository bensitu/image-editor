# Redaction comparison report

This report compares the two executable adapters in this directory. It does
not claim that a purpose-built Fabric adapter and a general Plugin framework
provide the same breadth of behavior. Both run the exact shared scenario; the
differences below explain what each adapter owns.

## Scope

Both adapters remain buildable examples and use the same shared scenario. The
framework adapter intentionally includes the complete Redaction Preset, including
Filters, Crop, Mosaic, Overlay State, and their coordination code, while the pure
Fabric adapter contains only the narrow behavior required by the scenario. The
example documents that ownership tradeoff; it is not a pinned performance, line
count, or bundle-size Gate.

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
