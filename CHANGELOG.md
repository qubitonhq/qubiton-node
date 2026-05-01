# Changelog

All notable changes to this project will be documented in this file. Format
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning
follows [SemVer](https://semver.org/).

## [1.1.0] — 2026-05-01

First release published from the public `qubitonhq/qubiton-node` repo.

### Fixed
- **`ValidationResult` type was wrong.** The exported interface was previously
  shaped like an inner `additionalInfo[]` item (`{ key, value, description }`),
  but the field `validationResults?: ValidationResult[]` on every response
  returns the *outer* wrapper from .NET's `ValidationResults` class — with
  fields like `validationType`, `validationPass`, `additionalInfo[]`, etc.
  Anyone reading `r.validationResults?.[0]?.key` was always seeing
  `undefined`. The corrected `ValidationResult` now matches the wire shape;
  the inner key/value items get the new `AppendInfo` interface.

### Added
- `AppendInfo` interface representing the inner key/value items inside a
  `ValidationResult.additionalInfo` array. Exported from the package index.

### Changed
- Removed third-party data-provider name from a comment in `models.ts`.

### Notes
- This is a semantically-but-not-syntactically breaking change for
  `ValidationResult`: type names are unchanged, but the meaning shifted.
  Consumers reading the previous (incorrect) shape were getting nothing
  useful anyway.

## [1.0.0] — 2026-04-27

Initial public release of `@qubiton/sdk`. Source previously lived in the
internal apexAnalytix/smartvm monorepo.

### Added
- Typed client (`QubitOnClient`) covering 60+ QubitOn API endpoints
- OAuth2 token manager with auto-refresh
- Retry-with-exponential-backoff and `Retry-After` honoring
- Typed errors (`QubitonAuthError`, `QubitonRateLimitError`,
  `QubitonNotFoundError`, `QubitonServerError`, etc.)
- Full TypeScript types for requests and responses
- ESM + CJS dual output
