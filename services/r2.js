"use strict";

const crypto = require("crypto");
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "";
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "";
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const BUCKET = process.env.R2_BUCKET || "invoices";
const ENDPOINT =
  process.env.R2_ENDPOINT ||
  (ACCOUNT_ID ? `https://${ACCOUNT_ID}.r2.cloudflarestorage.com` : "");

let client = null;

function getClient() {
  if (!ENDPOINT || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
    throw new Error(
      "Cloudflare R2 no está configurado. Definí R2_ACCOUNT_ID, R2_ACCESS_KEY_ID y R2_SECRET_ACCESS_KEY."
    );
  }
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: ENDPOINT,
      credentials: {
        accessKeyId: ACCESS_KEY_ID,
        secretAccessKey: SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

function extFromName(name = "", mimetype = "") {
  const fromName = (name.match(/\.[a-zA-Z0-9]+$/) || [""])[0];
  if (fromName) return fromName.toLowerCase();
  const map = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "application/pdf": ".pdf",
  };
  return map[mimetype] || "";
}

async function uploadBuffer({ buffer, contentType, originalName, prefix = "" }) {
  const ext = extFromName(originalName, contentType);
  const key = `${prefix}${Date.now()}-${crypto.randomUUID()}${ext}`;

  await getClient().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType || "application/octet-stream",
    })
  );

  return key;
}

async function getPresignedGetUrl(key, expiresIn = 3600) {
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn }
  );
}

async function deleteObject(key) {
  await getClient().send(
    new DeleteObjectCommand({ Bucket: BUCKET, Key: key })
  );
}

module.exports = {
  uploadBuffer,
  getPresignedGetUrl,
  deleteObject,
  bucket: BUCKET,
};
