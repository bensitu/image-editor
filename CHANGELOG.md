# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Migrated codebase to TypeScript.
- Upgraded rendering engine to Fabric.js v7.

## [1.2.0] - 2026-02-24

### Added
- New `coverImageToCanvas` option, allowing images to overflow the canvas bounds while ensuring at least one side fits perfectly.

## [1.1.2] - 2026-02-19

### Changed
- In the `fitImageToCanvas` function, changed image placement alignment from centered to top-left corner for more predictable positioning.

## [1.1.1] - 2025-08-23

### Added
- Historical operation logging with support for rollback and undo operations.

## [1.0.0] - 2025-08-23

### Added
- Initial release.