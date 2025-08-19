import { jwt } from "hono/jwt";
import { Context, Next } from "hono";
import { ErrorType, JWTPayload } from "../types/types";
import { getJwtSecret } from "../utils/jwt";
import { decrypt } from "../utils/encriptDecript";

export const verifyToken = async (c: Context, next: Next): Promise<any> => {
  try {
    const JWT_SECRET = getJwtSecret();

    if (!JWT_SECRET) {
      console.error("JWT_SECRET environment variable not configured");
      return c.json(
        {
          error: "Authentication service not configured",
          type: ErrorType.SERVER,
        },
        500
      );
    }

    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json(
        {
          error:
            "Authorization token required - please include Bearer token in Authorization header",
          type: ErrorType.AUTHENTICATION,
        },
        401
      );
    }

    const token = authHeader.split(" ")[1];
    if (!token || token.length < 10) {
      return c.json(
        {
          error: "Invalid token format",
          type: ErrorType.AUTHENTICATION,
        },
        401
      );
    }

    // Validate JWT structure
    const tokenParts = token.split(".");
    if (tokenParts.length !== 3) {
      return c.json(
        {
          error: "Malformed JWT token",
          type: ErrorType.AUTHENTICATION,
        },
        401
      );
    }

    try {
      // Verify JWT signature
      await jwt({ secret: JWT_SECRET })(c, async () => {});
    } catch (jwtError) {
      return c.json(
        {
          error: "Invalid token signature",
          type: ErrorType.AUTHENTICATION,
        },
        401
      );
    }

    // Decode payload
    let decodedPayload: JWTPayload;
    try {
      const payloadStr = atob(tokenParts[1]);
      decodedPayload = JSON.parse(payloadStr);
    } catch (decodeError) {
      return c.json(
        {
          error: "Invalid token payload",
          type: ErrorType.AUTHENTICATION,
        },
        401
      );
    }

    // Check expiration with buffer
    if (decodedPayload.exp && Date.now() >= decodedPayload.exp * 1000 - 30000) {
      // 30 second buffer
      return c.json(
        {
          error: "Token expired - please refresh your authentication",
          type: ErrorType.AUTHENTICATION,
        },
        401
      );
    }

    // Validate and decrypt cookies
    const encryptedCookies = decodedPayload.academiaCookies;
    if (!encryptedCookies || typeof encryptedCookies !== "string") {
      return c.json(
        {
          error: "No authentication cookies found in token",
          type: ErrorType.AUTHENTICATION,
        },
        401
      );
    }

    let decryptedCookies: string;
    try {
      decryptedCookies = await decrypt(encryptedCookies, JWT_SECRET);
    } catch (decryptError) {
      return c.json(
        {
          error: "Failed to decrypt authentication data - please login again",
          type: ErrorType.AUTHENTICATION,
        },
        401
      );
    }

    // Store decrypted cookies in context
    c.set("academiaCookies", decryptedCookies);
    await next();
  } catch (error: any) {
    console.error("JWT verification error:", error);
    return c.json(
      {
        error: "Authentication verification failed",
        type: ErrorType.AUTHENTICATION,
        details: error.message,
      },
      401
    );
  }
};
