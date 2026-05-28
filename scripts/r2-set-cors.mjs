#!/usr/bin/env node
// One-shot R2 CORS setup using pure Node.js + S3 SigV4.
// Reads R2_* env vars from the repo .env file.
// Usage: node scripts/r2-set-cors.mjs

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

const ENDPOINT = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;
const HOST = `${ACCOUNT_ID}.r2.cloudflarestorage.com`;

// Build the CORS XML body
const CORS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <CORSRule>
    <AllowedOrigin>http://localhost:5173</AllowedOrigin>
    <AllowedOrigin>http://127.0.0.1:5173</AllowedOrigin>
    <AllowedOrigin>http://localhost:4173</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedMethod>POST</AllowedMethod>
    <AllowedMethod>DELETE</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <MaxAgeSeconds>3600</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>`;

const body = CORS_XML;
const bodyHash = createHash("sha256").update(body).digest("hex");
const contentMd5 = createHash("md5").update(body).digest("base64");

const now = new Date();
const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15) + "Z";
const dateStamp = amzDate.slice(0, 8);

const method = "PUT";
const canonicalUri = `/${BUCKET}`;
const canonicalQuery = "cors=";

const headers = {
  host: HOST,
  "content-md5": contentMd5,
  "content-type": "application/xml",
  "x-amz-content-sha256": bodyHash,
  "x-amz-date": amzDate,
};

const sortedKeys = Object.keys(headers).sort();
const canonicalHeaders =
  sortedKeys.map((k) => `${k}:${headers[k]}`).join("\n") + "\n";
const signedHeaders = sortedKeys.join(";");

const canonicalRequest = [
  method,
  canonicalUri,
  canonicalQuery,
  canonicalHeaders,
  signedHeaders,
  bodyHash,
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

const authorization = `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

const url = `${ENDPOINT}${canonicalUri}?cors`;

console.log(`PUT ${url}`);
console.log(`  bucket: ${BUCKET}`);
console.log(`  origins: localhost:5173, 127.0.0.1:5173, localhost:4173`);

const res = await fetch(url, {
  method: "PUT",
  headers: {
    ...headers,
    Authorization: authorization,
  },
  body,
});

const text = await res.text();
if (!res.ok) {
  console.error(`\n❌ HTTP ${res.status}`);
  console.error(text);
  process.exit(1);
}
console.log(`\n✅ HTTP ${res.status} — CORS applied`);
if (text.trim()) console.log(text);
