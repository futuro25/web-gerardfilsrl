"use strict";

// Consulta de CUIT contra el padron de ARCA (ex AFIP) usando el web service
// ws_sr_constancia_inscripcion. Requiere un certificado digital emitido por ARCA
// para el CUIT de la empresa, con ese servicio asociado en "Administrador de
// Relaciones de Clave Fiscal".
//
// Variables de entorno:
//   ARCA_CUIT         CUIT de la empresa (la "representada")
//   ARCA_CERT         certificado en PEM (o ARCA_CERT_PATH con la ruta al archivo)
//   ARCA_KEY          clave privada en PEM (o ARCA_KEY_PATH con la ruta al archivo)
//   ARCA_ENV          "produccion" u "homologacion" (default: homologacion)

const fs = require("fs");
const forge = require("node-forge");
const { XMLParser } = require("fast-xml-parser");
const supabase = require("../controllers/db");

const SERVICE = "ws_sr_constancia_inscripcion";

const URLS = {
  homologacion: {
    wsaa: "https://wsaahomo.afip.gov.ar/ws/services/LoginCms",
    padron: "https://awshomo.afip.gov.ar/sr-padron/webservices/personaServiceA5",
  },
  produccion: {
    wsaa: "https://wsaa.afip.gov.ar/ws/services/LoginCms",
    padron: "https://aws.afip.gov.ar/sr-padron/webservices/personaServiceA5",
  },
};

// Codigos de impuesto del padron que usamos para derivar la condicion fiscal.
const IMPUESTO = {
  GANANCIAS_SOCIEDADES: 10,
  GANANCIAS_PERSONAS: 11,
  MONOTRIBUTO: 20,
  IVA: 30,
  IVA_EXENTO: 32,
};

const parser = new XMLParser({
  removeNSPrefix: true,
  ignoreAttributes: true,
  parseTagValue: false,
  isArray: (name) =>
    ["impuesto", "actividad", "categoriaMonotributo", "error"].includes(name),
});

class ArcaError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

function getEnv() {
  return process.env.ARCA_ENV === "produccion" ? "produccion" : "homologacion";
}

function readPem(contentVar, pathVar) {
  if (process.env[contentVar]) {
    // En Heroku los saltos de linea suelen quedar escapados como "\n".
    return process.env[contentVar].replace(/\\n/g, "\n");
  }
  if (process.env[pathVar]) return fs.readFileSync(process.env[pathVar], "utf8");
  return null;
}

function getCredentials() {
  const cuit = normalizeCuit(process.env.ARCA_CUIT);
  const cert = readPem("ARCA_CERT", "ARCA_CERT_PATH");
  const key = readPem("ARCA_KEY", "ARCA_KEY_PATH");
  if (!cuit || !cert || !key) {
    throw new ArcaError(
      "Consulta a ARCA no configurada: faltan ARCA_CUIT, ARCA_CERT o ARCA_KEY",
      503
    );
  }
  return { cuit, cert, key };
}

function normalizeCuit(value) {
  return String(value || "").replace(/\D/g, "");
}

function isValidCuit(value) {
  const cuit = normalizeCuit(value);
  if (cuit.length !== 11) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(cuit[i]), 0);
  let check = 11 - (sum % 11);
  if (check === 11) check = 0;
  if (check === 10) check = 9;
  return check === Number(cuit[10]);
}

async function postSoap(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: '""' },
    body,
  });
  const text = await response.text();
  const parsed = parser.parse(text);
  const envelopeBody = parsed?.Envelope?.Body;
  if (!envelopeBody) {
    throw new ArcaError(`Respuesta invalida de ARCA (HTTP ${response.status})`);
  }
  if (envelopeBody.Fault) {
    const fault = envelopeBody.Fault;
    throw new ArcaError(String(fault.faultstring || fault.detail || "Error de ARCA"));
  }
  return envelopeBody;
}

// ---------------------------------------------------------------------------
// WSAA: ticket de acceso (token + sign), valido 12 horas.
// ---------------------------------------------------------------------------

let cachedTicket = null;

