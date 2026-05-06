/**
 * QubitOn Node.js / TypeScript client.
 *
 * Provides typed wrappers for the QubitOn API — address, tax, bank, sanctions,
 * PEP, risk, ESG, corporate hierarchy, healthcare identifiers, and more.
 * Mirrors the Go SDK feature set: API-key or OAuth auth, exponential backoff
 * with ±25% jitter, Retry-After honoring (delta-seconds + HTTP-date), one-shot
 * 401 retry on token rotation, AbortSignal cancellation, and a typed exception
 * hierarchy.
 */

import { OAuthTokenManager } from './auth';
import {
  QubitonAbortError,
  QubitonAuthError,
  QubitonError,
  QubitonNotFoundError,
  QubitonRateLimitError,
  QubitonServerError,
  QubitonTimeoutError,
  QubitonValidationError,
} from './errors';
import type {
  AddressRequest,
  AddressResponse,
  AribaSupplierRequest,
  AribaSupplierResponse,
  BankProValidateRequest,
  BankProValidateResponse,
  BankValidateRequest,
  BankValidateResponse,
  BankruptcyResponse,
  BaseRequest,
  BaseResponse,
  BeneficialOwnershipRequest,
  BeneficialOwnershipResponse,
  BulkStatusRequest,
  BulkStatusResponse,
  BusinessClassificationRequest,
  BusinessClassificationResponse,
  BusinessRegistrationRequest,
  BusinessRegistrationResponse,
  CertificationRequest,
  CertificationResponse,
  ContinuousScreeningRequest,
  ContinuousScreeningResponse,
  CorporateHierarchyRequest,
  CorporateHierarchyResponse,
  CreditAnalysisRequest,
  CreditAnalysisResponse,
  CreditScoreResponse,
  DirectorsRequest,
  DirectorsResponse,
  DomainSecurityRequest,
  DomainSecurityResponse,
  DotCarrierLookupRequest,
  DotCarrierLookupResponse,
  DunsLookupRequest,
  DunsLookupResponse,
  EmailValidateRequest,
  EmailValidateResponse,
  EntityRiskRequest,
  EntityRiskResponse,
  EpaProsecutionRequest,
  EpaProsecutionResponse,
  EsgScoresRequest,
  EsgScoresResponse,
  ExchangeRatesRequest,
  ExchangeRatesResponse,
  FailRateResponse,
  GenderizeRequest,
  GenderizeResponse,
  HealthcareExclusionRequest,
  HealthcareExclusionResponse,
  IbanValidateRequest,
  IbanValidateResponse,
  IndiaIdentityRequest,
  IndiaIdentityResponse,
  IpQualityRequest,
  IpQualityResponse,
  MedpassValidateRequest,
  MedpassValidateResponse,
  NpiValidateRequest,
  NpiValidateResponse,
  ParentChildHierarchyRequest,
  ParentChildHierarchyResponse,
  PaymentTermsRequest,
  PaymentTermsResponse,
  PepRequest,
  PepResponse,
  PeppolSchemesResponse,
  PeppolValidateRequest,
  PeppolValidateResponse,
  PhoneValidateRequest,
  PhoneValidateResponse,
  RiskLookupRequest,
  SanctionsRequest,
  SanctionsResponse,
  TaxFormatValidateRequest,
  TaxFormatValidateResponse,
  TaxFormatsResponse,
  TaxValidateRequest,
  TaxValidateResponse,
} from './models';
import { DEFAULT_BASE_URL, MAX_BACKOFF_MS, MAX_RETRIES, SDK_VERSION, USER_AGENT } from './utils/constants';
import { combineSignals, isAbortError } from './utils/signals';

/** Caller-supplied request options. */
export interface RequestOptions {
  /**
   * Cancels the request when aborted. `null` is accepted as a synonym for
   * "no signal" — callers wiring up a conditional `AbortController` (e.g.
   * `signal: condition ? ctrl.signal : null`) don't have to special-case
   * the falsy branch.
   */
  signal?: AbortSignal | null;
}

/** Construction options for the client. */
export interface ClientOptions {
  /** API key (preferred). Sent in the `apikey` header. */
  apiKey?: string;
  /** OAuth key (used together with `clientSecret`). */
  clientId?: string;
  /** OAuth secret (used together with `clientId`). */
  clientSecret?: string;
  /**
   * Override for the OAuth token endpoint. Defaults to
   * `${baseUrl}/api/oauth/token`.
   */
  tokenUrl?: string;
  /** API base URL. Defaults to `https://api.qubiton.com`. */
  baseUrl?: string;
  /** Per-request timeout in milliseconds. Defaults to 30 000. */
  timeout?: number;
  /** Max retry attempts for transient failures. Defaults to 3. */
  maxRetries?: number;
  /** Custom fetch implementation. Defaults to global `fetch`. */
  fetch?: typeof fetch;
}

/**
 * QubitOn API client. Safe to share across concurrent calls — there is no
 * per-call mutable state aside from the OAuth token cache, which is itself
 * concurrency-safe.
 */
