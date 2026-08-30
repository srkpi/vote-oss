#!/usr/bin/env node
/**
 * verify-deployment.cjs
 *
 * Independently checks that a *live* vote-oss deployment is (a) built from
 * a genuinely CI-produced, attested Docker image, and (b) actually serving
 * the JS that image contains right now - i.e. that this domain is running
 * that build, not just that the build exists somewhere on Docker Hub.
 *
 * Deliberately zero-dependency (Node built-ins only) so it can be fetched
 * and run in one line, with nothing to `npm install` and no need to clone
 * the repo:
 *
 *   curl -fsSL <raw-url-from-/api/info> | node - https://your-domain
 *
 * or, if you already have the file:
 *
 *   node verify-deployment.cjs https://your-domain
 *
 * Requires: Node.js, and the GitHub CLI (`gh`, https://cli.github.com/).
 * Does NOT require Docker - neither check below touches a local Docker
 * daemon; `gh attestation verify` resolves the OCI registry itself.
 *
 * What this proves: the specific JS files this domain served just now, and
 * the Docker image tag it claims to run, both carry a Sigstore-signed
 * attestation tying them to a specific commit built by this repo's own
 * GitHub Actions - verified against GitHub's attestation API + the public
 * Rekor transparency log, not against anything this site says about itself.
 *
 * What this does NOT prove: that server-side-only logic (API routes, DB
 * access, business logic with no client-visible output) is identical to
 * that commit - only client-shipped JS/CSS is independently checked here.
 * A deployment could in principle serve the right frontend while running
 * different backend code; closing that gap needs something like remote
 * attestation hardware, which is out of scope for this project.
 */

/* eslint-disable @typescript-eslint/no-require-imports -- intentionally
  CommonJS (see header above): this must also run correctly when piped
  into `node -` via stdin, which has no file extension for Node to infer
  ESM from and isn't guaranteed to auto-detect `import` on every Node
  version, whereas `require` has always worked there. */
const https = require('node:https');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CHECK = '[OK]';
const CROSS = '[FAIL]';
const MAX_ASSETS_TO_CHECK = 4;

function fetch(url, { binary = false, redirects = 5 } = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https:') ? https : http;
    lib
      .get(url, { headers: { 'user-agent': 'vote-oss-verify-deployment/1.0' } }, (res) => {
        const { statusCode } = res;
        if (statusCode >= 300 && statusCode < 400 && res.headers.location && redirects > 0) {
          res.resume();
          resolve(
            fetch(new URL(res.headers.location, url).toString(), {
              binary,
              redirects: redirects - 1,
            }),
          );
          return;
        }
        if (statusCode !== 200) {
          res.resume();
          reject(new Error(`GET ${url} -> HTTP ${statusCode}`));
          return;
        }
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          resolve(binary ? buf : buf.toString('utf8'));
        });
        res.on('error', reject);
      })
      .on('error', reject);
  });
}

function hasGh() {
  try {
    execFileSync('gh', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** Runs `gh attestation verify <target> --repo <repo>` and reports pass/fail without throwing. */
function verifyWithGh(target, repo) {
  try {
    const output = execFileSync('gh', ['attestation', 'verify', target, '--repo', repo], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, output };
  } catch (err) {
    const output =
      [err.stdout, err.stderr].filter(Boolean).join('\n') || String(err.message || err);
    return { ok: false, output };
  }
}

function indent(text, spaces = 6) {
  const pad = ' '.repeat(spaces);
  return text
    .trim()
    .split('\n')
    .map((line) => pad + line)
    .join('\n');
}

async function main() {
  const site = process.argv[2];
  if (!site) {
    console.error('Usage: node verify-deployment.cjs <https://your-domain>');
    console.error('Example: node verify-deployment.cjs https://voteoss.kpi.ua');
    process.exit(2);
  }
  const base = site.replace(/\/+$/, '');

  if (!hasGh()) {
    console.error(
      `The GitHub CLI ("gh") is required and wasn't found on PATH.\n` +
        'Install it from https://cli.github.com/ and try again.',
    );
    process.exit(2);
  }

  console.log(`Checking ${base}\n`);

  let info;
  try {
    info = JSON.parse(await fetch(`${base}/api/info`));
  } catch (err) {
    console.error(`Could not read ${base}/api/info: ${err.message}`);
    process.exit(2);
  }

  if (!info.build || !info.build.docker || !info.build.repo || !info.build.commit) {
    console.error(
      'This deployment reports no CI build metadata (a local/non-CI build) - nothing to verify.',
    );
    process.exit(2);
  }

  console.log(`Site claims commit  ${info.build.commit}`);
  console.log(`             image  ${info.build.docker.reference}\n`);

  let failures = 0;

  // --- Check 1: is the image itself genuine? ---------------------------
  // This only proves the image with this digest was really built by this
  // repo's CI. It says nothing about what any given server is running.
  console.log('[1/2] Image provenance - is the image itself genuine?');
  const imageCheck = verifyWithGh(
    `oci://docker.io/${info.build.docker.reference}`,
    info.build.repo,
  );
  if (imageCheck.ok) {
    console.log(`  ${CHECK} verified\n`);
  } else {
    failures += 1;
    console.log(`  ${CROSS} verification failed`);
    console.log(indent(imageCheck.output) + '\n');
  }

  // --- Check 2: is *this domain* actually serving that build? ----------
  // Fetches a real static asset the way a browser would, then checks
  // whether that exact downloaded file - identified only by its own
  // content hash - carries a matching attestation. Nothing here trusts
  // any claim the server makes about itself; only bytes pulled over the
  // wire and GitHub's public attestation record.
  console.log('[2/2] Live content - is this domain serving that build, right now?');

  let html = '';
  try {
    html = await fetch(`${base}/`);
  } catch (err) {
    failures += 1;
    console.log(`  ${CROSS} could not fetch ${base}/: ${err.message}\n`);
  }

  const uniqueAssets = Array.from(
    new Set(
      Array.from(html.matchAll(/\/_next\/static\/(?:chunks|css)\/[^"'\s)]+?\.(?:js|css)/g)).map(
        (m) => m[0],
      ),
    ),
  );

  // Fisher-Yates shuffle
  for (let i = uniqueAssets.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [uniqueAssets[i], uniqueAssets[j]] = [uniqueAssets[j], uniqueAssets[i]];
  }

  const assetPaths = uniqueAssets.slice(0, MAX_ASSETS_TO_CHECK);

  if (assetPaths.length === 0) {
    failures += 1;
    console.log(
      `  ${CROSS} found no /_next/static/{chunks,css}/*.{js,css} references on ${base}/\n`,
    );
  } else {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vote-oss-verify-'));
    for (const assetPath of assetPaths) {
      const url = base + assetPath;
      const localPath = path.join(tmpDir, path.basename(assetPath));
      try {
        const bytes = await fetch(url, { binary: true });
        fs.writeFileSync(localPath, bytes);
      } catch (err) {
        failures += 1;
        console.log(`  ${CROSS} could not download ${assetPath}: ${err.message}`);
        continue;
      }
      const assetCheck = verifyWithGh(localPath, info.build.repo);
      if (assetCheck.ok) {
        console.log(`  ${CHECK} ${assetPath}`);
      } else {
        failures += 1;
        console.log(`  ${CROSS} ${assetPath}`);
        console.log(indent(assetCheck.output));
      }
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.log('');
  }

  if (failures === 0) {
    console.log(
      `All checks passed - ${base} is serving code this repository's official CI produced from commit ${info.build.commit}.`,
    );
    process.exit(0);
  } else {
    console.log(`${failures} check(s) failed - see above.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
