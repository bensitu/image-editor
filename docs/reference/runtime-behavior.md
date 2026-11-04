# Runtime behavior

## State and image resources

Public snapshots accept validated JSON data and registered Plugin state. Mementos
use immutable, validated state values; custom class instances, `Date`, `Map`,
`Set`, and mutable binary buffers are not supported state references. A Plugin
must encode such values into its documented state schema before capture.

Image data URLs must identify a supported image type and expose readable image
dimensions. Base64 whitespace is ignored when measuring and inspecting the
payload. Resource limits cover decoded image dimensions, encoded payload bytes,
and Canvas backing pixels, including display pixel density. Browser-specific
allocation limits can be lower than the configured limits; failed or unexpected
Canvas encoding results are rejected.

Image clones own their resources independently. Temporary resources are disposed
after replacement or failure. Persistent raster state uses data URLs so snapshots
remain self-contained; object URLs require a separate asset lifetime and cannot
be substituted into saved documents without managing that lifetime.

Explicit export formats must match the browser's actual encoded output. Automatic
source-format selection may accept a supported browser fallback. JPEG output uses
a white background when the background is empty or set to `transparent`.

## History and transactions

History counts shared large strings once across retained records. If a single
record exceeds the configured memory limit, the timeline is cleared to preserve
continuity with the current document. Silently omitting a change would make a
later undo restore a state that predates an unrecorded edit.

Disabling History with `clear: false` retains records while History is disabled.
Enabling from the current document starts a new timeline because changes may
have occurred while recording was disabled.

Operations resolve their targets when queued work starts. Geometry participants
that complete preparation are rolled back in reverse order if subsequent work
fails. Plugins must honor abort signals and release late results: a JavaScript
timeout cannot forcibly stop an extension's code. Committed listeners run in
subscription order and have a bounded execution window.

Call and await `disposeAsync()` to finish initialization and cleanup. Plugin
disposal can run after setup even if initialization did not complete, so setup
resources also need disposal handlers. A tool continues to enforce its active
interaction policy until its asynchronous exit completes. Overlapping tool
transitions are rejected; callers should await each transition.

## Geometry and interaction

Image coordinates use half-open bounds: `0 <= x < width` and `0 <= y < height`.
The last pixel column starts at `width - 1`; the coordinate `width` lies outside
the image. Pointer mapping converts viewport coordinates into scene coordinates
before inverting the image transform, including its containing groups.

Crop rectangles expand to an integer pixel enclosure and are checked against
minimum dimensions before rendering. Crop and Mosaic failures close their
sessions as described in their API references. Annotation commit failures retain
the editing draft for correction or retry.

The `cover` layout fills the available space up to the image's natural size; it
does not enlarge a small image. Mask labels follow mask rotation. Mosaic brush
blocks follow each brush stamp. These behaviors are part of the current rendering
model.

Keyboard shortcuts follow `KeyboardEvent.key`, so undo uses the key labeled Z
in the active Latin layout. Non-Latin character events use `KeyboardEvent.code`
as a fallback for undo and redo. Handled, repeated, and composition key events
are ignored, and editable elements are excluded unless explicitly enabled.
Configure a keyboard target for the editor that should receive commands when
hosting several editors.

## Plugin composition and tooling

An absent optional Filters provider means there are no Filter visuals to bake.
An installed but incompatible provider is an integration error and is rejected.
Preset factories require the API versions they consume; new incompatible API
versions need an explicit adapter or a matching preset update.

Plugin permissions control access through the SDK. Plugins execute in the host
JavaScript environment and are trusted application code, rather than isolated
security principals.

The source migration CLI writes changes by default. Use `--dry-run` and `--diff`
to review changes first. Writes preserve byte order marks and line endings, skip
symbolic links, and restore completed files if a later write fails. Ambiguous
constructors are reported for manual migration.

The package runtime supports Node.js 20 and later; repository development uses
the newer toolchain version documented in the contributor guide. The publishing
workflow uses [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/),
which requires a matching trusted publisher configuration on the npm package.