export class QubitOnClient {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly oauth: OAuthTokenManager | null;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ClientOptions = {}) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.timeout = options.timeout ?? 30_000;
    this.maxRetries = options.maxRetries ?? MAX_RETRIES;
    this.fetchImpl = options.fetch ?? fetch;

    if (options.clientId && options.clientSecret) {
      this.oauth = new OAuthTokenManager(
        options.clientId,
        options.clientSecret,
        options.tokenUrl ?? `${this.baseUrl}/api/oauth/token`,
        SDK_VERSION,
        this.fetchImpl,
        // Honour the consumer-configured timeout for token requests; capped at
        // 30 s so a misconfigured client can't sit on a token fetch indefinitely.
        Math.min(this.timeout, 30_000),
      );
    } else {
      this.oauth = null;
    }

    if (!this.apiKey && !this.oauth) {
      throw new Error('QubitOnClient requires either `apiKey` or both `clientId` and `clientSecret`.');
    }
  }

  // ── Core HTTP plumbing ─────────────────────────────────────────────────

  private async authHeaders(signal?: AbortSignal | null): Promise<Record<string, string>> {
    if (this.oauth) {
      const token = await this.oauth.getToken(signal);
      return { Authorization: `Bearer ${token}` };
    }
    // The .NET server reads the lowercase `apikey` header; `X-Api-Key` is ignored.
    return { apikey: this.apiKey as string };
  }

  /**
   * Core request loop. The generic parameter `T` honours both object-shaped
   * AND array-shaped JSON responses — list endpoints are not coerced into
   * objects with numeric keys.
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body: unknown,
    options?: RequestOptions,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const bodyJson = body === undefined || body === null ? undefined : JSON.stringify(body);
    let lastError: QubitonError | null = null;
    let lastAuthError: QubitonError | null = null;
    let authRetried = false;
    let attempt = 0;

    // Iterate up to maxRetries transient attempts. The 401-once retry uses a
    // separate flag so it doesn't consume one of the retry slots.
    while (attempt < this.maxRetries) {
      // Honour caller cancellation between attempts.
      if (options?.signal?.aborted) {
        throw new QubitonAbortError();
      }

      // 501 Not Implemented from `screenContinuous` (server stub) is handled
      // by the 5xx classifier in `classifyResponse` — that branch returns
      // `kind: 'fatal'`, so it never reaches the retry path.

      const result = await this.attempt(method, url, bodyJson, options, authRetried);

      if (result.kind === 'success') {
        return result.body as T;
      }

      if (result.kind === 'auth-retry') {
        // Did not consume one of the maxRetries slots.
        authRetried = true;
        lastAuthError = result.error;
        continue;
      }

      if (result.kind === 'fatal') {
        throw result.error;
      }

      // 'retryable': retry with backoff.
      lastError = result.error;
      attempt++;
      if (attempt < this.maxRetries) {
        await sleep(backoff(attempt - 1, result.retryAfterSeconds ?? 0), options?.signal);
        continue;
      }
      throw lastError;
    }

    // Loop exited without a successful return — usually because the only
    // error we saw was a 401 retry that the server rejected again.
    if (lastAuthError) {
      throw lastAuthError;
    }
    throw lastError ?? new QubitonError(0, 'request failed after retries');
  }

  /**
   * Single network attempt + response classification. Returned shape tells
   * the outer loop whether to return, retry, retry-without-consuming-attempt,
   * or throw immediately.
   */
  private async attempt(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    bodyJson: string | undefined,
    options: RequestOptions | undefined,
    authRetried: boolean,
  ): Promise<AttemptResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    const combined = combineSignals(controller.signal, options?.signal);

    try {
      let resp: Response;
      try {
        const headers: Record<string, string> = {
          Accept: 'application/json',
          'User-Agent': USER_AGENT,
          ...(await this.authHeaders(options?.signal)),
        };
        if (bodyJson !== undefined) {
          headers['Content-Type'] = 'application/json';
        }

        resp = await this.fetchImpl(url, {
          method,
          headers,
          body: bodyJson,
          signal: combined.signal,
        });

        // Read the response body INSIDE the try so a body-read error
        // (network truncation, premature close) is caught and wrapped, and
        // the abort cleanup in `finally` still runs deterministically.
        let respBody: string;
        try {
          respBody = await resp.text();
        } catch (readErr) {
          if (isAbortError(readErr)) {
            if (options?.signal?.aborted) {
              return { kind: 'fatal', error: new QubitonAbortError() };
            }
            return { kind: 'retryable', error: new QubitonTimeoutError() };
          }
          const msg = (readErr as Error)?.message ?? String(readErr);
          return {
            kind: 'retryable',
            error: new QubitonError(0, `response body read failed: ${msg}`),
          };
        }

        return this.classifyResponse(resp, respBody, authRetried);
      } catch (err) {
        if (err instanceof QubitonError) {
          return { kind: 'fatal', error: err };
        }
        if (isAbortError(err)) {
          if (options?.signal?.aborted) {
            return { kind: 'fatal', error: new QubitonAbortError() };
          }
          return { kind: 'retryable', error: new QubitonTimeoutError() };
        }
        const msg = (err as Error)?.message ?? String(err);
        return { kind: 'retryable', error: new QubitonError(0, `network error: ${msg}`) };
      }
    } finally {
      clearTimeout(timer);
      combined.cleanup();
    }
  }

  private classifyResponse(resp: Response, respBody: string, authRetried: boolean): AttemptResult {
    const raw = parseJsonSafe(respBody);
    const rawForError = isObjectLike(raw) ? (raw as Record<string, unknown>) : undefined;

    // Auto-retry once on 401 when using OAuth: the server may have rotated
    // the key out-of-band. Invalidate the cached token and retry. Does NOT
    // consume one of the maxRetries slots.
    if (resp.status === 401 && this.oauth && !authRetried) {
      this.oauth.invalidate();
      return {
        kind: 'auth-retry',
        error: new QubitonAuthError(401, extractMessage(rawForError) ?? 'token rejected', rawForError),
      };
    }

    if (resp.status === 429) {
      const retryAfter = parseRetryAfter(resp.headers.get('Retry-After'));
      return {
        kind: 'retryable',
        retryAfterSeconds: retryAfter,
        error: new QubitonRateLimitError(
          retryAfter,
          rawForError,
          extractMessage(rawForError) ?? 'rate limit exceeded',
        ),
      };
    }

    if (resp.status >= 500 && resp.status < 600) {
      // 501 is "Not Implemented" — terminal, do NOT retry. The server
      // intentionally returns 501 for stub endpoints (e.g. continuous
      // screening); retrying is wasted work.
      if (resp.status === 501) {
        return {
          kind: 'fatal',
          error: new QubitonServerError(
            501,
            extractMessage(rawForError) ?? 'endpoint not implemented',
            rawForError,
          ),
        };
      }
      const retryAfter = parseRetryAfter(resp.headers.get('Retry-After'));
      return {
        kind: 'retryable',
        retryAfterSeconds: retryAfter,
        error: new QubitonServerError(
          resp.status,
          extractMessage(rawForError) ?? `server error: HTTP ${resp.status}`,
          rawForError,
          retryAfter || undefined,
        ),
      };
    }

    if (resp.status === 408) {
      // 408 Request Timeout is a 4xx — classify as QubitonValidationError
      // (matches the rest of the 4xx-range mapping), but keep it retryable
      // since the server is hinting that the timeout is transient.
      return {
        kind: 'retryable',
        error: new QubitonValidationError(
          408,
          extractMessage(rawForError) ?? 'request timeout',
          rawForError,
        ),
      };
    }

    if (resp.status >= 400) {
      return { kind: 'fatal', error: classifyError(resp.status, rawForError) };
    }

    // 2xx — return the raw decoded body. Empty body becomes a stable
    // BaseResponse-shaped sentinel so the type contract holds.
    if (!respBody) {
      return { kind: 'success', body: { raw: {} } };
    }
    if (raw === null) {
      return { kind: 'fatal', error: new QubitonError(resp.status, 'response body is not valid JSON') };
    }
    return { kind: 'success', body: raw };
  }

  /**
   * Internal POST helper. Callers MUST specify the response type explicitly;
   * the previous default of `Record<string, unknown>` masked typos and gave
   * a misleading sense of safety.
   *
   * `injectClient` controls whether `requestedByClient` is auto-populated.
   * Pass `false` for endpoints whose request is NOT a BaseRequest (e.g. the
   * tax format-validate and Peppol endpoints, which use bespoke DTOs). The
   * default `true` preserves the old behaviour for every BaseRequest call.
   */
  private post<T>(path: string, body: unknown, options?: RequestOptions, injectClient = true): Promise<T> {
    const finalBody = injectClient ? this.withDefaultClient(body) : body;
    return this.request<T>('POST', path, finalBody, options);
  }

  private get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('GET', path, undefined, options);
  }

  /**
   * Inject `requestedByClient` into request bodies that look like
   * BaseRequest. The .NET server requires this field on BaseRequest-shaped
   * payloads — we default it to the SDK User-Agent so most callers never
   * have to think about it.
   *
   * For non-BaseRequest payloads (raw arrays, primitive bodies, or DTOs that
   * do NOT extend BaseRequest like `TaxFormatValidateRequest` and
   * `PeppolValidateRequest`) the call site passes `injectClient: false` so
   * we skip injection entirely.
   */
  private withDefaultClient(body: unknown): unknown {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return body;
    }
    const obj = body as BaseRequest & Record<string, unknown>;
    if (typeof obj.requestedByClient === 'string' && obj.requestedByClient.length > 0) {
      return body;
    }
    return { ...obj, requestedByClient: USER_AGENT };
  }

  // ── Address ───────────────────────────────────────────────────────────

  async validateAddress(req: AddressRequest, options?: RequestOptions): Promise<AddressResponse> {
    const data = await this.post<Record<string, unknown>>('/api/address/validate', req, options);
    return wrap<AddressResponse>(data);
  }

  // ── Tax ───────────────────────────────────────────────────────────────

  async validateTax(req: TaxValidateRequest, options?: RequestOptions): Promise<TaxValidateResponse> {
    const data = await this.post<Record<string, unknown>>('/api/tax/validate', req, options);
    return wrap<TaxValidateResponse>(data);
  }

  async validateTaxFormat(
    req: TaxFormatValidateRequest,
    options?: RequestOptions,
  ): Promise<TaxFormatValidateResponse> {
    // TaxFormatValidateRequest is NOT a BaseRequest — skip requestedByClient injection.
    const data = await this.post<Record<string, unknown>>('/api/tax/format-validate', req, options, false);
    return wrap<TaxFormatValidateResponse>(data);
  }

  // ── Bank ──────────────────────────────────────────────────────────────

  async validateBankAccount(req: BankValidateRequest, options?: RequestOptions): Promise<BankValidateResponse> {
    const data = await this.post<Record<string, unknown>>('/api/bank/validate', req, options);
    return wrap<BankValidateResponse>(data);
  }

  async validateBankPro(
    req: BankProValidateRequest,
    options?: RequestOptions,
  ): Promise<BankProValidateResponse> {
    const data = await this.post<Record<string, unknown>>('/api/bankaccount/pro/validate', req, options);
    return wrap<BankProValidateResponse>(data);
  }

  async validateIban(req: IbanValidateRequest, options?: RequestOptions): Promise<IbanValidateResponse> {
    const data = await this.post<Record<string, unknown>>('/api/iban/validate', req, options);
    return wrap<IbanValidateResponse>(data);
  }

  // ── Email & Phone ─────────────────────────────────────────────────────

  async validateEmail(req: EmailValidateRequest, options?: RequestOptions): Promise<EmailValidateResponse> {
    const data = await this.post<Record<string, unknown>>('/api/email/validate', req, options);
    return wrap<EmailValidateResponse>(data);
  }

  async validatePhone(req: PhoneValidateRequest, options?: RequestOptions): Promise<PhoneValidateResponse> {
    const data = await this.post<Record<string, unknown>>('/api/phone/validate', req, options);
    return wrap<PhoneValidateResponse>(data);
  }

  // ── Business Registration ─────────────────────────────────────────────

  async lookupBusinessRegistration(
    req: BusinessRegistrationRequest,
    options?: RequestOptions,
  ): Promise<BusinessRegistrationResponse> {
    const data = await this.post<Record<string, unknown>>('/api/businessregistration/lookup', req, options);
    return wrap<BusinessRegistrationResponse>(data);
  }

  // ── Peppol ────────────────────────────────────────────────────────────

  async validatePeppol(req: PeppolValidateRequest, options?: RequestOptions): Promise<PeppolValidateResponse> {
    // PeppolValidationRequest is NOT a BaseRequest — skip requestedByClient injection.
    const data = await this.post<Record<string, unknown>>('/api/peppol/validate', req, options, false);
    return wrap<PeppolValidateResponse>(data);
  }

  /**
   * Lists all supported Peppol ICD schemes. The endpoint returns a JSON array.
   */
  async getPeppolSchemes(options?: RequestOptions): Promise<PeppolSchemesResponse> {
    return this.get<PeppolSchemesResponse>('/api/peppol/schemes', options);
  }

  // ── Sanctions & Compliance ────────────────────────────────────────────

  async checkSanctions(req: SanctionsRequest, options?: RequestOptions): Promise<SanctionsResponse> {
    const data = await this.post<Record<string, unknown>>('/api/prohibited/lookup', req, options);
    return wrap<SanctionsResponse>(data);
  }

  async screenPEP(req: PepRequest, options?: RequestOptions): Promise<PepResponse> {
    const data = await this.post<Record<string, unknown>>('/api/pep/lookup', req, options);
    return wrap<PepResponse>(data);
  }

  async checkDirectors(req: DirectorsRequest, options?: RequestOptions): Promise<DirectorsResponse> {
    const data = await this.post<Record<string, unknown>>('/api/disqualifieddirectors/validate', req, options);
    return wrap<DirectorsResponse>(data);
  }

  // ── EPA Prosecution ───────────────────────────────────────────────────

  async checkEPAProsecution(
    req: EpaProsecutionRequest,
    options?: RequestOptions,
  ): Promise<EpaProsecutionResponse> {
    const data = await this.post<Record<string, unknown>>('/api/criminalprosecution/validate', req, options);
    return wrap<EpaProsecutionResponse>(data);
  }

  async lookupEPAProsecution(
    req: EpaProsecutionRequest,
    options?: RequestOptions,
  ): Promise<EpaProsecutionResponse> {
    const data = await this.post<Record<string, unknown>>('/api/criminalprosecution/lookup', req, options);
    return wrap<EpaProsecutionResponse>(data);
  }

  // ── Healthcare Exclusion ──────────────────────────────────────────────

  async checkHealthcareExclusion(
    req: HealthcareExclusionRequest,
    options?: RequestOptions,
  ): Promise<HealthcareExclusionResponse> {
    const data = await this.post<Record<string, unknown>>('/api/providerexclusion/validate', req, options);
    return wrap<HealthcareExclusionResponse>(data);
  }

  async lookupHealthcareExclusion(
    req: HealthcareExclusionRequest,
    options?: RequestOptions,
  ): Promise<HealthcareExclusionResponse> {
    const data = await this.post<Record<string, unknown>>('/api/providerexclusion/lookup', req, options);
    return wrap<HealthcareExclusionResponse>(data);
  }

  // ── Risk & Financial ──────────────────────────────────────────────────
  //
  // /api/risk/lookup only accepts the ESG categories (Social, Governance,
  // Environmental). Bankruptcy / Credit Score / Fail Rate route through
  // /api/risk/riskcontrol which returns a single RiskControlResponse object
  // (NOT a list).

  async checkBankruptcyRisk(
    req: Omit<RiskLookupRequest, 'category'>,
    options?: RequestOptions,
  ): Promise<BankruptcyResponse> {
    return this.post<BankruptcyResponse>('/api/risk/riskcontrol', { ...req, category: 'Bankruptcy' }, options);
  }

  async lookupCreditScore(
    req: Omit<RiskLookupRequest, 'category'>,
    options?: RequestOptions,
  ): Promise<CreditScoreResponse> {
    return this.post<CreditScoreResponse>('/api/risk/riskcontrol', { ...req, category: 'Credit Score' }, options);
  }

  async lookupFailRate(
    req: Omit<RiskLookupRequest, 'category'>,
    options?: RequestOptions,
  ): Promise<FailRateResponse> {
    return this.post<FailRateResponse>('/api/risk/riskcontrol', { ...req, category: 'Fail Rate' }, options);
  }

  async assessEntityRisk(req: EntityRiskRequest, options?: RequestOptions): Promise<EntityRiskResponse> {
    const data = await this.post<Record<string, unknown>>('/api/entity/fraud/lookup', req, options);
    return wrap<EntityRiskResponse>(data);
  }

  async lookupCreditAnalysis(
    req: CreditAnalysisRequest,
    options?: RequestOptions,
  ): Promise<CreditAnalysisResponse> {
    const data = await this.post<Record<string, unknown>>('/api/creditanalysis/lookup', req, options);
    return wrap<CreditAnalysisResponse>(data);
  }

  // ── ESG & Cybersecurity ───────────────────────────────────────────────

  /** ESG scores. Returns a JSON array of `EsgScoresResponseEntry`. */
  async lookupESGScore(req: EsgScoresRequest, options?: RequestOptions): Promise<EsgScoresResponse> {
    // `country` and `domain` are bound on the server as [FromQuery] (not body).
    // Strip them out of the body and serialise into the URL with safe encoding.
    // The body keeps only companyName, esgId, and BaseRequest fields.
    const { country, domain, ...body } = req;
    const params = new URLSearchParams();
    if (country) params.set('country', country);
    if (domain) params.set('domain', domain);
    const qs = params.toString();
    const path = qs ? `/api/esg/Scores?${qs}` : '/api/esg/Scores';
    return this.post<EsgScoresResponse>(path, body, options);
  }

  async domainSecurityReport(
    req: DomainSecurityRequest,
    options?: RequestOptions,
  ): Promise<DomainSecurityResponse> {
    const data = await this.post<Record<string, unknown>>('/api/itsecurity/domainreport', req, options);
    return wrap<DomainSecurityResponse>(data);
  }

  async checkIPQuality(req: IpQualityRequest, options?: RequestOptions): Promise<IpQualityResponse> {
    const data = await this.post<Record<string, unknown>>('/api/ipquality/validate', req, options);
    return wrap<IpQualityResponse>(data);
  }

  // ── Corporate Structure ───────────────────────────────────────────────

  async lookupBeneficialOwnership(
    req: BeneficialOwnershipRequest,
    options?: RequestOptions,
  ): Promise<BeneficialOwnershipResponse> {
    const data = await this.post<Record<string, unknown>>('/api/beneficialownership/lookup', req, options);
    return wrap<BeneficialOwnershipResponse>(data);
  }

  async lookupCorporateHierarchy(
    req: CorporateHierarchyRequest,
    options?: RequestOptions,
  ): Promise<CorporateHierarchyResponse> {
    const data = await this.post<Record<string, unknown>>('/api/corporatehierarchy/lookup', req, options);
    return wrap<CorporateHierarchyResponse>(data);
  }

  async lookupDUNS(req: DunsLookupRequest, options?: RequestOptions): Promise<DunsLookupResponse> {
    const data = await this.post<Record<string, unknown>>('/api/duns-number-lookup', req, options);
    return wrap<DunsLookupResponse>(data);
  }

  async lookupHierarchy(
    req: ParentChildHierarchyRequest,
    options?: RequestOptions,
  ): Promise<ParentChildHierarchyResponse> {
    const data = await this.post<Record<string, unknown>>('/api/company/hierarchy/lookup', req, options);
    return wrap<ParentChildHierarchyResponse>(data);
  }

  // ── Industry Specific ─────────────────────────────────────────────────

  async validateNPI(req: NpiValidateRequest, options?: RequestOptions): Promise<NpiValidateResponse> {
    const data = await this.post<Record<string, unknown>>(
      '/api/nationalprovideridentifier/validate',
      req,
      options,
    );
    return wrap<NpiValidateResponse>(data);
  }

  async validateMedpass(
    req: MedpassValidateRequest,
    options?: RequestOptions,
  ): Promise<MedpassValidateResponse> {
    const data = await this.post<Record<string, unknown>>('/api/medpass/validate', req, options);
    return wrap<MedpassValidateResponse>(data);
  }

  async lookupDOTCarrier(
    req: DotCarrierLookupRequest,
    options?: RequestOptions,
  ): Promise<DotCarrierLookupResponse> {
    const data = await this.post<Record<string, unknown>>('/api/dot/fmcsa/lookup', req, options);
    return wrap<DotCarrierLookupResponse>(data);
  }

  async validateIndiaIdentity(
    req: IndiaIdentityRequest,
    options?: RequestOptions,
  ): Promise<IndiaIdentityResponse> {
    const data = await this.post<Record<string, unknown>>('/api/inidentity/validate', req, options);
    return wrap<IndiaIdentityResponse>(data);
  }

  // ── Certification ─────────────────────────────────────────────────────

  async validateCertification(
    req: CertificationRequest,
    options?: RequestOptions,
  ): Promise<CertificationResponse> {
    const data = await this.post<Record<string, unknown>>('/api/certification/validate', req, options);
    return wrap<CertificationResponse>(data);
  }

  async lookupCertification(
    req: CertificationRequest,
    options?: RequestOptions,
  ): Promise<CertificationResponse> {
    const data = await this.post<Record<string, unknown>>('/api/certification/lookup', req, options);
    return wrap<CertificationResponse>(data);
  }

  // ── Business Classification ───────────────────────────────────────────

  async lookupBusinessClassification(
    req: BusinessClassificationRequest,
    options?: RequestOptions,
  ): Promise<BusinessClassificationResponse> {
    const data = await this.post<Record<string, unknown>>('/api/businessclassification/lookup', req, options);
    return wrap<BusinessClassificationResponse>(data);
  }

  // ── Financial Operations ──────────────────────────────────────────────

  async analyzePaymentTerms(
    req: PaymentTermsRequest,
    options?: RequestOptions,
  ): Promise<PaymentTermsResponse> {
    const data = await this.post<Record<string, unknown>>('/api/paymentterms/validate', req, options);
    return wrap<PaymentTermsResponse>(data);
  }

  /**
   * Looks up currency exchange rates. The endpoint expects `baseCurrency`
   * as a path parameter and `dates` as a JSON array body. Returns a JSON
   * array of {@link ExchangeRatesResponse} rows.
   *
   * @deprecated The `/api/currency/exchange-rates/{baseCurrency}` endpoint
   * is marked `[ApiExplorerSettings(IgnoreApi = true)]` on the server — it
   * is internal and not part of the public API contract. Use at your own
   * risk; the shape and availability may change without notice.
   */
  async lookupExchangeRates(
    req: ExchangeRatesRequest,
    options?: RequestOptions,
  ): Promise<ExchangeRatesResponse> {
    const path = `/api/currency/exchange-rates/${encodeURIComponent(req.baseCurrency)}`;
    const dates = normalizeDates(req.dates);
    return this.post<ExchangeRatesResponse>(path, dates, options);
  }

  // ── Ariba ─────────────────────────────────────────────────────────────

  async lookupAribaSupplier(
    req: AribaSupplierRequest,
    options?: RequestOptions,
  ): Promise<AribaSupplierResponse> {
    const data = await this.post<Record<string, unknown>>('/api/aribasupplierprofile/lookup', req, options);
    return wrap<AribaSupplierResponse>(data);
  }

  async validateAribaSupplier(
    req: AribaSupplierRequest,
    options?: RequestOptions,
  ): Promise<AribaSupplierResponse> {
    const data = await this.post<Record<string, unknown>>('/api/aribasupplierprofile/validate', req, options);
    return wrap<AribaSupplierResponse>(data);
  }

  // ── Other ─────────────────────────────────────────────────────────────

  async identifyGender(req: GenderizeRequest, options?: RequestOptions): Promise<GenderizeResponse> {
    const data = await this.post<Record<string, unknown>>('/api/genderize/identifygender', req, options);
    return wrap<GenderizeResponse>(data);
  }

  // ── Continuous Screening / Bulk Status ───────────────────────────────

  /**
   * Submits an entity for continuous compliance monitoring.
   *
   * @deprecated The server-side endpoint at `/api/continuous-screening/screen`
   * is currently a 501 stub (under development). The method exists for
   * parity with the other QubitOn SDKs.
   */
  async screenContinuous(
    req: ContinuousScreeningRequest,
    options?: RequestOptions,
  ): Promise<ContinuousScreeningResponse> {
    const data = await this.post<Record<string, unknown>>('/api/continuous-screening/screen', req, options);
    return wrap<ContinuousScreeningResponse>(data);
  }

  /** Retrieves the status of a previously submitted bulk validation job. */
  async checkBulkStatus(req: BulkStatusRequest, options?: RequestOptions): Promise<BulkStatusResponse> {
    const data = await this.post<Record<string, unknown>>('/api/bulkstatus/check', req, options);
    return wrap<BulkStatusResponse>(data);
  }

  // ── Reference ─────────────────────────────────────────────────────────

  /** Lists all supported tax-format country/type combinations. Returns a JSON array. */
  async getSupportedTaxFormats(options?: RequestOptions): Promise<TaxFormatsResponse> {
    return this.get<TaxFormatsResponse>('/api/tax/format-validate/countries', options);
  }

  // ── Legacy aliases (deprecated) ───────────────────────────────────────

  /** @deprecated Use validateTax(). */
  async validateTaxId(req: TaxValidateRequest, options?: RequestOptions): Promise<TaxValidateResponse> {
    return this.validateTax(req, options);
  }

  /** @deprecated Use validateTaxFormat(). */
  async formatValidateTax(
    req: TaxFormatValidateRequest,
    options?: RequestOptions,
  ): Promise<TaxFormatValidateResponse> {
    return this.validateTaxFormat(req, options);
  }

  /** @deprecated Use validateBankAccount(). */
  async validateBank(req: BankValidateRequest, options?: RequestOptions): Promise<BankValidateResponse> {
    return this.validateBankAccount(req, options);
  }

  /** @deprecated Use lookupBusinessRegistration(). */
  async lookupBusiness(
    req: BusinessRegistrationRequest,
    options?: RequestOptions,
  ): Promise<BusinessRegistrationResponse> {
    return this.lookupBusinessRegistration(req, options);
  }

  /** @deprecated Use checkSanctions(). */
  async screenSanctions(req: SanctionsRequest, options?: RequestOptions): Promise<SanctionsResponse> {
    return this.checkSanctions(req, options);
  }

  /** @deprecated Use screenPEP(). */
  async screenPep(req: PepRequest, options?: RequestOptions): Promise<PepResponse> {
    return this.screenPEP(req, options);
  }

  /** @deprecated Use checkEPAProsecution(). */
  async checkEpaProsecution(
    req: EpaProsecutionRequest,
    options?: RequestOptions,
  ): Promise<EpaProsecutionResponse> {
    return this.checkEPAProsecution(req, options);
  }

  /** @deprecated Use lookupEPAProsecution(). */
  async lookupEpaProsecution(
    req: EpaProsecutionRequest,
    options?: RequestOptions,
  ): Promise<EpaProsecutionResponse> {
    return this.lookupEPAProsecution(req, options);
  }

  /** @deprecated Use checkBankruptcyRisk(). */
  async checkBankruptcy(
    req: Omit<RiskLookupRequest, 'category'>,
    options?: RequestOptions,
  ): Promise<BankruptcyResponse> {
    return this.checkBankruptcyRisk(req, options);
  }

  /** @deprecated Use lookupESGScore(). */
  async lookupEsgScores(req: EsgScoresRequest, options?: RequestOptions): Promise<EsgScoresResponse> {
    return this.lookupESGScore(req, options);
  }

  /** @deprecated Use domainSecurityReport(). */
  async getDomainSecurityReport(
    req: DomainSecurityRequest,
    options?: RequestOptions,
  ): Promise<DomainSecurityResponse> {
    return this.domainSecurityReport(req, options);
  }

  /** @deprecated Use checkIPQuality(). */
  async checkIpQuality(req: IpQualityRequest, options?: RequestOptions): Promise<IpQualityResponse> {
    return this.checkIPQuality(req, options);
  }

  /** @deprecated Use lookupDUNS(). */
  async lookupDunsNumber(req: DunsLookupRequest, options?: RequestOptions): Promise<DunsLookupResponse> {
    return this.lookupDUNS(req, options);
  }

  /** @deprecated Use lookupHierarchy(). */
  async lookupParentChildHierarchy(
    req: ParentChildHierarchyRequest,
    options?: RequestOptions,
  ): Promise<ParentChildHierarchyResponse> {
    return this.lookupHierarchy(req, options);
  }

  /** @deprecated Use validateNPI(). */
  async validateNpi(req: NpiValidateRequest, options?: RequestOptions): Promise<NpiValidateResponse> {
    return this.validateNPI(req, options);
  }

  /** @deprecated Use lookupDOTCarrier(). */
  async lookupDotCarrier(
    req: DotCarrierLookupRequest,
    options?: RequestOptions,
  ): Promise<DotCarrierLookupResponse> {
    return this.lookupDOTCarrier(req, options);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Outcome of a single network attempt. The outer request loop reads
 * `kind` to decide whether to return, retry, retry-without-consuming-attempt,
 * or throw. `body` is the parsed JSON for a 2xx success.
 */
type AttemptResult =
  | { kind: 'success'; body: Record<string, unknown> | unknown[] }
  | { kind: 'fatal'; error: QubitonError }
  | { kind: 'retryable'; error: QubitonError; retryAfterSeconds?: number }
  | { kind: 'auth-retry'; error: QubitonError };

/**
 * Wrap a JSON response object so that `.raw` resolves to itself. We mutate
 * the decoded body in place rather than allocating a clone —
 * `response === response.raw` is `true` by design, which keeps memory flat
 * for large responses.
 *
 * Properties are pinned with `writable: false, configurable: false` to make
 * the `raw` slot tamper-resistant — callers can read it but cannot
 * accidentally reassign or delete it.
 *
 * Bodies flagged via {@link PRIMITIVE_BODY} (parsed from a JSON primitive
 * like `42` or `"hello"`) are passed through unchanged: writing a
 * self-referential `raw` on a `{ value: 42 }` envelope is misleading and
 * never matches what callers would expect.
 *
 * @internal
 */
function wrap<T extends BaseResponse>(data: Record<string, unknown>): T {
  if ((data as Record<symbol, unknown>)[PRIMITIVE_BODY]) {
    // Strip the internal symbol but do NOT add a self-referential raw — the
    // primitive lives on `value`, and there is no useful object envelope to
    // wrap. Callers who explicitly typed this as a typed response will get
    // a `value`-only object back; that's the correct outcome for a body
    // that was never object-shaped to begin with.
    delete (data as Record<symbol, unknown>)[PRIMITIVE_BODY];
    return data as unknown as T;
  }
  // Defensive: if the server happened to return a literal `raw` field, drop
  // it before pinning our self-reference — the SDK contract is that
  // `response.raw === response`, and a server-provided `raw` would mask it.
  if (Object.prototype.hasOwnProperty.call(data, 'raw')) {
    delete (data as Record<string, unknown>).raw;
  }
  Object.defineProperty(data, 'raw', {
    value: data,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return data as unknown as T;
}

function isObjectLike(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function sleep(ms: number, signal?: AbortSignal | null): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = (): void => {
      cleanup();
      // Caller-supplied AbortSignal aborted the retry-backoff wait —
      // surface this as QubitonAbortError so callers can distinguish it
      // from server timeouts.
      reject(new QubitonAbortError());
    };
    const cleanup = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };
    if (signal) {
      if (signal.aborted) {
        cleanup();
        reject(new QubitonAbortError());
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

/**
 * Parse a JSON response body. Object and array results are returned as-is
 * (callers handle each case). A primitive 2xx body (e.g. a bare number,
 * string, boolean, or `null` — uncommon but legal) is wrapped under
 * `{ value: <primitive> }` and tagged with `__primitive__: true` so the
 * caller can detect it and skip the {@link wrap} path (otherwise `wrap()`
 * would self-reference `raw`, producing a confusing `{ value, raw: <self> }`
 * shape that users would never expect).
 */
function parseJsonSafe(body: string): Record<string, unknown> | unknown[] | null {
  if (!body) return {};
  try {
    const parsed = JSON.parse(body) as unknown;
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }
    const wrapped: Record<string, unknown> = { value: parsed };
    (wrapped as Record<symbol, unknown>)[PRIMITIVE_BODY] = true;
    return wrapped;
  } catch {
    return null;
  }
}

/** Internal symbol used to flag bodies that were originally JSON primitives. */
const PRIMITIVE_BODY = Symbol('qubiton.primitiveBody');

/**
 * Extract a human-readable error message from the response envelope. The
 * QubitOn API returns errors in one of these shapes:
 *   { "error": "...", "statusCode": N }                 (modern BaseErrorResponse)
 *   { "message": "..." }                                (some endpoints)
 *   { "errorResponse": { "message": "...", ... } }      (legacy/cache)
 *   { "title": "...", "detail": "...", "errors": {...}} (ASP.NET ProblemDetails / 422)
 *
 * For 422 responses the ASP.NET model-validation middleware emits an
 * `errors` object — keys are field paths, values are arrays of validation
 * messages. We flatten the first few entries so callers see a meaningful
 * message rather than a generic "One or more validation errors occurred".
 */
function extractMessage(raw: Record<string, unknown> | undefined): string | undefined {
  if (!raw) return undefined;
  if (typeof raw.error === 'string' && raw.error) return raw.error;
  if (typeof raw.message === 'string' && raw.message) return raw.message;
  const er = raw.errorResponse;
  if (er && typeof er === 'object') {
    const ero = er as Record<string, unknown>;
    if (typeof ero.message === 'string' && ero.message) return ero.message;
    if (typeof ero.status === 'string' && ero.status) return ero.status;
  }
  // ASP.NET ModelState payload (`errors` map). The wrapper title/detail
  // is generic ("One or more validation errors occurred."), so prefer the
  // first specific field message when present.
  const errorsObj = raw.errors;
  if (errorsObj && typeof errorsObj === 'object' && !Array.isArray(errorsObj)) {
    const fields = errorsObj as Record<string, unknown>;
    const flattened: string[] = [];
    for (const [field, msgs] of Object.entries(fields)) {
      if (Array.isArray(msgs)) {
        for (const m of msgs) {
          if (typeof m === 'string' && m) {
            flattened.push(field ? `${field}: ${m}` : m);
            if (flattened.length >= 3) break;
          }
        }
      } else if (typeof msgs === 'string' && msgs) {
        flattened.push(field ? `${field}: ${msgs}` : msgs);
      }
      if (flattened.length >= 3) break;
    }
    if (flattened.length > 0) return flattened.join('; ');
  }
  if (typeof raw.detail === 'string' && raw.detail) return raw.detail;
  if (typeof raw.title === 'string' && raw.title) return raw.title;
  return undefined;
}

function classifyError(status: number, raw: Record<string, unknown> | undefined): QubitonError {
  const message = extractMessage(raw) ?? `HTTP ${status}`;
  if (status === 401 || status === 403) return new QubitonAuthError(status, message, raw);
  if (status === 404) return new QubitonNotFoundError(message, raw);
  if (status >= 400 && status < 500) return new QubitonValidationError(status, message, raw);
  return new QubitonError(status, message, raw);
}

/**
 * Parse an HTTP Retry-After header. Supports both delta-seconds and
 * HTTP-date formats per RFC 9110. Returns 0 on parse failure.
 *
 * Per RFC 9110 §10.2.3, the delta-seconds form is a non-negative integer.
 * We reject:
 *   - negative integers (`-5`)         — not valid delta-seconds
 *   - decimal floats (`1.5`, `0.25`)   — not valid delta-seconds
 *
 * For HTTP-date we truncate the delta (matches the Go SDK) so that a clock
 * showing 1.4 seconds remaining yields `1`, not `2`.
 */
function parseRetryAfter(header: string | null): number {
  if (!header) return 0;
  const trimmed = header.trim();
  if (!trimmed) return 0;
  // Reject anything that isn't a pure non-negative integer for the
  // delta-seconds path. `^\d+$` handles negative-sign rejection naturally
  // and excludes decimals — both are not valid Retry-After values. Once
  // the regex matches, `parseInt` always returns a finite non-negative
  // integer (the input is bounded to ASCII digits), so no `isFinite`
  // guard is needed.
  if (/^\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10);
  }
  // HTTP-date fallback.
  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) {
    const deltaSeconds = Math.trunc((parsed - Date.now()) / 1000);
    return Math.max(0, deltaSeconds);
  }
  return 0;
}

/**
 * Compute exponential backoff with ±25% jitter, capped at 30s. If the server
 * provided a Retry-After hint that exceeds the computed base, that hint is
 * used as the floor instead.
 */
function backoff(attempt: number, retryAfterSeconds: number): number {
  const baseMs = Math.pow(2, attempt) * 1000;
  const hintedMs = retryAfterSeconds * 1000;
  const floor = Math.max(baseMs, hintedMs);
  const jitter = (Math.random() - 0.5) * 0.5; // ±25%
  const delay = Math.floor(floor * (1 + jitter));
  return Math.max(0, Math.min(delay, MAX_BACKOFF_MS));
}

function normalizeDates(dates: string[] | string | undefined): string[] {
  if (!dates) return [];
  if (Array.isArray(dates)) return dates.filter((d) => d && d.trim());
  return dates
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);
}
