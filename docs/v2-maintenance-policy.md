# 2.x Maintenance Policy

The official published 2.9 maintenance baseline is the `legacy/v2` branch.

Maintenance on `legacy/v2` is limited to security fixes and critical
correctness fixes for the supported 2.9 line. It does not receive the current
Plugin architecture, new Features, new Presets, or ordinary enhancements.

Maintenance releases use a separate review, verification, version, and release
process. Changes are not merged automatically from `develop`, and maintenance
commits are not merged automatically back into the current major. Any shared
fix must be reviewed and applied independently against each line's contracts.

Applications should plan migration to the current Core + Plugin APIs using the
[migration guide](./migration-from-v2.md), isolated Snapshot conversion entry,
and Codemod unresolved-report workflow. Maintenance availability does not imply
that older source integrations or Snapshots are accepted by the current Core.
