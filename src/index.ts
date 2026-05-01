/**
 * Public entry point for the QubitOn Node.js / TypeScript SDK.
 *
 * Import the client and the typed exception classes here; import request and
 * response DTO types from the same package.
 */

export { QubitOnClient } from './client';
export type { ClientOptions, RequestOptions } from './client';

// Typed exception hierarchy.
export {
  QubitonError,
  QubitonAuthError,
  QubitonNotFoundError,
  QubitonValidationError,
  QubitonRateLimitError,
  QubitonServerError,
  QubitonTimeoutError,
  QubitonAbortError,
  // Deprecated legacy aliases — kept for backwards compatibility.
  ApiError,
  AuthenticationError,
  RateLimitError,
} from './errors';

/**
 * OAuth helper, exposed for advanced use cases (sharing a token cache across
 * multiple SDK instances, custom fetch pipelines, etc.). Most callers should
 * pass `clientId` / `clientSecret` to {@link QubitOnClient} instead and let
 * the client manage tokens automatically.
 *
 * `OAuth2TokenManager` is a deprecated alias kept for backwards compatibility
 * with earlier SDK versions; new code should import `OAuthTokenManager`.
 */
export { OAuthTokenManager, OAuth2TokenManager } from './auth';

// All request/response DTOs.
export type {
  // Common
  BaseRequest,
  BaseResponse,
  Country,
  ValidationResult,
  // Address
  AddressRequest,
  AddressResponse,
  // Tax
  TaxValidateRequest,
  TaxValidateResponse,
  TaxFormatValidateRequest,
  TaxFormatValidateResponse,
  TaxFormatsResponse,
  // Bank
  BankNumberType,
  BankValidateRequest,
  BankValidateResponse,
  BankProValidateRequest,
  BankProValidateResponse,
  IbanValidateRequest,
  IbanValidateResponse,
  IbanDetails,
  // Email & Phone
  EmailValidateRequest,
  EmailValidateResponse,
  PhoneValidateRequest,
  PhoneValidateResponse,
  // Business Registration
  BusinessRegistrationRequest,
  BusinessRegistrationResponse,
  BusinessRegistration,
  // Peppol
  PeppolValidateRequest,
  PeppolValidateResponse,
  PeppolSchemesResponse,
  PeppolScheme,
  // Sanctions / PEP / Directors
  SanctionsRequest,
  SanctionsResponse,
  SanctionsAddress,
  SanctionsIdentity,
  ProhibitedListAdditionalInfo,
  ProhibitedListDetail,
  ProhibitedListEntity,
  ProhibitedListEntityAddress,
  ProhibitedListEntityAlias,
  ProhibitedListEntityIdentifier,
  ProhibitedListEntityRelationship,
  ProhibitedListCountryInfo,
  PepRequest,
  PepResponse,
  RcaPersonResponse,
  DirectorsRequest,
  DirectorsResponse,
  // EPA
  EpaProsecutionRequest,
  EpaProsecutionResponse,
  // Healthcare
  HealthcareExclusionRequest,
  HealthcareExclusionResponse,
  // Risk
  RiskLookupRequest,
  RiskResponseEntry,
  RiskControlResponse,
  BankruptcyResponse,
  BankruptcyResponseEntry,
  CreditScoreResponse,
  CreditScoreResponseEntry,
  FailRateResponse,
  FailRateResponseEntry,
  EntityRiskRequest,
  EntityRiskResponse,
  CreditAnalysisRequest,
  CreditAnalysisResponse,
  // ESG / Cyber
  EsgScoresRequest,
  EsgScoresResponse,
  EsgScoresResponseEntry,
  DomainSecurityRequest,
  DomainSecurityResponse,
  IpQualityRequest,
  IpQualityResponse,
  // Corporate Structure
  BeneficialOwnershipRequest,
  BeneficialOwnershipResponse,
  CorporateHierarchyRequest,
  CorporateHierarchyResponse,
  DunsLookupRequest,
  DunsLookupResponse,
  ParentChildHierarchyRequest,
  ParentChildHierarchyResponse,
  // Industry
  NpiValidateRequest,
  NpiValidateResponse,
  MedpassValidateRequest,
  MedpassValidateResponse,
  DotCarrierLookupRequest,
  DotCarrierLookupResponse,
  IndiaIdentityRequest,
  IndiaIdentityResponse,
  // Certification & Classification
  CertificationRequest,
  CertificationResponse,
  BusinessClassificationRequest,
  BusinessClassificationResponse,
  // Financial
  PaymentTermsRequest,
  PaymentTermsResponse,
  ExchangeRatesRequest,
  ExchangeRatesResponse,
  CurrencyDayExchangeRates,
  // Ariba
  AribaSupplierRequest,
  AribaSupplierResponse,
  // Other
  GenderizeRequest,
  GenderizeResponse,
  // Continuous screening / bulk status
  ContinuousScreeningRequest,
  ContinuousScreeningResponse,
  BulkStatusRequest,
  BulkStatusResponse,
  // Deprecated aliases (kept for backwards compatibility)
  TaxIdRequest,
  TaxIdResponse,
  BankAccountRequest,
  BankAccountResponse,
  BusinessLookupRequest,
  BusinessLookupResponse,
} from './models';
