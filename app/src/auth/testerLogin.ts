// Supabase email/password auth is keyed on an email address, but testers are handed a plain
// username. This maps one to the other. The domain is reserved for documentation
// (example.com), so it can never be a real mailbox and no email is ever sent to it.
export const TESTER_EMAIL_DOMAIN = 'testers.example.com'

export function testerEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${TESTER_EMAIL_DOMAIN}`
}
