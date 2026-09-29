import "server-only";
import { createSession, requestMeta, setSessionCookie, type AuthMethod } from "./session";

/** Creates a session, sets the cookie and returns the token (for Bearer fallback). */
export async function signIn(userId: string, method: AuthMethod) {
  const meta = await requestMeta();
  const { token, expiresAt } = await createSession(userId, method, meta);
  await setSessionCookie(token, expiresAt);
  return { token };
}
