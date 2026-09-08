const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
let calls = 0, failure = null, available = true;
function load(file) {
  const filename = path.resolve(file), module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'exports', 'module', code)((id) => {
    if (id.endsWith('/supabase/server')) return { createSupabaseServerClient: async () => available ? ({ auth: { verifyOtp: async () => {
      calls++; return { error: failure, data: { user: { created_at: new Date().toISOString() }, session: {} } };
    } } }) : null };
    return id.startsWith('.') ? load(path.resolve(path.dirname(filename), `${id}.ts`)) : require(id);
  }, module.exports, module);
  return module.exports;
}
async function main() {
  const route = load('app/auth/email/verify/route.ts');
  assert.equal(route.GET, undefined, 'verification has no GET handler');
  const submit = (fields = {}, origin = 'https://geostats.xyz') => route.POST(new Request('https://geostats.xyz/auth/email/verify', {
    method: 'POST', headers: { origin }, body: new URLSearchParams({ token_hash: 'a'.repeat(64), type: 'email', next: '/daily/expert', ...fields }),
  }));
  let result = await submit({}, 'https://attacker.example');
  assert.equal(calls, 0);
  assert.match(result.headers.get('location'), /auth\/complete/);
  await submit({ type: 'email_change' });
  await submit({ token_hash: '<script>' });
  assert.equal(calls, 0, 'invalid requests never reach auth');
  result = await submit();
  assert.equal(calls, 1);
  assert.equal(result.status, 303);
  assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.match(result.headers.get('location'), /daily\/expert\?auth=success/);
  assert.ok(!result.headers.get('location').includes('token_hash'));
  for (const next of ['https://evil.example', '//evil.example', '/%5cevil.example']) {
    result = await submit({ next });
    assert.equal(new URL(result.headers.get('location')).pathname, '/daily');
  }
  failure = new Error('otp_expired');
  result = await submit();
  assert.match(decodeURIComponent(result.headers.get('location')).replace(/\+/g, ' '), /invalid, already used, or expired/);
  available = false;
  result = await submit();
  assert.match(decodeURIComponent(result.headers.get('location')).replace(/\+/g, ' '), /temporarily unavailable/);
  for (const name of ['confirmation','magic-link','recovery']) {
    const template = fs.readFileSync(`supabase/email-templates/${name}.html`, 'utf8');
    assert.ok(template.includes('/auth/email#token_hash={{ .TokenHash }}'));
    assert.ok(!template.includes('.ConfirmationURL'));
  }
  console.log('Email confirmation: explicit POST, origin checks, malformed tokens, redirects, auth failures, and templates passed.');
}
main().catch(error => { console.error(error); process.exit(1); });