function buildTra() {
  const now = Date.now();
  const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
  return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${Math.floor(now / 1000)}</uniqueId>
    <generationTime>${iso(now - 10 * 60 * 1000)}</generationTime>
    <expirationTime>${iso(now + 10 * 60 * 1000)}</expirationTime>
  </header>
  <service>${SERVICE}</service>
</loginTicketRequest>`;
}

function signTra(tra, certPem, keyPem) {
  const cert = forge.pki.certificateFromPem(certPem);
  const key = forge.pki.privateKeyFromPem(keyPem);
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(tra, "utf8");
  p7.addCertificate(cert);
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  });
  p7.sign();
  return forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes());
}

function isTicketValid(ticket) {
  // Margen de 5 minutos para no usar un ticket a punto de vencer.
  return ticket && new Date(ticket.expires_at).getTime() - 5 * 60 * 1000 > Date.now();
}

// El ticket se guarda en la base porque ARCA rechaza pedir uno nuevo mientras
// el anterior siga vigente, y el cache en memoria se pierde con cada reinicio.
async function loadStoredTicket(env) {
  const { data, error } = await supabase
    .from("arca_tokens")
    .select("token, sign, expires_at")
    .eq("service", SERVICE)
    .eq("environment", env)
    .maybeSingle();
  if (error) {
    console.error("arca_tokens: no se pudo leer el ticket", error.message);
    return null;
  }
  return data;
}

async function storeTicket(env, ticket) {
  const { error } = await supabase
    .from("arca_tokens")
    .upsert({ service: SERVICE, environment: env, ...ticket }, { onConflict: "service,environment" });
  if (error) console.error("arca_tokens: no se pudo guardar el ticket", error.message);
}

async function getTicket() {
  const env = getEnv();
  if (cachedTicket?.env === env && isTicketValid(cachedTicket)) return cachedTicket;

  const stored = await loadStoredTicket(env);
  if (isTicketValid(stored)) {
    cachedTicket = { env, ...stored };
    return cachedTicket;
  }

  const { cert, key } = getCredentials();
  const cms = signTra(buildTra(), cert, key);
  const body = await postSoap(
    URLS[env].wsaa,
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">
  <soapenv:Header/>
  <soapenv:Body><wsaa:loginCms><wsaa:in0>${cms}</wsaa:in0></wsaa:loginCms></soapenv:Body>
</soapenv:Envelope>`
  ).catch((e) => {
    if (/TA valido/i.test(e.message)) {
      throw new ArcaError(
        "ARCA ya emitio un ticket vigente que no quedo guardado; se libera solo en hasta 12 horas"
      );
    }
    throw e;
  });

  const loginResponse = parser.parse(body.loginCmsResponse.loginCmsReturn).loginTicketResponse;
  const ticket = {
    token: loginResponse.credentials.token,
    sign: loginResponse.credentials.sign,
    expires_at: new Date(loginResponse.header.expirationTime).toISOString(),
  };
  await storeTicket(env, ticket);
  cachedTicket = { env, ...ticket };
  return cachedTicket;
}

// ---------------------------------------------------------------------------
// Padron: constancia de inscripcion
// ---------------------------------------------------------------------------

function collectErrors(...sources) {
  return sources.flatMap((source) => (source?.error ? source.error.map(String) : []));
}

function formatPersona(cuit, persona) {
  const generales = persona.datosGenerales || {};
  const regimenGeneral = persona.datosRegimenGeneral || {};
  const monotributo = persona.datosMonotributo || null;

  const impuestos = [...(regimenGeneral.impuesto || []), ...(monotributo?.impuesto || [])].map(
    (imp) => ({ id: Number(imp.idImpuesto), descripcion: imp.descripcionImpuesto })
  );
  const tieneImpuesto = (id) => impuestos.some((imp) => imp.id === id);

  let condicionIva = "No inscripto";
  if (monotributo) condicionIva = "Monotributo";
  else if (tieneImpuesto(IMPUESTO.IVA)) condicionIva = "Responsable Inscripto";
  else if (tieneImpuesto(IMPUESTO.IVA_EXENTO)) condicionIva = "Exento";

  const inscriptoGanancias =
    tieneImpuesto(IMPUESTO.GANANCIAS_SOCIEDADES) || tieneImpuesto(IMPUESTO.GANANCIAS_PERSONAS);

  const domicilio = generales.domicilioFiscal;
  const razonSocial =
    generales.razonSocial ||
    [generales.apellido, generales.nombre].filter(Boolean).join(" ") ||
    null;

  return {
    cuit,
    activo: generales.estadoClave === "ACTIVO",
    estadoClave: generales.estadoClave || null,
    razonSocial,
    tipoPersona: generales.tipoPersona || null,
    domicilioFiscal: domicilio
      ? {
          direccion: domicilio.direccion || null,
          localidad: domicilio.localidad || null,
          provincia: domicilio.descripcionProvincia || null,
          codigoPostal: domicilio.codPostal || null,
        }
      : null,
    condicionIva,
    condicionGanancias: monotributo
      ? "Monotributo"
      : inscriptoGanancias
      ? "Inscripto"
      : "No inscripto",
    categoriaMonotributo: monotributo?.categoriaMonotributo?.[0]?.descripcionCategoria || null,
    impuestos,
    actividades: [...(regimenGeneral.actividad || []), ...(monotributo?.actividad || [])].map(
      (act) => ({ id: act.idActividad, descripcion: act.descripcionActividad })
    ),
    // ARCA informa aca problemas que impiden emitir la constancia (p. ej. domicilio
    // fiscal no confirmado), aunque la clave figure activa.
    observaciones: collectErrors(
      persona.errorConstancia,
      persona.errorRegimenGeneral,
      persona.errorMonotributo
    ),
    consultadoEn: new Date().toISOString(),
  };
}

async function getCuitStatus(rawCuit) {
  const cuit = normalizeCuit(rawCuit);
  if (!isValidCuit(cuit)) throw new ArcaError("CUIT invalido", 400);

  const { cuit: representada } = getCredentials();
  const { token, sign } = await getTicket();

  let body;
  try {
    body = await postSoap(
      URLS[getEnv()].padron,
      `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:a5="http://a5.soap.ws.server.puc.sr/">
  <soapenv:Header/>
  <soapenv:Body>
    <a5:getPersona_v2>
      <token>${token}</token>
      <sign>${sign}</sign>
      <cuitRepresentada>${representada}</cuitRepresentada>
      <idPersona>${cuit}</idPersona>
    </a5:getPersona_v2>
  </soapenv:Body>
</soapenv:Envelope>`
    );
  } catch (e) {
    if (/no existe persona/i.test(e.message)) {
      throw new ArcaError("El CUIT no existe en el padron de ARCA", 404);
    }
    throw e;
  }

  return formatPersona(cuit, body.getPersona_v2Response.personaReturn);
}

module.exports = { getCuitStatus, isValidCuit, normalizeCuit, ArcaError };
