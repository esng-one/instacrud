// lib/tokenStorage.ts
/**
 * Token storage utility that supports both localStorage (persistent)
 * and sessionStorage (session-only) based on user preference.
 */

const TOKEN_KEY = "token";

/**
 * Get the token from either localStorage or sessionStorage
 */
export function getToken(): string | null {
  // Check localStorage first (persistent login)
  const localToken = localStorage.getItem(TOKEN_KEY);
  if (localToken) {
    return localToken;
  }

  // Fall back to sessionStorage (session-only login)
  return sessionStorage.getItem(TOKEN_KEY);
}

/**
 * Set the token in the appropriate storage
 * @param token - The token to store
 * @param persistent - If true, store in localStorage; otherwise sessionStorage
 */
export function setToken(token: string, persistent: boolean): void {
  if (persistent) {
    localStorage.setItem(TOKEN_KEY, token);
    // Clear from sessionStorage if it exists there
    sessionStorage.removeItem(TOKEN_KEY);
  } else {
    sessionStorage.setItem(TOKEN_KEY, token);
    // Clear from localStorage if it exists there
    localStorage.removeItem(TOKEN_KEY);
  }
}

/**
 * Remove the token from both storages
 */
export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}
