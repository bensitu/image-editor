# @bensitu/image-editor-codemod

Conservative source migrations for applications moving to the current Image Editor Core and
Plugin APIs. The package rewrites only statically recognizable integrations and reports ambiguous
patterns without silently changing them.

```bash
npx @bensitu/image-editor-codemod migrate src --dry-run
npx @bensitu/image-editor-codemod migrate src --diff
npx @bensitu/image-editor-codemod migrate src --write --report codemod-report.json
```

`--dry-run` and `--diff` never write source files. `--write` is the default and replaces each changed file atomically. If a later write fails, completed writes are restored from their original contents. Exit
code `2` means unresolved manual work remains; exit code `1` in a read-only mode means safe changes
are available. The JSON report records every file, change, and unresolved location.

The tool requires an explicit Fabric module in migrated constructors. Dynamic property access,
runtime-generated or spread-heavy options, Facade subclasses, reflection, callback wiring,
and non-Core DOM maps are reported for manual migration.

Symbolic links are skipped and included in the report. Source files retain their UTF-8 byte order
mark and line endings. Use `--` before source paths beginning with a dash, and `--report=--result.json`
for a report filename beginning with a dash. Report files are replaced atomically and must not be
symbolic links. Review `--dry-run` output before applying changes to a working tree.
