
//#region dist/esm/utils/internal-operation-conflict-domains.js
const FULL_DOCUMENT_REPLACEMENT_CONFLICT_DOMAINS = Object.freeze([
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
const RASTER_REPLACEMENT_CONFLICT_DOMAINS = Object.freeze([
	"document",
	"base-image",
	"geometry",
	"raster",
	"overlay",
	"state"
]);
const STATE_LOAD_CONFLICT_DOMAINS = Object.freeze([
	"document",
	"base-image",
	"geometry",
	"raster",
	"overlay",
	"state"
]);

//#endregion
Object.defineProperty(exports, 'FULL_DOCUMENT_REPLACEMENT_CONFLICT_DOMAINS', {
  enumerable: true,
  get: function () {
    return FULL_DOCUMENT_REPLACEMENT_CONFLICT_DOMAINS;
  }
});
Object.defineProperty(exports, 'GEOMETRY_MUTATION_CONFLICT_DOMAINS', {
  enumerable: true,
  get: function () {
    return GEOMETRY_MUTATION_CONFLICT_DOMAINS;
  }
});
Object.defineProperty(exports, 'RASTER_REPLACEMENT_CONFLICT_DOMAINS', {
  enumerable: true,
  get: function () {
    return RASTER_REPLACEMENT_CONFLICT_DOMAINS;
  }
});
Object.defineProperty(exports, 'STATE_LOAD_CONFLICT_DOMAINS', {
  enumerable: true,
  get: function () {
    return STATE_LOAD_CONFLICT_DOMAINS;
  }
});
//# sourceMappingURL=internal-operation-conflict-domains-CSawOGVt.cjs.map