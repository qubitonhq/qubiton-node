/**
 * Type definitions for QubitOn API request and response payloads.
 *
 * Field names match the wire format exactly (camelCase). Field shapes are
 * derived from the canonical .NET DTOs in `smartvm.BusinessEntities` and the
 * Go SDK at `sdks/go/models.go`.
 *
 * Where the API returns rich nested objects, only the most important fields
 * are typed; the rest is preserved on the response under `raw` for callers
 * who need fields not yet promoted to first-class types.
 */

// ── Common ────────────────────────────────────────────────────────────────

/**
 * Every request can include an optional client-supplied correlation ID and
 * `requestedByClient` (a free-form identifier the .NET server requires —
 * `[Required] [StringLength(350)]`). The SDK populates `requestedByClient`
 * with its User-Agent string by default, so most callers never need to set it
 * explicitly. Override it if you want server-side analytics to attribute the
 * call to a specific application or tenant.
 */
export interface BaseRequest {
  sourceUniqueId?: string;
  /** Optional QubitOn-issued unique identifier for the entity being requested. */
  qubitOnUniqueId?: string;
  /**
   * Required by the server (max 350 chars). Defaults to the SDK User-Agent
   * (`qubiton-node-sdk/<version>`) if omitted.
   */
  requestedByClient?: string;
  /** Optional free-form application name (max 350 chars). */
  requestedByApplication?: string;
  /** Optional URL identifying the calling application (max 3000 chars). */
  requestedByApplicationUrl?: string;
  /** Optional client IP address (max 100 chars). */
  requestedByIPAddress?: string;
}

/**
 * All typed responses include `raw` so callers can access fields not yet
 * typed.
 *
 * @remarks
 * `raw` is the same object the response was decoded from — the typed fields
 * are spread onto that object in place, so `response === response.raw` is
 * `true`. This keeps memory usage to a single allocation per response.
 *
 * `raw` is typed as optional because a small number of endpoints can return
 * a JSON primitive body (e.g. a bare number or string). The SDK wraps that
 * primitive in `{ value: <primitive> }` and skips installing a self-referential
 * `raw` slot — see {@link wrap} in `client.ts` for the full reasoning.
 * For all object-shaped responses (the overwhelming majority) `raw` is
 * present and equal to the response object itself.
 */
export interface BaseResponse {
  raw?: Record<string, unknown>;
}

/** ISO 3166-1 country descriptor returned by many endpoints. */
export interface Country {
  countryName?: string;
  countryISO2?: string;
  countryISO3?: string;
  continent?: string;
  alternateCountry?: string;
}

/**
 * A single key/value enrichment item carried inside a `ValidationResult.additionalInfo`
 * array. Mirrors the .NET `AppendInfo` record on the wire.
 */
export interface AppendInfo {
  key?: string;
  value?: string;
  /** Some legacy responses also include a description alongside the key/value. */
  description?: string;
}

/**
 * One entry in a response's `validationResults[]` array. Mirrors the .NET
 * `ValidationResults` class on the wire — fields like `validationType`,
 * `validationPass`, and `additionalInfo[]` describe the outcome of a single
 * validation pass against the input.
 *
 * Note: this type was previously (incorrectly) shaped like an \`AppendInfo\`
 * (`{ key, value, description }`), which never matched what the API actually
 * returns. If you were reading `r.validationResults?.[0]?.key`, that was always
 * `undefined`; the real key/value enrichment lives in `validationResults[i].additionalInfo[]`.
 */
export interface ValidationResult {
  /** Score for this validation pass (e.g. 100 = success, 0 = fail). */
  score?: number;
  /** Source/provider-specific result code (e.g. USPS or postal-authority codes). */
  validationResultCode?: string;
  /** Original code from the upstream provider before normalization. */
  sourceResultCode?: string;
  /** Boolean outcome — `true` = passed, `false` = failed, `null` = inconclusive. */
  validationPass?: boolean | null;
  /** Human-readable description of the outcome. */
  validationDescription?: string;
  /** UTC timestamp when this validation ran (ISO 8601 string). */
  validationDate?: string;
  /** Type of validation (e.g. `"Address"`, `"Phone"`, `"Email"`, `"IpAddress"`). */
  validationType?: string;
  /** Optional sub-type for finer-grained classification. */
  validationSubType?: string;
  /** Provider-specific key/value enrichment (e.g. carrier, line type, domain age). */
  additionalInfo?: AppendInfo[];
}

// ── Address Validation ────────────────────────────────────────────────────

export interface AddressRequest extends BaseRequest {
  country: string;
  addressLine1?: string;
  addressLine2?: string;
  /** Optional. Server accepts up to addressLine8. */
  addressLine3?: string;
  addressLine4?: string;
  addressLine5?: string;
  addressLine6?: string;
  addressLine7?: string;
  addressLine8?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  companyName?: string;
  /** Full name of the requester (max 512 chars). */
  nameFull?: string;
  /** Last name of the requester (max 250 chars). */
  nameLast?: string;
  /** Type of the address (max 250 chars). */
  addressType?: string;
  /** Reference number (max 250 chars). */
  referenceNumber?: string;
  /** Phone number (max 50 chars). */
  phoneNumber?: string;
  /** Email address (max 250 chars). */
  emailAddress?: string;
  /** Whether the response should be in Latin. Default false. */
  outputInLatin?: boolean;
  /** Optional callback URL for bulk webhook notification. */
  callbackUrl?: string;
}

export interface AddressResponse extends BaseResponse {
  // Standardized address components
  addressType?: string;
  address1?: string;
  address2?: string;
  address3?: string;
  address4?: string;
  suiteNumber?: string;
  streetNumber?: string;
  city?: string;
  state?: string;
  stateName?: string;
  postalCode?: string;
  country?: Country;
  premiseType?: string;
  province?: string;
  careOf?: string;

  // Local-language address variants
  localAddress1?: string;
  localAddress2?: string;
  localAddress3?: string;
  localAddress4?: string;
  localSuiteNumber?: string;
  localStreetNumber?: string;
  localCity?: string;
  localState?: string;
  localPostalCode?: string;
  localProvince?: string;
  localPremiseType?: string;
  localCareOf?: string;
  localCountry?: string;

