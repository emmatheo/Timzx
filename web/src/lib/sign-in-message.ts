/**
 * The exact text a wallet signs to open a session.
 *
 * Shared by the client that requests the signature and the route handler that verifies it. Kept in
 * one module deliberately: if the two ever built this string separately, a wording change on one
 * side would reject every sign-in on the other, and the failure would look like a wallet problem
 * rather than a drift between two copies.
 *
 * The server rebuilds it from the nonce it issued rather than trusting anything in the request, so
 * a caller cannot obtain a signature over text of their own choosing and have it accepted.
 */
export function signInMessage(address: string, nonce: string): string {
  return [
    'TImx sign-in',
    '',
    'Sign this message to prove you control this wallet. It authorises no transaction and',
    'transfers no funds.',
    '',
    `Address: ${address}`,
    `Nonce: ${nonce}`,
  ].join('\n');
}
