#!/usr/bin/env node
// =============================================================================
// r2-put-tool.mjs — stage a tool asset (e.g. the gated Hailo DFC wheel) into
// R2 under the private ``tools/`` prefix, using pure Node + S3 SigV4.
// Counterpart to the ``download-tool`` edge function (which only issues GETs).
//
// Reads R2_* env vars from the repo .env file.
// Usage:
//   node scripts/r2-put-tool.mjs <local-file> <r2-key>
//   node scripts/r2-put-tool.mjs ~/Downloads/hailo_dataflow_compiler-3.33.1-...whl \
//        tools/hailo/hailo_dataflow_compiler-3.33.1-py3-none-linux_x86_64.whl
// =============================================================================

import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, "..", ".env");

function loadEnv(path) {
  const txt = readFileSync(path, "utf8");
  const env = {};
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const [, , LOCAL, KEY] = process.argv;
if (!LOCAL || !KEY) {
  console.error("usage: node scripts/r2-put-tool.mjs <local-file> <r2-key>");
  process.exit(2);
}
if (!/^tools\//.test(KEY)) {
  console.error(`refusing: r2-key must start with 'tools/' (got '${KEY}')`);
  process.exit(2);
}

const env = loadEnv(ENV_PATH);
const ACCOUNT_ID = env.R2_ACCOUNT_ID;
const ACCESS_KEY = env.R2_ACCESS_KEY_ID;
const SECRET_KEY = env.R2_SECRET_ACCESS_KEY;
const BUCKET = env.R2_BUCKET;
const REGION = "auto";
const SERVICE = "s3";
if (!ACCOUNT_ID || !ACCESS_KEY || !SECRET_KEY || !BUCKET) {
  console.error("Missing R2_* env vars in .env");
  process.exit(1);
}

const HOST = `${ACCOUNT_ID}.r2.cloudflarestorage.com`;
const ENDPOINT = `https://${HOST}`;

const body = readFileSync(LOCAL); // Buffer
const bodyHash = createHash("sha256").update(body).digest("hex");

const now = new Date();
const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15) + "Z";
const dateStamp = amzDate.slice(0, 8);

const method = "PUT";
// path-style; key segments here are URL-safe (alnum . _ - /), no encoding needed
const canonicalUri = `/${BUCKET}/${KEY}`;
const canonicalQuery = "";

const headers = {
  host: HOST,
  "content-type": "application/octet-stream",
  "x-amz-content-sha256": bodyHash,
  "x-amz-date": amzDate,
};
const sortedKeys = Object.keys(headers).sort();
const canonicalHeaders = sortedKeys.map((k) => `${k}:${headers[k]}`).join("\n") + "\n";
const signedHeaders = sortedKeys.join(";");

const canonicalRequest = [
  method, canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, bodyHash,
].join("\n");

const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
const stringToSign = [
  "AWS4-HMAC-SHA256",
  amzDate,
  credentialScope,
  createHash("sha256").update(canonicalRequest).digest("hex"),
].join("\n");

function sign(key, msg) {
  return createHmac("sha256", key).update(msg).digest();
}
const kDate = sign("AWS4" + SECRET_KEY, dateStamp);
const kRegion = sign(kDate, REGION);
const kService = sign(kRegion, SERVICE);
const kSigning = sign(kService, "aws4_request");
const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");

const authorization =
  `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${credentialScope}, ` +
  `SignedHeaders=${signedHeaders}, Signature=${signature}`;

const url = `${ENDPOINT}${canonicalUri}`;
console.log(`PUT ${url}`);
console.log(`  size: ${(body.length / 1048576).toFixed(1)} MB · sha256: ${bodyHash.slice(0, 16)}…`);

const res = await fetch(url, {
  method: "PUT",
  headers: { ...headers, Authorization: authorization },
  body,
});
const text = await res.text();
if (!res.ok) {
  console.error(`\n❌ HTTP ${res.status}\n${text}`);
  process.exit(1);
}
console.log(`\n✅ HTTP ${res.status} — staged → ${KEY}`);