  // PO Box
  poBoxNumber?: string;
  poBoxCity?: string;
  poBoxState?: string;
  poBoxPostalCode?: string;
  poBoxCountry?: string;

  // Geocoding and classification
  geoCode?: string;
  inCityLimit?: string;
  isResidential?: boolean;

  // Echo of original request fields
  requestCompanyName?: string;
  requestFullName?: string;
  requestAddressLine1?: string;
  requestAddressLine2?: string;
  requestCity?: string;
  requestState?: string;
  requestPostalCode?: string;
  requestEmailAddress?: string;
  requestPhoneNumber?: string;

  preferredLanguage?: string;
  additionalInfo?: Record<string, unknown>;
  addressCodesInfo?: Record<string, unknown>[];

  validationResults?: ValidationResult[];
  sourceUniqueId?: string;
  qubitOnUniqueId?: string;
}

// ── Tax ID Validation ─────────────────────────────────────────────────────

export interface TaxValidateRequest extends BaseRequest {
  /** The tax identification number being validated. */
  identityNumber: string;
  /** Type of tax ID (e.g., "VAT", "EIN", "TIN"). Auto-detected if omitted. */
  identityNumberType?: string;
  /** ISO 3166-1 alpha-2 country code. */
  country: string;
  /** Registered entity name to match against the official record. */
  entityName?: string;
  /** Optional async callback URL for long-running validations. */
  callbackUrl?: string;
}

export interface TaxValidateResponse extends BaseResponse {
  taxValid?: boolean;
  isEntityNameMatch?: boolean | null;
  entityName?: string;
  identityNumber?: string;
  identityNumberType?: string;
  country?: string;
  registeredName?: string;
  validationResults?: ValidationResult[];
  sourceUniqueId?: string;
  qubitOnUniqueId?: string;
}

// ── Tax Format Validation ─────────────────────────────────────────────────

/**
 * Format-only tax ID validation (regex + checksum, no authority lookup).
 *
 * The .NET `TaxFormatValidationRequest` does NOT inherit from `BaseRequest`,
 * so this interface intentionally has no `requestedByClient` / `sourceUniqueId`
 * properties — sending them would either be ignored by the server or rejected
 * (depending on `DisallowUnknownFields` settings on the action). The client
 * skips its `requestedByClient` injection for this DTO.
 *
 * The wire field is `countryIso2` (not `country`); the API rejects requests
 * that send `country` for this endpoint.
 */
export interface TaxFormatValidateRequest {
  identityNumber: string;
  identityNumberType: string;
  /** ISO 3166-1 alpha-2 country code, e.g., "US", "GB", "DE". */
  countryIso2: string;
}

export interface TaxFormatValidateResponse extends BaseResponse {
  isValid?: boolean;
  formatMatch?: boolean;
  checksumPass?: boolean;
  identityNumberType?: string;
  countryIso2?: string;
  errorMessage?: string;
}

// ── Bank Account Validation ───────────────────────────────────────────────

/**
 * Required discriminator for bank validation. The wire format accepts the
 * literal strings listed below. The .NET server uses this value to pick which
 * of `accountNumber`, `iban`, `swift`, `bankCode`, or `routingNumber` is
 * required.
 */
export type BankNumberType =
  | 'IBAN'
  | 'SWIFT'
  | 'ROUTING'
  | 'BankAccount'
  | 'SortCode'
  | 'CLABE'
  | 'CBU'
  | 'GIRO'
  | 'QRIBAN'
  | 'AccountNumber'
  | 'IFSC';

/**
 * Bank account validation request. The discriminator is `bankNumberType`,
 * which determines which of `accountNumber`, `iban`, `swift`, or `bankCode`
 * is required.
 *
 * @remarks
 * `swift` and `swiftCode` historically alias each other on the server, but
 * use `swiftCode` when `bankNumberType === 'SWIFT'` and `swift` for ancillary
 * BIC-on-an-IBAN-account scenarios. Most callers should set `swiftCode`.
 */
export interface BankValidateRequest extends BaseRequest {
  country: string;
  /** Discriminator — required by the server. */
  bankNumberType: BankNumberType;
  bankCode?: string;
  accountNumber?: string;
  /** Account type (e.g., Checking, Savings). Informational. */
  accountType?: string;
  iban?: string;
  /**
   * Mexican CLABE (Clave Bancaria Estandarizada). Required when
   * `bankNumberType: 'CLABE'`.
   */
  clabe?: string;
  /** Bank Giro number — used with `bankNumberType: 'GIRO'`. */
  bankGiro?: string;
  /** Optional bank name (informational, max 512 chars). */
  bankName?: string;
  /**
   * Whether to include IFSC details (India). Defaults to `true` server-side;
   * set `false` to skip IFSC enrichment.
   */
  ifscDetails?: boolean;
  /**
   * Continue bank-account validation when the tax-ID validation step fails.
   * Defaults to `false` server-side.
   */
  continueBankValidationOnTaxFailure?: boolean;
  /** Optional callback URL for bulk webhook notification when processing completes. */
  callbackUrl?: string;
  /** Optional client-supplied identifier echoed in webhook callbacks. */
  bankAccountValidationId?: number;
  /**
   * Use with `bankNumberType: 'SWIFT'`. Prefer `swiftCode` — `swift` is kept
   * for back-compat with older clients that emit it.
   */
  swift?: string;
  /**
   * SWIFT/BIC code. Use with `bankNumberType: 'SWIFT'`, or alongside an IBAN
   * for an extra integrity check.
   */
  swiftCode?: string;
  /** First name of the account holder (individual accounts only). */
  firstName?: string;
  /** Last name of the account holder (individual accounts only). */
  lastName?: string;
  bankAccountHolder?: string;
  businessName?: string;
  businessEntityType?: string;
  taxIdNumber?: string;
  taxType?: string;
  /** Argentine CBU (Clave Bancaria Uniforme) — required when `bankNumberType: 'CBU'`. */
  cbu?: string;
  /** Local-language bank name (informational, max 512 chars). */
  localBankName?: string;
  /** ISO 3166-1 alpha-2 / alpha-3 / full name of the entity's country. */
  entityCountry?: string;
  /** Bank currency code (informational, max 512 chars). */
  bankCurrencyCode?: string;
}

