#!/usr/bin/env node
"use strict";

/**
 * Cron: envía por email facturas pendientes sin orden de pago y cheques a vencer
 * en los próximos 30 días (nº, importe y proveedor pagado si está vinculado).
 *
 * Uso:
 *   node scripts/cron-pending-movements-report.js
 *
 * Variables de entorno:
 *   CRON_PENDING_MOVEMENTS_RECIPIENTS  destinatarios separados por coma (requerido)
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM
 *
 * Crontab ejemplo (todos los días a las 8:00):
 *   0 8 * * * cd /ruta/al/proyecto && APP_ENV=production node scripts/cron-pending-movements-report.js >> logs/cron-pending.log 2>&1
 */

try {
  require("dotenv").config({
    path: require("path").join(__dirname, "..", ".env"),
  });
} catch (_) {
  /* dotenv opcional */
}

const {
  sendPendingMovementsReport,
} = require("../services/pendingMovementsReportService");

async function main() {
  const recipients = process.env.CRON_PENDING_MOVEMENTS_RECIPIENTS;

  if (!recipients?.trim()) {
    console.error(
      "[cron-pending-movements] Falta CRON_PENDING_MOVEMENTS_RECIPIENTS (emails separados por coma)."
    );
    process.exit(1);
  }

  const to = recipients
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean)
    .join(", ");

  console.log(`[cron-pending-movements] Enviando reporte a: ${to}`);

  const result = await sendPendingMovementsReport({ to });

  if (!result.success) {
    console.error("[cron-pending-movements] Error:", result.error);
    process.exit(1);
  }

  console.log(
    `[cron-pending-movements] OK — ${result.summary.count} factura(s) pendiente(s), total ${result.summary.total}`
  );
  console.log(
    `[cron-pending-movements] Cheques a vencer — ${result.chequesSummary.count} cheque(s), total ${result.chequesSummary.total}`
  );
  if (result.messageId) {
    console.log(`[cron-pending-movements] messageId: ${result.messageId}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("[cron-pending-movements] Excepción:", err);
  process.exit(1);
});
