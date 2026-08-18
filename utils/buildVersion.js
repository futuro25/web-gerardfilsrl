"use strict";

const fs = require("fs");
const path = require("path");

const MANIFEST_PATH = path.join(
  __dirname,
  "..",
  "client",
  "build",
  "asset-manifest.json"
);

/**
 * Identifica el build publicado usando el hash que CRA le pone al bundle
 * principal (main.3ff9d959.js). Cambia con cada deploy que modifique codigo,
 * asi que sirve de huella sin depender de variables de entorno.
 */
function readBuildVersion() {
  try {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
    const mainJs = (manifest.files && manifest.files["main.js"]) || "";
    const match = mainJs.match(/main\.([^.]+)\.js$/);
    return match ? match[1] : null;
  } catch (e) {
    // En desarrollo puede no haber build todavia.
    return null;
  }
}

// Se lee una sola vez: en Heroku el build corre antes de levantar el dyno.
const buildVersion = readBuildVersion();

module.exports = { buildVersion, readBuildVersion };
