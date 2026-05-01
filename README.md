# QubitOn API — Node.js SDK

TypeScript / Node.js client for the [QubitOn API](https://www.qubiton.com). 45 typed methods covering address validation, tax ID verification (live + format-only), bank account checks, sanctions screening, PEP screening, risk analytics, corporate hierarchy, ESG scoring, healthcare identifiers, and more across 250+ countries. 16 deprecated alias methods are also kept for backwards compatibility.

## Installation

```bash
npm install @qubiton/sdk
```

## Quick Start

```typescript
import { QubitOnClient } from '@qubiton/sdk';

const client = new QubitOnClient({ apiKey: 'YOUR_API_KEY' });

const result = await client.validateAddress({
  addressLine1: '123 Main St',
  city: 'New York',
  state: 'NY',
  postalCode: '10001',
  country: 'US',
});

console.log(result.address1, result.city, result.country?.countryISO2);
```

## Authentication

### API key (recommended)

The API key is sent in the lowercase `apikey` header.

```typescript
const client = new QubitOnClient({ apiKey: 'YOUR_API_KEY' });
```

### OAuth (key + secret)

The QubitOn OAuth endpoint is non-standard: it accepts a JSON body
`{ "key": "...", "secret": "..." }` and returns
`{ "token": "...", "expiresInSeconds": N, "subscriptionName": "..." }`.
Tokens are cached in process and refreshed automatically. On a 401, the
client invalidates the cached token and retries the request once before
throwing.

```typescript
const client = new QubitOnClient({
  clientId: 'your-key',
  clientSecret: 'your-secret',
  // optional: tokenUrl: 'https://api.qubiton.com/api/oauth/token',
});
```

## Examples

### Tax ID validation

```typescript
const tax = await client.validateTax({
  identityNumber: '123456789',
  identityNumberType: 'EIN',
  country: 'US',
  entityName: 'Acme Corp',
});
console.log(tax.taxValid, tax.registeredName);
```

### Format-only tax check (no authority lookup)

```typescript
const fmt = await client.validateTaxFormat({
  identityNumber: 'GB123456789',
  identityNumberType: 'VAT',
  countryIso2: 'GB',
});
console.log(fmt.isValid, fmt.formatMatch, fmt.checksumPass);
```

### Sanctions / PEP screening

```typescript
const hit = await client.checkSanctions({
  companyName: 'Acme Corp',
  country: 'US',
});
console.log(hit.isMatch, hit.score);

const pep = await client.screenPEP({ name: 'Jane Doe', country: 'GB' });
console.log(pep.persons?.length);
```

### Bank account validation

```typescript
const bank = await client.validateBankAccount({
  country: 'GB',
  bankNumberType: 'IBAN',
  iban: 'GB29NWBK60161331926819',
  bankAccountHolder: 'Acme Corp',
});
console.log(bank.bankName, bank.swiftCode);
```

### Cancellation & timeouts

Every method takes an optional `RequestOptions` with an `AbortSignal`:

```typescript
const ctrl = new AbortController();
setTimeout(() => ctrl.abort(), 5_000);

const addr = await client.validateAddress(
  { country: 'US', addressLine1: '123 Main St', city: 'NY', state: 'NY', postalCode: '10001' },
  { signal: ctrl.signal },
);
```

## Methods (45)

### Core Validation

| Method | Endpoint |
|--------|----------|
| `validateAddress()` | `POST /api/address/validate` |
| `validateTax()` | `POST /api/tax/validate` |
| `validateTaxFormat()` | `POST /api/tax/format-validate` |
| `validateBankAccount()` | `POST /api/bank/validate` |
| `validateBankPro()` | `POST /api/bankaccount/pro/validate` |
| `validateIban()` | `POST /api/iban/validate` |
| `validateEmail()` | `POST /api/email/validate` |
| `validatePhone()` | `POST /api/phone/validate` |
| `lookupBusinessRegistration()` | `POST /api/businessregistration/lookup` |

### Compliance

| Method | Endpoint |
|--------|----------|
| `validatePeppol()` | `POST /api/peppol/validate` |
| `checkSanctions()` | `POST /api/prohibited/lookup` |
| `screenPEP()` | `POST /api/pep/lookup` |
| `checkDirectors()` | `POST /api/disqualifieddirectors/validate` |
| `checkEPAProsecution()` | `POST /api/criminalprosecution/validate` |
| `lookupEPAProsecution()` | `POST /api/criminalprosecution/lookup` |
| `checkHealthcareExclusion()` | `POST /api/providerexclusion/validate` |
| `lookupHealthcareExclusion()` | `POST /api/providerexclusion/lookup` |

### Risk & Financial

| Method | Endpoint |
|--------|----------|
| `checkBankruptcyRisk()` | `POST /api/risk/lookup` |
| `lookupCreditScore()` | `POST /api/risk/lookup` |
| `lookupFailRate()` | `POST /api/risk/lookup` |
| `assessEntityRisk()` | `POST /api/entity/fraud/lookup` |
| `lookupCreditAnalysis()` | `POST /api/creditanalysis/lookup` |

### ESG & Cybersecurity

| Method | Endpoint |
|--------|----------|
| `lookupESGScore()` | `POST /api/esg/Scores` |
| `domainSecurityReport()` | `POST /api/itsecurity/domainreport` |
| `checkIPQuality()` | `POST /api/ipquality/validate` |

### Corporate Structure

| Method | Endpoint |
|--------|----------|
| `lookupBeneficialOwnership()` | `POST /api/beneficialownership/lookup` |
| `lookupCorporateHierarchy()` | `POST /api/corporatehierarchy/lookup` |
| `lookupDUNS()` | `POST /api/duns-number-lookup` |
| `lookupHierarchy()` | `POST /api/company/hierarchy/lookup` |

### Industry Specific

| Method | Endpoint |
|--------|----------|
| `validateNPI()` | `POST /api/nationalprovideridentifier/validate` |
| `validateMedpass()` | `POST /api/medpass/validate` |
| `lookupDOTCarrier()` | `POST /api/dot/fmcsa/lookup` |
| `validateIndiaIdentity()` | `POST /api/inidentity/validate` |
| `validateCertification()` | `POST /api/certification/validate` |
| `lookupCertification()` | `POST /api/certification/lookup` |
| `lookupBusinessClassification()` | `POST /api/businessclassification/lookup` |

### Financial Operations

| Method | Endpoint |
|--------|----------|
| `analyzePaymentTerms()` | `POST /api/paymentterms/validate` |
| `lookupExchangeRates()` | `POST /api/currency/exchange-rates/{baseCurrency}` (**internal endpoint**) |

> `lookupExchangeRates()` calls an endpoint marked
> `[ApiExplorerSettings(IgnoreApi = true)]` on the server — it is internal
> and **not part of the public API contract**. The shape and availability
> may change without notice. Use at your own risk; this method is marked
> `@deprecated` for the same reason.

### Ariba

| Method | Endpoint |
|--------|----------|
| `lookupAribaSupplier()` | `POST /api/aribasupplierprofile/lookup` |
| `validateAribaSupplier()` | `POST /api/aribasupplierprofile/validate` |

### Other

| Method | Endpoint |
|--------|----------|
| `identifyGender()` | `POST /api/genderize/identifygender` |

### Continuous Screening / Bulk

| Method | Endpoint | Notes |
|--------|----------|-------|
| `screenContinuous()` | `POST /api/continuous-screening/screen` | Server-side stub (501) — present for SDK parity, marked `@deprecated` |
| `checkBulkStatus()` | `POST /api/bulkstatus/check` | Returns status for a previously submitted bulk job |

### Reference

| Method | Endpoint |
|--------|----------|
| `getSupportedTaxFormats()` | `GET /api/tax/format-validate/countries` |
| `getPeppolSchemes()` | `GET /api/peppol/schemes` |

> Reference and risk endpoints (`getSupportedTaxFormats`, `getPeppolSchemes`,
> `lookupCreditScore`, `checkBankruptcyRisk`, `lookupFailRate`,
> `lookupESGScore`, `lookupExchangeRates`) return JSON arrays at the top
> level — their typed return is `T[]`, not an object with numeric keys.

## Error Handling

The SDK throws a typed exception hierarchy. Catch `QubitonError` to handle any
SDK-thrown error, or catch a more specific subclass.

```typescript
import {
  QubitOnClient,
  QubitonAuthError,
  QubitonNotFoundError,
  QubitonRateLimitError,
  QubitonServerError,
  QubitonValidationError,
  QubitonError,
} from '@qubiton/sdk';

const client = new QubitOnClient({ apiKey: 'YOUR_API_KEY' });

try {
  await client.validateAddress({ country: 'US', addressLine1: '123 Main St' });
} catch (err) {
  if (err instanceof QubitonRateLimitError) {
    console.log(`rate limited; retry after ${err.retryAfter}s`);
  } else if (err instanceof QubitonAuthError) {
    console.log('auth failed — check api key or oauth credentials');
  } else if (err instanceof QubitonNotFoundError) {
    console.log('resource not found');
  } else if (err instanceof QubitonValidationError) {
    console.log(`bad request: ${err.message}`);
  } else if (err instanceof QubitonServerError) {
    console.log(`server error ${err.status}: ${err.message}`);
  } else if (err instanceof QubitonError) {
    console.log(`api error [${err.status}]: ${err.message}`);
  }
}
```

| Status | Exception |
|-------:|-----------|
| 401, 403 | `QubitonAuthError` |
| 404 | `QubitonNotFoundError` |
| 400, 422, 4xx | `QubitonValidationError` |
| 429 | `QubitonRateLimitError` (with `.retryAfter` in seconds) |
| 5xx | `QubitonServerError` (with `.retryAfter` if present) |
| timeout | `QubitonTimeoutError` (per-call deadline expired) |
| caller-aborted | `QubitonAbortError` (caller-supplied `AbortSignal` aborted the request) |
| network / parse | `QubitonError` |

All response objects also expose a `raw` property containing the full decoded
JSON, so fields not yet promoted to typed properties are still accessible.

### Retries

The client retries automatically on 408 / 429 / 5xx and on network errors,
using exponential backoff with ±25% jitter (capped at 30 seconds). The
`Retry-After` header is honoured in both delta-seconds and HTTP-date
formats. Other 4xx responses are terminal.

When using OAuth, a single 401 triggers a token refresh and one retry before
the error is thrown — this transparently recovers from out-of-band token
rotation.

## Configuration

```typescript
const client = new QubitOnClient({
  apiKey: 'YOUR_API_KEY',
  baseUrl: 'https://api.qubiton.com', // default
  timeout: 30_000,                    // ms, default 30 000
  maxRetries: 3,                      // default 3
});
```

## Requirements

- Node.js 18+ (uses built-in `fetch` and `AbortSignal`)
- Zero runtime dependencies

## MCP Protocol Support

This API is also available as a native [Model Context Protocol](https://modelcontextprotocol.io) server.

| Category | Count | Description |
|----------|-------|-------------|
| MCP Tools | 42 | 1:1 mapped to API endpoints — same auth, rate limits, plan access |
| MCP Prompts | 20 | Multi-tool workflow templates (onboarding, compliance, risk, payment) |
| MCP Resources | 7 | Reference datasets (tool inventory, risk categories, country coverage) |

- [MCP Manifest](https://mcp.qubiton.com/.well-known/mcp.json)
- [Resource Content](https://mcp.qubiton.com/api/portal/mcp/resources/{name})

## Getting an API key

1. Sign up at [www.qubiton.com](https://www.qubiton.com/auth/register)
2. Navigate to Dashboard → API Keys
3. Copy your API key

## License

MIT
