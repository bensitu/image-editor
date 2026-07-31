//#region dist/esm/utils/internal-operation-conflict-domains.js
const DOCUMENT_WIDE_MUTATION_CONFLICT_DOMAINS = Object.freeze([
	"document",
	"base-image",
	"geometry",
	"raster",
	"overlay",
	"state"
]);
const GEOMETRY_MUTATION_CONFLICT_DOMAINS = Object.freeze([
	"document",
	"base-image",
	"geometry",
	"overlay",
	"state"
]);
const PERSISTENT_OVERLAY_MUTATION_CONFLICT_DOMAINS = Object.freeze([
	"document",
	"overlay",
	"selection",
	"state"
]);
const OVERLAY_AUTHORING_SESSION_CONFLICT_DOMAINS = Object.freeze([
	"overlay",
	"selection",
	"state"
]);

//#endregion
Object.defineProperty(exports, 'DOCUMENT_WIDE_MUTATION_CONFLICT_DOMAINS', {
  enumerable: true,
  get: function () {
    return DOCUMENT_WIDE_MUTATION_CONFLICT_DOMAINS;
  }
});
Object.defineProperty(exports, 'GEOMETRY_MUTATION_CONFLICT_DOMAINS', {
  enumerable: true,
  get: function () {
    return GEOMETRY_MUTATION_CONFLICT_DOMAINS;
  }
});
Object.defineProperty(exports, 'OVERLAY_AUTHORING_SESSION_CONFLICT_DOMAINS', {
  enumerable: true,
  get: function () {
    return OVERLAY_AUTHORING_SESSION_CONFLICT_DOMAINS;
  }
});
Object.defineProperty(exports, 'PERSISTENT_OVERLAY_MUTATION_CONFLICT_DOMAINS', {
  enumerable: true,
  get: function () {
    return PERSISTENT_OVERLAY_MUTATION_CONFLICT_DOMAINS;
  }
});
//# sourceMappingURL=internal-operation-conflict-domains-Cx-QNq29.cjs.map