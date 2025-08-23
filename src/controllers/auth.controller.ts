import { sign, verify } from "hono/jwt";
import {
  AuthProps,
  AuthResult,
  RefreshResult,
  ErrorResponse,
  LookupResponse,
  PasswordResponse,
} from "../types/types";
import { encrypt } from "../utils/encriptDecript";
import { getJwtSecret } from "../utils/jwt";
import { Context } from "hono";

const TIMEOUT_MS = 10000;
const MAX_RETRIES = 2;
const COOKIE_SEPARATOR = "; ";
const ACADEMIA_BASE_URL = "https://academia.srmist.edu.in";
const JWT_EXPIRY_DAYS = 7;

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES
): Promise<T> => {
  for (let i = 0; i <= retries; i += 1) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries) throw err;
      await sleep(2 ** i * 1000);
    }
  }
  throw new Error("Max retries exceeded");
};

const withTimeout = async <T>(promise: Promise<T>, ms: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Request timeout")), ms)
    ),
  ]);
};

const extractCookiesFromHeader = (setCookieHeader: string | null): string[] => {
  if (!setCookieHeader) return [];
  return setCookieHeader
    .split(/,(?=\s*[^=;]+=)/g)
    .map((c) => c.trim())
    .filter(Boolean)
    .map((cookie) => cookie.split(";")[0].trim());
};