export interface BankValidateResponse extends BaseResponse {
  bankAccountNumber?: string;
  bankCurrencyCode?: string;
  accountType?: string;
  accountHolder?: string;
  /**
   * IBAN string. Wire field: `iban` — the .NET `JsonNamingPolicy.CamelCase`
   * lowercases the entire leading run of uppercase letters, so all-caps
   * `IBAN` serialises as `iban` (not `iBAN`).
   */
  iban?: string;
  swiftCode?: string;
  /**
   * CLABE number. Wire field: `clabeNumber` — `CLABENumber` is an acronym
   * followed by Pascal-cased word; the leading all-caps run is lowercased
   * (`CLABE` → `clabe`) and the suffix is preserved.
   */
  clabeNumber?: string;

  taxIdNumber?: string;
  taxType?: string;

  threshold?: number;
  matchCode?: number;
  score?: number;
  resultCode?: number;

  bankBranchCode?: string;
  bankName?: string;
  branchName?: string;
  bankKey?: string;
  localBankName?: string;
  bankAddress?: AddressResponse;
  bankCode?: string;
  bankNumberType?: string;
  country?: Country;

  validationStatus?: string;
  bankAccountValidations?: Record<string, unknown>;
  bankProValidations?: Record<string, unknown>;

  requestedInfo?: Record<string, unknown>;
  responseInfo?: Record<string, unknown>;

  vendorName?: string;
  vendorCountry?: string;
  sourceUniqueId?: string;
  qubitOnUniqueId?: string;
}

