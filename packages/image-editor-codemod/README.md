# @bensitu/image-editor-codemod

Conservative source migrations for applications moving to the current Image Editor Core and
Plugin APIs. The package rewrites only statically recognizable integrations and reports ambiguous
patterns without silently changing them.

```bash
npx @bensitu/image-editor-codemod v2-to-v3 src --dry-run
npx @bensitu/image-editor-codemod v2-to-v3 src --diff
npx @bensitu/image-editor-codemod v2-to-v3 src --write --report codemod-report.json
```

`--dry-run` and `--diff` never write source files. `--write` applies safe edits atomically. Exit
code `2` means unresolved manual work remains; exit code `1` in a read-only mode means safe changes
are available. The JSON report records every file, change, and unresolved location.

The tool requires an explicit Fabric module in migrated constructors. Dynamic property access,
runtime-generated or spread-heavy options, former Facade subclasses, reflection, callback wiring,
and non-Core DOM maps are reported for manual migration.
