const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

const account = read("components/AccountControls.tsx");
const browser = read("lib/supabase/browser.ts");
const callback = read("app/auth/callback/route.ts");
const setup = read("supabase/GEOSTATS_AUTH_EMAIL_SETUP.md");
const confirmation = read("supabase/email-templates/confirmation.html");
const magicLink = read("supabase/email-templates/magic-link.html");

check(account.includes('provider: "google"') && account.includes("Continue with Google"), "Google OAuth flow is missing");
check(account.includes("shouldCreateUser: true"), "email flow does not explicitly support new-account creation");
check(account.includes("Continue with email") && account.includes("automatically signed up"), "email sign-up copy is ambiguous");
check(!account.includes("googleProviderIsEnabled") && !account.includes("googleAvailable"), "Google flow still depends on client-side provider preflight state");
check(!/onAuthStateChange\(async/.test(account) && account.includes("window.setTimeout"), "auth callback still awaits network work inline");
check(browser.includes('flowType: "pkce"') && browser.includes("persistSession: true"), "browser client is not configured for durable PKCE sessions");
check(callback.includes("exchangeCodeForSession") && callback.includes("verifyOtp"), "callback route does not handle OAuth and email links");
for (const token of ["accounts@geostats.xyz", "custom SMTP", "SPF", "DKIM", "DMARC", "Google Cloud", "auth/v1/callback"]) check(setup.includes(token), `auth setup guide missing ${token}`);
check(confirmation.includes("token_hash=") && magicLink.includes("token_hash="), "branded email templates do not use PKCE token hashes");

if (failures.length) {
  console.error(`GeoStats auth checks FAILED:\n${failures.map((item) => ` - ${item}`).join("\n")}`);
  process.exit(1);
}
console.log("GeoStats auth checks passed.");
