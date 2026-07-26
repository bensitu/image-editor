# Plugin package template

This independently packable template demonstrates a typed `PluginRef`, manifest
version domains, a required Capability, validated configuration, disposable
ownership, public-only imports, and peer dependency isolation.

TypeScript emits the ESM JavaScript and declarations, then Rolldown bundles the
CommonJS entry while keeping Image Editor and Fabric external as peer-owned
runtimes.

```bash
npm install
npm run build
npm test
npm pack --dry-run
```

Replace the package identity and API, then add the applicable public Conformance
Kit adapters from `@bensitu/image-editor/testing`. A full report must not treat
`NOT_AVAILABLE` as success; provide package, bundle, state, transaction,
multi-instance, and persistent-kind evidence for every responsibility the
Plugin claims.