/** BankPro extends bank validation with payee/ownership verification. */
export interface BankProValidateRequest extends BankValidateRequest {
  dateOfBirth?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

/** BankPro responses share the BankValidateResponse shape. */
export type BankProValidateResponse = BankValidateResponse;

// ── IBAN Validation ───────────────────────────────────────────────────────

/**
 * IBAN validation request. The endpoint is dedicated to IBANs — the only
 * required input is `iban`; `bankCode` is largely ignored by the IBAN
 * validator (use `validateBankAccount` with `bankNumberType: 'IBAN'` if you
 * need the full bank-account flow).
 *
 * Mirrors the .NET `IBANRequest` class which extends `BaseBankRequest`.
 */
export interface IbanValidateRequest extends BaseRequest {
  iban: string;
  /**
   * ISO 3166-1 alpha-2, alpha-3, or full name of the country. The .NET
   * `BaseBankRequest.Country` property is decorated with `[Required]`, so
   * the server rejects requests with a missing or empty `country`.
   */
  country: string;
  bankAccountHolder?: string;
  /**
   * Type of bank number — defaults to `'IBAN'` server-side. The IBAN
   * endpoint accepts only `'IBAN'`; ancillary discriminators are honoured
   * by the broader `validateBankAccount` flow instead.
   */
  bankNumberType?: 'IBAN';
  /** Bank code (max 512 chars). Largely informational. */
  bankCode?: string;
  /** Business name of the account holder (max 512 chars). */
  businessName?: string;
  /** Bank currency code (max 512 chars). */
  bankCurrencyCode?: string;
  /** Business entity type (max 512 chars). */
  businessEntityType?: string;
  /** ISO 3166-1 alpha-2 / alpha-3 / full name of the entity's country. */
  entityCountry?: string;
}

/**
 * Decomposed IBAN parts returned by `validateIban`. Wire fields use the
 * .NET `JsonNamingPolicy.CamelCase` policy, which lowercases the entire
 * leading run of uppercase letters — so `IBANCheckDigit` serialises as
 * `ibanCheckDigit`.
 */
export interface IbanDetails {
  bban?: string;
  nationalCheckDigit?: string;
  /** Wire field: `ibanCheckDigit` (leading IBAN acronym fully lowercased). */
  ibanCheckDigit?: string;
  balanceAccountNumber?: string;
}

/**
 * IBAN-specific response shape. Differs from {@link BankValidateResponse} by
 * including the decoded `ibanDetails` block.
 */
export interface IbanValidateResponse extends BaseResponse {
  /** Wire field: `iban` (see {@link BankValidateResponse.iban}). */
  iban?: string;
  ibanDetails?: IbanDetails;
  bankName?: string;
  bankCode?: string;
  branchName?: string;
  bankBranchCode?: string;
  bankAccountNumber?: string;
  bankCurrencyCode?: string;
  accountType?: string;
  accountHolder?: string;
  swiftCode?: string;
  bankAddress?: AddressResponse;
  country?: Country;
  validationStatus?: string;
  validationResults?: ValidationResult[];
  sourceUniqueId?: string;
  qubitOnUniqueId?: string;
}

// ── Email Validation ──────────────────────────────────────────────────────

export interface EmailValidateRequest extends BaseRequest {
  emailAddress: string;
  emailType?: string;
}

export interface EmailValidateResponse extends BaseResponse {
  emailAddress?: string;
  emailType?: string;
  fraudScore?: number;
  validationResults?: ValidationResult[];
  sourceUniqueId?: string;
  qubitOnUniqueId?: string;
}

// ── Phone Validation ──────────────────────────────────────────────────────

export interface PhoneValidateRequest extends BaseRequest {
  phoneNumber: string;
  country: string;
  phoneExtension?: string;
}

export interface PhoneValidateResponse extends BaseResponse {
  phoneNumber?: string;
  phoneExtension?: string;
  phoneCountryCode?: string;
  fullPhoneNumber?: string;
  fraudScore?: number;
  country?: Country;
  alternatePhoneCountries?: { fullPhoneNumber?: string; country?: Country }[];
  validationResults?: ValidationResult[];
  sourceUniqueId?: string;
  qubitOnUniqueId?: string;
}

// ── Business Registration Lookup ──────────────────────────────────────────

export interface BusinessRegistrationRequest extends BaseRequest {
  /** Business name to look up. The API field is `entityName`. */
  entityName: string;
  country: string;
  state?: string;
  city?: string;
}

export interface BusinessRegistration {
  registrationId?: string;
  entityName?: string;
  status?: string;
  statusReason?: string;
  businessEntityType?: string;
  businessEntityTypeDescription?: string;
  jurisdiction?: string;
  registrationDate?: string;
  formationDate?: string;
  expirationDate?: string;
  duration?: string;
  taxNumber?: string;
  previousEntityNames?: string[];
  addresses?: Record<string, unknown>[];
  persons?: Record<string, unknown>[];
  phones?: Record<string, unknown>[];
}

export interface BusinessRegistrationResponse extends BaseResponse {
  businessRegistrations?: BusinessRegistration[];
  validationDescription?: string;
  validationPass?: boolean | null;
  score?: number;
  sourceResultCode?: string;
  validationResultCode?: string;
  validationDate?: string;
  sourceUniqueId?: string;
  qubitOnUniqueId?: string;
}

// ── Peppol ────────────────────────────────────────────────────────────────

/**
 * Peppol participant validation request. The .NET `PeppolValidationRequest`
 * does NOT inherit from `BaseRequest`, so this interface intentionally omits
 * the BaseRequest fields. The client skips `requestedByClient` injection.
 */
export interface PeppolValidateRequest {
  participantId: string;
  directoryLookup?: boolean;
}

export interface PeppolValidateResponse extends BaseResponse {
  isValid?: boolean;
  validationType?: string;
  participantId?: string;
  icdCode?: string;
  icdScheme?: string;
  identifier?: string;
  countryIso2?: string;
  registeredInDirectory?: boolean;
  participantName?: string;
  documentTypes?: string[];
  errors?: string[];
}

/**
 * A single Peppol scheme entry returned by `getPeppolSchemes`. Wire field
 * names are pinned via `[JsonPropertyName]` on the .NET `SupportedPeppolScheme`
 * class — the typed shape mirrors the actual server-side fields:
 * `icdCode`, `schemeName`, `countryIso2`, `description`, `exampleId`.
 */
export interface PeppolScheme {
  icdCode?: string;
  schemeName?: string;
  countryIso2?: string;
  description?: string;
  exampleId?: string;
}

// ── Sanctions ─────────────────────────────────────────────────────────────

/**
 * Sanctions / prohibited-list address entry. Mirrors the .NET
 * `ProhibitedAddress` shape — accepted on `SanctionsRequest.addresses[]`
 * for entities that have multiple registered locations.
 */
export interface SanctionsAddress {
  addressLine1?: string;
  addressLine2?: string;
  addressLine3?: string;
  state?: string;
  city?: string;
  postalCode?: string;
  country?: string;
}

/** Identity (type + number) entry for sanctions screening. */
export interface SanctionsIdentity {
  identityType?: string;
  identityNumber?: string;
}

export interface SanctionsRequest extends BaseRequest {
  /** Required: company or entity name to screen. */
  companyName: string;
  /** Optional list of "doing business as" names. */
  companyNameDBA?: string[];
  /** First name (for individual screening). */
  firstName?: string;
  /** Middle name (for individual screening). */
  middleName?: string;
  /** Last name (for individual screening). */
  lastName?: string;
  /**
   * Country (top-level) is OPTIONAL on this endpoint. The .NET
   * `ProhibitedListRequest.Country` property is decorated with
   * `[SwaggerIgnore]` and has no `[Required]` attribute — most callers
   * should pass per-address countries via {@link addresses}[].country
   * instead. Kept for callers that already use it.
   */
  country?: string;
  /** Top-level address fields are decorated with `[SwaggerIgnore]` server-side. Prefer {@link addresses}. */
  addressLine1?: string;
  addressLine2?: string;
  addressLine3?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  /** Optional list of additional addresses to screen against (preferred). */
  addresses?: SanctionsAddress[];
  /** Optional UN-blocked country code. */
  blockedCountryUN_Number?: string;
  /** Match-confidence threshold (0.0–1.0). Server default: 0.0. */
  threshold?: number;
  /** Single identity number (for individual screening). */
  identityNumber?: string;
  /** List of identity-type/number pairs to include in the screening. */
  identityId?: SanctionsIdentity[];
  /** Type of business entity (max 100 chars). */
  businessEntityType?: string;
  /** Request type — `Initial`, `Ongoing`, or `Re-check`. */
  requestType?: string;
  /** Subset of prohibited lists to query. */
  prohibitedListSearchList?: string[];
  /** `Entity` (default) or `Individual`. */
  prohibitedLookupType?: string;
}

/** Address entry attached to a {@link ProhibitedListEntity}. */
export interface ProhibitedListEntityAddress {
  address1?: string;
  address2?: string;
  address3?: string;
  city?: string;
  state?: string;
  stateName?: string;
  postalCode?: string;
  country?: Country;
  score?: number;
  remark?: string;
}

/** Alias entry attached to a {@link ProhibitedListEntity}. */
export interface ProhibitedListEntityAlias {
  name?: string;
  type?: string;
  score?: number;
}

/**
 * Identifier (ISIN, SWIFT BIC, CUSIP, LEI, Passport, Tax ID, etc.) attached
 * to a {@link ProhibitedListEntity}.
 */
export interface ProhibitedListEntityIdentifier {
  identifier?: string;
  scheme?: string;
  notes?: string;
}

/**
 * Relationship (parent, subsidiary, shareholder, board member, sanctions
 * reference) attached to a {@link ProhibitedListEntity}.
 */
export interface ProhibitedListEntityRelationship {
  relatedEntityId?: string;
  relatedEntityName?: string;
  relationshipType?: string;
  ownershipPercent?: string;
  notes?: string;
}

/**
 * Country association (citizenship, jurisdiction, sanctioned region) attached
 * to a {@link ProhibitedListEntity}.
 */
export interface ProhibitedListCountryInfo {
  countryType?: string;
  countryISO2?: string;
  countryName?: string;
  isPrimary?: boolean;
}

/** A single matched entity returned within a {@link ProhibitedListDetail}. */
export interface ProhibitedListEntity {
  id?: string;
  number?: string;
  maxScore?: number;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  otherName?: string;
  wholeName?: string;
  hasAliasMatch?: boolean;
  hasAddressMatch?: boolean;
  score?: number;
  type?: string;
  programs?: string;
  remarks?: string;
  aliases?: ProhibitedListEntityAlias[];
  addresses?: ProhibitedListEntityAddress[];
  identifiers?: ProhibitedListEntityIdentifier[];
  relationships?: ProhibitedListEntityRelationship[];
  countries?: ProhibitedListCountryInfo[];
}

/** A single source-list result (e.g. OFAC, EU Consolidated, UN). */
export interface ProhibitedListDetail {
  code?: string;
  name?: string;
  description?: string;
  totalMatches?: number;
  entityMatches?: number;
  blockedCountryMatches?: number;
  dateAdded?: string;
  entities?: ProhibitedListEntity[];
}

/** Top-level container for sanctions match details. */
export interface ProhibitedListAdditionalInfo {
  resultCode?: string;
  lists?: ProhibitedListDetail[];
}

export interface SanctionsResponse extends BaseResponse {
  isMatch?: boolean;
  description?: string;
  /**
   * Match details — broken down by source list (OFAC, EU, UN, …) and within
   * each list by matched entity. Mirrors the .NET
   * `ProhibitedListAdditionalInfo` structure.
   */
  additionalInfo?: ProhibitedListAdditionalInfo;
  sourceId?: number;
  score?: number;
  sourceResultCode?: string;
  validationResultCode?: string;
  validationDate?: string;
  sourceUniqueId?: string;
  qubitOnUniqueId?: string;
}

// ── PEP Screening ─────────────────────────────────────────────────────────

export interface PepRequest extends BaseRequest {
  name: string;
  /**
   * ISO 3166-1 alpha-2, alpha-3, or full country name. Required by the
   * server — the .NET `PEPRequest.Country` property has `[Required]`.
   */
  country: string;
}

/**
 * Relatives and Close Associates (RCA) entry returned in
 * {@link PepResponse.relativesAndAssociates}. Mirrors the .NET
 * `RcaPersonResponse` class — included only when the client has a Dow Jones
 * watchlist subscription entitlement.
 */
export interface RcaPersonResponse {
  /** Dow Jones Profile ID. */
  profileId?: string;
  /** Full name of the RCA person. */
  name?: string;
  /** Relationship type (e.g., Wife, Husband, Business Associate). */
  relationshipType?: string;
  /** Relationship status: `Current` or `Former`. */
  relationshipStatus?: string;
  /** True if this person is also a PEP. */
  isPep?: boolean;
  /** True if this person is on a prohibited/sanctions list. */
  isProhibited?: boolean;
}

export interface PepResponse extends BaseResponse {
  persons?: Record<string, unknown>[];
  organizations?: Record<string, unknown>[];
  members?: Record<string, unknown>[];
  areas?: Record<string, unknown>[];
  /**
   * Relatives and Close Associates — embedded from the Dow Jones watchlist.
   * Populated only when the calling client has the Dow Jones subscription
   * entitlement; otherwise the field is absent.
   */
  relativesAndAssociates?: RcaPersonResponse[];
  score?: number;
  sourceResultCode?: string;
  validationResultCode?: string;
  validationDate?: string;
  sourceUniqueId?: string;
  qubitOnUniqueId?: string;
}

// ── Disqualified Directors ────────────────────────────────────────────────

export interface DirectorsRequest extends BaseRequest {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  country: string;
}

export interface DirectorsResponse extends BaseResponse {
  hasDisqualified?: boolean;
  directors?: Record<string, unknown>[];
}

// ── EPA Criminal Prosecution ──────────────────────────────────────────────

export interface EpaProsecutionRequest extends BaseRequest {
  name?: string;
  state?: string;
  fiscalYear?: string;
}

export interface EpaProsecutionResponse extends BaseResponse {
  prosecutionSummaryId?: number;
  name?: string;
  state?: string;
  year?: string;
  action?: string;
  validationResults?: ValidationResult[];
  sourceUniqueId?: string;
  qubitOnUniqueId?: string;
}

// ── Healthcare Exclusion ──────────────────────────────────────────────────

export interface HealthcareExclusionRequest extends BaseRequest {
  /** "HCO" (organization) or "HCP" (provider). */
  healthCareType: string;
  entityName?: string;
  lastName?: string;
  firstName?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

export interface HealthcareExclusionResponse extends BaseResponse {
  hasExclusions?: boolean;
  exclusions?: Record<string, unknown>[];
}

// ── Risk (Bankruptcy / Credit Score / Fail Rate) ──────────────────────────

/**
 * The unified `/api/risk/lookup` endpoint takes an entity name + country and
 * a `category` discriminator. Use the higher-level `checkBankruptcyRisk`,
 * `lookupCreditScore`, and `lookupFailRate` helpers instead of building this
 * directly.
 */
export interface RiskLookupRequest extends BaseRequest {
  entityName: string;
  /**
   * Country is optional on the .NET model (no `[Required]`), so the SDK
   * keeps it optional too — the unified risk lookup accepts country-less
   * queries for some categories.
   */
  country?: string;
  category: 'Bankruptcy' | 'Credit Score' | 'Fail Rate' | string;
  /** Optional QubitOn-issued numeric identifier. */
  smartVmNumber?: number;
  addressLine1?: string;
  /** Address line 2 for address-level lookups. */
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  maximumArticleCount?: number;
}

/**
 * Single entry returned by the unified `/api/risk/lookup` endpoint. Server
 * returns a `List<RiskResponse>` — the SDK exposes that as a typed array.
 * `/api/risk/lookup` only accepts the ESG categories (Social, Governance,
 * Environmental). Bankruptcy / Credit Score / Fail Rate are routed through
 * `/api/risk/riskcontrol` which returns a single {@link RiskControlResponse}
 * object — see {@link BankruptcyResponse}, {@link CreditScoreResponse},
 * {@link FailRateResponse}.
 */
export interface RiskResponseEntry {
  totalArticles?: number;
  totalSentimentCount?: Record<string, number>;
  categories?: Record<string, unknown>[];
  sourceUniqueId?: string;
  qubitOnUniqueId?: string;
  // Indexer for forward-compat — server returns a wide envelope.
  [key: string]: unknown;
}

/**
 * Response shape for `/api/risk/riskcontrol` — mirrors the server-side
 * `RiskControlResponse` DTO. Returned as a single object (not a list) by the
 * Bankruptcy / Credit Score / Fail Rate convenience helpers.
 */
export interface RiskControlResponse {
  /** Server pin: wire field is `companyname` (one word, no camelCase). */
  companyname?: string;
  country?: string;
  category?: string;
  cases?: Record<string, unknown>[];
  recommendation?: string;
  riskScore?: string;
  categoryValue?: string;
  qubitOnNumber?: number;
  /** Inherited from BaseLookupResponse. */
  score?: number;
  sourceResultCode?: string;
  validationResultCode?: string;
  validationDate?: string;
  /** Inherited from BaseTrackingResponse. */
  sourceUniqueId?: string;
  qubitOnUniqueId?: string;
  /** Indexer for forward-compat — server may add fields. */
  [key: string]: unknown;
}

/**
 * @deprecated Use {@link BankruptcyResponse} (a single
 * {@link RiskControlResponse} object).
 */
export interface BankruptcyResponseEntry extends RiskResponseEntry {
  hasBankruptcy?: boolean;
  riskScore?: number;
}

/**
 * @deprecated Use {@link CreditScoreResponse} (a single
 * {@link RiskControlResponse} object).
 */
export interface CreditScoreResponseEntry extends RiskResponseEntry {
  score?: number;
  rating?: string;
  financialHealth?: string;
}

/**
 * @deprecated Use {@link FailRateResponse} (a single
 * {@link RiskControlResponse} object).
 */
export interface FailRateResponseEntry extends RiskResponseEntry {
  failRate?: number;
  classification?: string;
}

// ── Entity Risk ───────────────────────────────────────────────────────────

/**
 * Entity risk request. Mirrors the .NET `EntityRiskRequest` (which
 * implements `IEntityHeader` and includes a number of optional descriptive
 * fields).
 *
 * Wire pins:
 *  - `CountryOfIncorporation` keeps its PascalCase casing on the wire — the
 *    .NET property has `[JsonPropertyName("CountryOfIncorporation")]` which
 *    overrides the camelCase policy. The server rejects the camelCase
 *    `countryOfIncorporation` variant.
 *  - `url` is the wire field — the .NET `EntityRiskRequest.URL` property has
 *    NO `[JsonPropertyName]` attribute, so the global `JsonNamingPolicy.CamelCase`
 *    policy lowercases the entire leading run of uppercase letters
 *    (`URL` → `url`). Always sent as a string array.
 */
export interface EntityRiskRequest extends BaseRequest {
  companyName: string;
  companyNameDBA?: string[];
  /** QubitOn-issued entity identifier (max 250 chars). */
  qubitOnEntityId?: string;
  businessEntityType?: string;
  /** Sub-classification of the business entity type (max 500 chars). */
  businessEntitySubType?: string;
  /** Maximum article count to fetch. Server default: 50. */
  maximumArticleCount?: number;
  /**
   * Risk category — supported values: `Financial`, `Operational`,
   * `Geographic`, `Reputational`, `Regulatory`.
   */
  category?: string;
  /**
   * Wire field is `CountryOfIncorporation` (pinned PascalCase via
   * `[JsonPropertyName]`). The lowercase `countryOfIncorporation` alias is
   * NOT accepted by the server — only this PascalCase form is honoured.
   */
  CountryOfIncorporation?: string;
  stateOfIncorporation?: string;
  yearStarted?: string;
  salesVolume?: number;
  employeesOnSite?: number;
  employeesTotal?: number;
  locationType?: string;
  lineOfBusiness?: string;
  /**
   * Wire field is `url` — the .NET `URL` property has no `[JsonPropertyName]`,
   * so the global `JsonNamingPolicy.CamelCase` lowercases the leading
   * all-caps run (`URL` → `url`). Always sent as a string array — even for
   * single-URL requests.
   */
  url?: string[];
  entityPhones?: Record<string, unknown>[];
  entityAddresses?: Record<string, unknown>[];
  entityIdentities?: Record<string, unknown>[];
  entityPersons?: Record<string, unknown>[];
}

export interface EntityRiskResponse extends BaseResponse {
  companyName?: string;
  name?: string;
  qubitOnCompanyName?: string;
  qubitOnEntityId?: string;
  businessEntityType?: string;
  countryOfIncorporation?: string;
  stateOfIncorporation?: string;
  url?: string[];
  yearStarted?: string;
  highRiskScore?: number;
  isHighRisk?: boolean;
  totalArticles?: number;
  validationResults?: ValidationResult[];
  sourceUniqueId?: string;
  qubitOnUniqueId?: string;
  // Indexer for forward-compat — the server returns a wide envelope with
  // many situational fields (categories, summary blocks, sentiment counts).
  [key: string]: unknown;
}

// ── Credit Analysis ───────────────────────────────────────────────────────

export interface CreditAnalysisRequest extends BaseRequest {
  companyName: string;
  country: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  dunsNumber?: string;
}

export interface CreditAnalysisResponse extends BaseResponse {
  creditScore?: number;
  creditLimit?: number;
  paymentBehavior?: string;
}

// ── ESG Score ─────────────────────────────────────────────────────────────

/**
 * Request shape for `lookupESGScore`. The body sent on the wire contains only
 * `companyName` and `esgId` (plus `BaseRequest` fields). `country` and `domain`
 * are bound on the server as `[FromQuery]` parameters on `ESGController` —
 * the SDK strips them out of the body and serialises them into the URL
 * query string. Sending them in the body would silently no-op.
 */
export interface EsgScoresRequest extends BaseRequest {
  companyName: string;
  /** Sent as URL query parameter `?country=…`, NOT body. ISO 3166-1 alpha-2/3 or full name. */
  country?: string;
  /** Sent as URL query parameter `&domain=…`, NOT body. e.g. "example.com". */
  domain?: string;
  esgId?: string;
}

/**
 * Single entry returned by the `/api/esg/Scores` endpoint. Server returns a
 * `List<ESGScoringResponse>` — the SDK exposes that as a typed array.
 *
 * Most fields on `ESGScoringResponse` are decorated with explicit
 * `[JsonPropertyName(...)]` attributes that override the global CamelCase
 * policy with literal snake_case (and one PascalCase) wire names. We mirror
 * those literals here so the typed access matches the wire format exactly.
 */
export interface EsgScoresResponseEntry {
  /** Wire field: `ESGId` (literal PascalCase, not camelCase). */
  ESGId?: number;
  /** Wire field: `id` (deprecated server-side; see source). */
  id?: number;
  name?: string;
  grade?: string;
  /** Wire field: `exchange_symbol`. */
  exchange_symbol?: string;
  /** Wire field: `stock_symbol`. */
  stock_symbol?: string;
  industry?: number;
  country?: number;
  /** Wire field: `company_desc`. */
  company_desc?: string;
  /** Environment score. Wire field: `e`. */
  e?: number;
  /** Social score. Wire field: `s`. */
  s?: number;
  /** Governance score. Wire field: `g`. */
  g?: number;
  total?: number;
  /** Wire field: `progress`. */
  progress?: Record<string, unknown>[];
  /** Wire field: `toprecords` (literal lowercase, no underscore). */
  toprecords?: Record<string, unknown>;
  // Indexer for forward-compat — server may add fields not yet typed.
  [key: string]: unknown;
}

// ── Domain Security ───────────────────────────────────────────────────────

export interface DomainSecurityRequest extends BaseRequest {
  domain: string;
}

export interface DomainSecurityResponse extends BaseResponse {
  riskScore?: number;
  threatLevel?: string;
}

// ── IP Quality ────────────────────────────────────────────────────────────

export interface IpQualityRequest extends BaseRequest {
  ipAddress: string;
  userAgent?: string;
}

/**
 * IP quality response. Wire fields follow the .NET `JsonNamingPolicy.CamelCase`
 * policy, which lowercases the entire leading run of uppercase letters —
 * so all-caps acronym properties `IPAddress`, `ISP`, `ASN` serialise to
 * `ipAddress`, `isp`, `asn`.
 *
 * Several .NET fields on `IPQualityResponse` are declared as plain fields
 * (not properties — `public string AbuseVelocity;` etc.) and therefore are
 * NOT serialised by `System.Text.Json` by default. Those fields
 * (`AbuseVelocity`, `BotStatus`, `DeviceModel`, `DeviceBrand`, `Mobile`,
 * `FraudScore`, `OperatingSystem`, `Browser`) are intentionally omitted
 * here — earlier SDK versions exposed them, but they never appeared on the
 * wire.
 */
export interface IpQualityResponse extends BaseResponse {
  /** Wire field: `ipAddress` (leading IP acronym fully lowercased). */
  ipAddress?: string;
  userAgent?: string;
  isProxy?: boolean;
  isVPN?: boolean;
  isActiveVPN?: boolean;
  /** Wire field: `isp`. */
  isp?: string;
  isCrawler?: boolean;
  isTOR?: boolean;
  isActiveTOR?: boolean;
  recentAbuse?: boolean;
  organization?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  city?: string;
  region?: string;
  host?: string;
  /** Wire field: `asn`. */
  asn?: number;
  connectionType?: string;
  country?: Country;
  validationResults?: ValidationResult[];
  sourceUniqueId?: string;
  qubitOnUniqueId?: string;
}

// ── Beneficial Ownership ──────────────────────────────────────────────────

export interface BeneficialOwnershipRequest extends BaseRequest {
  companyName: string;
  countryIso2: string;
  /** Ultimate-beneficial-owner threshold percentage (0–100). */
  uboThreshold?: number;
  /** Maximum number of layers to traverse in the ownership graph. */
  maxLayers?: number;
}

export interface BeneficialOwnershipResponse extends BaseResponse {
  owners?: Record<string, unknown>[];
}

// ── Corporate Hierarchy ───────────────────────────────────────────────────

export interface CorporateHierarchyRequest extends BaseRequest {
  /** Required (2–50 chars). */
  companyName: string;
  /** Required (2–35 chars). */
  addressLine1: string;
  /** Required (2–28 chars). */
  city: string;
  /** Required (2-letter state code). */
  state: string;
  /** Required (5-digit ZIP). */
  zipCode: string;
}

export interface CorporateHierarchyResponse extends BaseResponse {
  parentCompany?: string;
  subsidiaries?: Record<string, unknown>[];
}

// ── DUNS Lookup ───────────────────────────────────────────────────────────

export interface DunsLookupRequest extends BaseRequest {
  dunsNumber: string;
}

export interface DunsLookupResponse extends BaseResponse {
  found?: boolean;
  companyName?: string;
  dunsNumber?: string;
}

// ── Parent/Child Hierarchy Lookup ─────────────────────────────────────────

export interface ParentChildHierarchyRequest extends BaseRequest {
  identifier: string;
  identifierType: string;
  country?: string;
  options?: string;
}

export interface ParentChildHierarchyResponse extends BaseResponse {
  parent?: Record<string, unknown>;
  children?: Record<string, unknown>[];
}

// ── NPI ───────────────────────────────────────────────────────────────────

export interface NpiValidateRequest extends BaseRequest {
  npi: string;
  organizationName?: string;
  lastName?: string;
  firstName?: string;
  middleName?: string;
}

export interface NpiValidateResponse extends BaseResponse {
  isValid?: boolean;
  organizationName?: string;
  providerType?: string;
}

// ── Medpass ───────────────────────────────────────────────────────────────

export interface MedpassValidateRequest extends BaseRequest {
  id?: string;
  taxId?: string;
  businessEntityType?: string;
  companyName?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface MedpassValidateResponse extends BaseResponse {
  isValid?: boolean;
}

// ── DOT/FMCSA ─────────────────────────────────────────────────────────────

export interface DotCarrierLookupRequest extends BaseRequest {
  dotNumber: string;
  entityName?: string;
}

export interface DotCarrierLookupResponse extends BaseResponse {
  found?: boolean;
  carrierName?: string;
  dotNumber?: string;
  safetyRating?: string;
}

// ── India Identity ────────────────────────────────────────────────────────

export interface IndiaIdentityRequest extends BaseRequest {
  identityNumber: string;
  /** "Driver License" or "Voter Registration". */
  identityNumberType: string;
  entityName?: string;
  /** YYYY-MM-DD. */
  dob?: string;
}

export interface IndiaIdentityResponse extends BaseResponse {
  isValid?: boolean;
  name?: string;
}

// ── Certification ─────────────────────────────────────────────────────────

export interface CertificationRequest extends BaseRequest {
  companyName?: string;
  country?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  addressLine1?: string;
  addressLine2?: string;
  identityType?: string;
  certificationType?: string;
  certificationGroup?: string;
  certificationNumber?: string;
}

export interface CertificationResponse extends BaseResponse {
  isCertified?: boolean;
  certifications?: Record<string, unknown>[];
}

// ── Business Classification ───────────────────────────────────────────────

export interface BusinessClassificationRequest extends BaseRequest {
  companyName: string;
  country?: string;
  city?: string;
  state?: string;
  address1?: string;
  address2?: string;
  phone?: string;
  postalCode?: string;
}

export interface BusinessClassificationResponse extends BaseResponse {
  naicsCode?: string;
  sicCode?: string;
  industry?: string;
}

// ── Payment Terms ─────────────────────────────────────────────────────────

export interface PaymentTermsRequest extends BaseRequest {
  currentPayTerm: number;
  annualSpend: number;
  avgDaysPay: number;
  savingsRate: number;
  threshold: number;
  vendorName?: string;
  country?: string;
}

export interface PaymentTermsResponse extends BaseResponse {
  recommendedTerm?: number;
  potentialSavings?: number;
}

// ── Currency Exchange Rates ───────────────────────────────────────────────

export interface ExchangeRatesRequest {
  /** ISO 4217 currency code, e.g., "USD". Used as a path parameter. */
  baseCurrency: string;
  /**
   * One or more dates (`YYYY-MM-DD`). The wire body for this endpoint is a
   * JSON array — `string[]` is the correct shape. The SDK ALSO accepts a
   * comma-separated `string` purely as a backwards-compatibility convenience
   * (it is split client-side into an array before transmission); new code
   * should pass `string[]` directly.
   */
  dates?: string[] | string;
  targetCurrency?: string;
}

/** Exchange-rate row for a single date. */
export interface CurrencyDayExchangeRates {
  date?: string;
  baseCurrency?: string;
  exchangeRates?: { currency?: string; rate?: number; dataSource?: string }[];
}

// ── SAP Ariba Supplier ────────────────────────────────────────────────────

export interface AribaSupplierRequest extends BaseRequest {
  /** Ariba Network ID. */
  anid: string;
}

export interface AribaSupplierResponse extends BaseResponse {
  found?: boolean;
  companyName?: string;
  anid?: string;
}

// ── Gender Identification ─────────────────────────────────────────────────

export interface GenderizeRequest extends BaseRequest {
  name: string;
  country?: string;
}

export interface GenderizeResponse extends BaseResponse {
  gender?: string;
  probability?: number;
}

// ── Continuous Screening ──────────────────────────────────────────────────

/**
 * Request for `screenContinuous`. The endpoint is currently a 501 stub on the
 * server — the method is provided for parity with other SDKs but should not
 * be used in production. Until the server-side DTO is finalised, all fields
 * are optional so the SDK does not over-constrain callers.
 *
 * @deprecated Server-side endpoint is a 501 stub (under development). The
 * method exists for parity with the other QubitOn SDKs.
 */
export interface ContinuousScreeningRequest extends BaseRequest {
  /** Entity name (organization). Optional until the server DTO stabilises. */
  entityName?: string;
  /** Full name (individual). */
  nameFull?: string;
  /** Last name (individual). */
  nameLast?: string;
  country?: string;
  identityNumber?: string;
  identityNumberType?: string;
  callbackUrl?: string;
}

/** Response shape for `screenContinuous`. Contents depend on the eventual server implementation. */
export interface ContinuousScreeningResponse extends BaseResponse {
  monitoringId?: string;
  status?: string;
  enrolledAt?: string;
  nextScreeningAt?: string;
  matches?: Record<string, unknown>[];
  sourceUniqueId?: string;
  qubitOnUniqueId?: string;
}

// ── Bulk Status ───────────────────────────────────────────────────────────

/**
 * Request for `checkBulkStatus`. The server property is `CallBackID`
 * (PascalCase with all-caps `ID`) — under the `CamelCase` policy this
 * serialises as `callBackID` (only the first letter is lowercased).
 */
export interface BulkStatusRequest extends BaseRequest {
  /** UUID returned when the bulk job was submitted. Wire field: `callBackID`. */
  callBackID: string;
}

/** Response for `checkBulkStatus`. */
export interface BulkStatusResponse extends BaseResponse {
  /** Wire field: `callBackID` (see {@link BulkStatusRequest.callBackID}). */
  callBackID?: string;
  pickUpUrl?: string;
  status?: string;
  statusDescription?: string;
  totalRecords?: number;
  processedRecords?: number;
}

// ── Reference Endpoints (array-shaped) ────────────────────────────────────
//
// The following endpoints return JSON arrays at the top level. Their typed
// returns are arrays — NOT objects with numeric keys.

/** Array of supported tax-format country/type entries returned by `getSupportedTaxFormats`. */
export type TaxFormatsResponse = Record<string, unknown>[];

/** Array of supported Peppol schemes returned by `getPeppolSchemes`. */
export type PeppolSchemesResponse = PeppolScheme[];

/**
 * Single {@link RiskControlResponse} returned by `checkBankruptcyRisk`
 * via `POST /api/risk/riskcontrol`.
 */
export type BankruptcyResponse = RiskControlResponse;

/**
 * Single {@link RiskControlResponse} returned by `lookupCreditScore`
 * via `POST /api/risk/riskcontrol`.
 */
export type CreditScoreResponse = RiskControlResponse;

/**
 * Single {@link RiskControlResponse} returned by `lookupFailRate`
 * via `POST /api/risk/riskcontrol`.
 */
export type FailRateResponse = RiskControlResponse;

/** Array of ESG score entries returned by `lookupESGScore`. */
export type EsgScoresResponse = EsgScoresResponseEntry[];

/** Array of currency-day exchange-rate rows returned by `lookupExchangeRates`. */
export type ExchangeRatesResponse = CurrencyDayExchangeRates[];

// ── Legacy aliases (deprecated — use the canonical names above) ───────────

/** @deprecated Use TaxValidateRequest. */
export type TaxIdRequest = TaxValidateRequest;
/** @deprecated Use TaxValidateResponse. */
export type TaxIdResponse = TaxValidateResponse;
/** @deprecated Use BankValidateRequest. */
export type BankAccountRequest = BankValidateRequest;
/** @deprecated Use BankValidateResponse. */
export type BankAccountResponse = BankValidateResponse;
/** @deprecated Use BusinessRegistrationRequest. */
export type BusinessLookupRequest = BusinessRegistrationRequest;
/** @deprecated Use BusinessRegistrationResponse. */
export type BusinessLookupResponse = BusinessRegistrationResponse;
