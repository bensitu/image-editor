# Fabric versus Framework redaction

This comparison runs one shared scenario against two public implementations:

- `pure-fabric` owns canvas state, transaction rollback, History, Snapshot, and
  cleanup directly.
- `image-editor-framework` composes the public Redaction Preset and calls its
  typed Feature APIs.

The scenario loads an image, rotates it, adds a mask, undoes the mask, captures
state, verifies a failed load does not mutate state, and disposes all resources.
Build the maintained example from the repository root:

```bash
npm run check:examples
```

See [comparison-report.md](comparison-report.md) for the ownership trade-offs.
The example does not pin comparative metrics as a release Gate.
