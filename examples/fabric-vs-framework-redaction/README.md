# Fabric versus Framework redaction

This comparison runs one shared scenario against two public implementations:

- `pure-fabric` owns canvas state, transaction rollback, History, Snapshot, and
  cleanup directly.
- `image-editor-framework` composes the public Redaction Preset and calls its
  typed Feature APIs.

The scenario loads an image, rotates it, adds a mask, undoes the mask, captures
state, verifies a failed load does not mutate state, and disposes all resources.
Run the permanent proof and measurement from the repository root:

```bash
npm run test:comparison
npm run check:comparison
```

See [comparison-report.md](comparison-report.md) for the metric definitions and
trade-offs.
