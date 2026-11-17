export function requiresNewAdminChallenge(code: string): boolean {
  return ["CHALLENGE_INVALID", "CHALLENGE_USED", "CHALLENGE_EXPIRED"].includes(code);
}
