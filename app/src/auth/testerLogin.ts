// Testers get one shared access code instead of individual accounts. Supabase auth needs an
// email + password, so the app signs in to a single shared account with that fixed email and
// uses the access code as its password. Supabase verifies the code server-side; nothing secret
// is stored in this repo. The domain is reserved for documentation (example.com), so it can
// never be a real mailbox and no email is ever sent to it.
export const TESTER_EMAIL = 'bantamb@testers.example.com'

// The Supabase password for the tester account must be stored all-lowercase, because this
// normalizes what testers type, so "BantamB" and "bantamb" behave the same.
export function normalizeAccessCode(code: string): string {
  return code.trim().toLowerCase()
}