const buildCookieHeader = (cookies: string[]): string => {
  const map = new Map<string, string>();
  cookies.forEach((cookie) => {
    const idx = cookie.indexOf("=");
    if (idx > 0) {
      const name = cookie.slice(0, idx).trim();
      const value = cookie.slice(idx + 1).trim();
      map.set(name, value);
    }
  });
  return Array.from(map.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join(COOKIE_SEPARATOR);
};

const extractCsrfToken = (cookies: string[]): string => {
  const cookie = cookies.find((c) => c.startsWith("iamcsr="));
  return cookie ? cookie.split("=")[1] : "";
};

const normalizeUsername = (username: string): string => {
  const trimmed = (username || "").trim().toLowerCase();
  if (!trimmed) throw new Error("Username cannot be empty");
  return trimmed.includes("@srmist.edu.in")
    ? trimmed
    : `${trimmed}@srmist.edu.in`;
};

const validatePassword = (password: string): void => {
  if (!password || !password.trim())
    throw new Error("Password cannot be empty");
};

const createRequest = (
  method: "GET" | "POST",
  headers: Record<string, string> = {},
  body?: string | object
): RequestInit => {
  const base: Record<string, string> = {
    Accept: "*/*",
    "User-Agent": "Mozilla/5.0",
    ...headers,
  };
  const init: RequestInit = { method, headers: base, redirect: "manual" };
  if (body) {
    if (typeof body === "string") {
      init.body = body;
      base["Content-Type"] =
        base["Content-Type"] ??
        "application/x-www-form-urlencoded;charset=UTF-8";
    } else {
      init.body = JSON.stringify(body);
      base["Content-Type"] = "application/json;charset=UTF-8";
    }
  }
  return init;
};

const fetchWithRetry = (url: string, init: RequestInit) =>
  withTimeout(
    retryWithBackoff(() => fetch(url, init)),
    TIMEOUT_MS
  );

const initialRequests = async (): Promise<string[]> => {
  const urls = [
    `${ACADEMIA_BASE_URL}/`,
    `${ACADEMIA_BASE_URL}/accounts/p/10002227248/signin?hide_fp=true&servicename=ZohoCreator&service_language=en&css_url=/49910842/academia-academic-services/downloadPortalCustomCss/login&dcc=true&serviceurl=https%3A%2F%2Facademia.srmist.edu.in%2Fportal%2Facademia-academic-services%2FredirectFromLogin`,
  ];
  const responses = await Promise.all(
    urls.map((u) =>
      fetchWithRetry(
        u,
        createRequest("GET", { Referer: `${ACADEMIA_BASE_URL}/` })
      )
    )
  );
  const cookies: string[] = [];
  responses.forEach((res) => {
    if (!res.ok) throw new Error(`Init request failed with ${res.status}`);
    cookies.push(...extractCookiesFromHeader(res.headers.get("set-cookie")));
  });
  if (!cookies.length) throw new Error("No session cookies received");
  return cookies;
};

const userLookup = async (
  username: string,
  cookies: string[]
): Promise<{ lookup: LookupResponse; cookies: string[] }> => {
  const csrf = extractCsrfToken(cookies);
  const cliTime = Date.now();
  const serviceUrl = `${ACADEMIA_BASE_URL}/portal/academia-academic-services/redirectFromLogin`;
  const body = `mode=primary&cli_time=${cliTime}&servicename=ZohoCreator&service_language=en&serviceurl=${serviceUrl}`;
  const url = `${ACADEMIA_BASE_URL}/accounts/p/10002227248/signin/v2/lookup/${username}`;
  const res = await fetchWithRetry(
    url,
    createRequest(
      "POST",
      {
        Cookie: buildCookieHeader(cookies),
        Origin: ACADEMIA_BASE_URL,
        Referer: `${ACADEMIA_BASE_URL}/accounts/p/10002227248/signin`,
        "X-Zcsrf-Token": `iamcsrcoo=${csrf}`,
      },
      body
    )
  );
  if (!res.ok) throw new Error(`User lookup failed: ${res.status}`);
  const data = (await res.json()) as LookupResponse;
  return {
    lookup: data,
    cookies: extractCookiesFromHeader(res.headers.get("set-cookie")),
  };
};

const passwordAuth = async (
  password: string,
  identifier: string,
  digest: string,
  cookies: string[]
): Promise<string[]> => {
  const csrf = extractCsrfToken(cookies);
  const cliTime = Date.now();
  const serviceUrl = `${ACADEMIA_BASE_URL}/portal/academia-academic-services/redirectFromLogin`;
  const url = `${ACADEMIA_BASE_URL}/accounts/p/10002227248/signin/v2/primary/${encodeURIComponent(
    identifier
  )}/password?digest=${encodeURIComponent(
    digest
  )}&cli_time=${cliTime}&servicename=ZohoCreator&service_language=en&serviceurl=${encodeURIComponent(
    serviceUrl
  )}`;
  const res = await fetchWithRetry(
    url,
    createRequest(
      "POST",
      {
        Cookie: buildCookieHeader(cookies),
        Origin: ACADEMIA_BASE_URL,
        Referer: `${ACADEMIA_BASE_URL}/accounts/p/10002227248/signin`,
        "X-Zcsrf-Token": `iamcsrcoo=${csrf}`,
      },
      { passwordauth: { password } }
    )
  );
  if (!res.ok) throw new Error(`Password auth failed: ${res.status}`);
  try {
    const json = (await res.json()) as PasswordResponse;
    if (!json.message?.toLowerCase().includes("success"))
      throw new Error(json.message);
  } catch (_) {
    /* ignore json parse errors */
  }
  return extractCookiesFromHeader(res.headers.get("set-cookie"));
};

export const auth = async (c: Context): Promise<any> => {
  const start = Date.now();
  try {
    const payload = (await c.req.json()) as AuthProps;
    if (!payload?.username || !payload?.password) {
      return c.json({
        error: "Username and password are required",
        success: false,
      } as ErrorResponse);
    }

    const username = normalizeUsername(payload.username);
    validatePassword(payload.password);

    const jwtSecret = getJwtSecret();

    // Step 1: session cookies
    let cookies = await initialRequests();

    // Step 2: lookup
    const { lookup, cookies: lookupCookies } = await userLookup(
      username,
      cookies
    );
    cookies.push(...lookupCookies);
    if (lookup.message !== "User exists" || !lookup.lookup) {
      return c.json({
        error: lookup.message || "User not found",
        success: false,
      } as ErrorResponse);
    }

    // Step 3: password auth
    const pwdCookies = await passwordAuth(
      payload.password,
      lookup.lookup.identifier,
      lookup.lookup.digest,
      cookies
    );
    cookies.push(...pwdCookies);

    const cookieString = buildCookieHeader(cookies);
    const encryptedCookies = await encrypt(cookieString, jwtSecret);

    // Calculate expiration time (7 days from now)
    const expirationTime =
      Math.floor(Date.now() / 1000) + JWT_EXPIRY_DAYS * 24 * 60 * 60;

    const token = await sign(
      {
        userId: username,
        academiaCookies: encryptedCookies,
        exp: expirationTime,
      },
      jwtSecret
    );

    return c.json({
      token,
      email: username,
      success: true,
      message: "Authentication successful",
    } as AuthResult);
  } catch (err: any) {
    console.error("Auth error:", err);
    return c.json({
      error: "Authentication failed",
      details: err?.message,
      success: false,
    } as ErrorResponse);
  }
};

export const checkAuth = async (c: Context): Promise<any> => {
  try {
    const token = c.req.header("authorization")?.replace("Bearer ", "");
    if (!token)
      return c.json({ success: false, error: "Unauthorized" } as ErrorResponse);

    const jwtSecret = getJwtSecret();
    await verify(token, jwtSecret);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({
      error: "Invalid/Expired token",
      details: err?.message,
      success: false,
    } as ErrorResponse);
  }
};

export const refreshToken = async (c: Context): Promise<any> => {
  try {
    const academiaCookies = c.get('academiaCookies');
    
    if (!academiaCookies) {
      return c.json({
        error: "No valid session found",
        success: false,
      } as ErrorResponse);
    }

    const jwtSecret = getJwtSecret();
    
    const expirationTime = Math.floor(Date.now() / 1000) + JWT_EXPIRY_DAYS * 24 * 60 * 60;
    
    const userId = c.get('userId') || 'unknown';
    
    const newToken = await sign(
      {
        userId: userId,
        academiaCookies: academiaCookies,
        exp: expirationTime,
      },
      jwtSecret
    );

    return c.json({
      token: newToken,
      email: userId,
      success: true,
      message: "Token refreshed successfully",
      expiresIn: JWT_EXPIRY_DAYS * 24 * 60 * 60,
    } as RefreshResult);
  } catch (err: any) {
    console.error("Token refresh error:", err);
    return c.json({
      error: "Failed to refresh token",
      details: err?.message,
      success: false,
    } as ErrorResponse);
  }
};
