"use strict";

const { DateTime } = require("luxon");
const supabase = require("../controllers/db");
const {
  attachPaycheckSupplier,
} = require("../controllers/PaycheckController");

const CHEQUES_DUE_DAYS = 30;

function formatAmount(value) {
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return "$ 0,00";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(n);
}

const SOURCE_LABELS = {
  control: "Control",
  cashflow: "Cashflow",
};

function itemDate(item) {
  if (!item.date) return "—";
  const d = DateTime.fromISO(item.date);
  return d.isValid ? d.toFormat("dd/MM/yyyy") : "—";
}

function itemAmount(item) {
  return Math.abs(parseFloat(item.total ?? item.amount) || 0);
}

// Facturas (Control + Cashflow) sin orden de pago — misma fuente que /payment-orders/pending.
async function fetchPendingMovements() {
  const {
    computePendingItems,
  } = require("../controllers/PaymentOrderController");
  return computePendingItems();
}

function chequeDate(item) {
  if (!item.due_date) return "—";
  const d = DateTime.fromISO(item.due_date);
  return d.isValid ? d.toFormat("dd/MM/yyyy") : "—";
}

function chequeAmount(item) {
  return Math.abs(parseFloat(item.amount) || 0);
}

async function fetchChequesDueWithinDays(days = CHEQUES_DUE_DAYS) {
  const zone = "America/Argentina/Buenos_Aires";
  const today = DateTime.now().setZone(zone).startOf("day");
  const until = today.plus({ days });

  const { data, error } = await supabase
    .from("paychecks")
    .select("*")
    .gte("due_date", today.toISODate())
    .lte("due_date", until.toISODate())
    .is("deleted_at", null)
    .order("due_date", { ascending: true });

  if (error) throw error;

  return attachPaycheckSupplier(data || []);
}

function buildChequesSummary(cheques) {
  let total = 0;
  cheques.forEach((c) => {
    total += chequeAmount(c);
  });
  return {
    count: cheques.length,
    total,
  };
}

function buildSummary(movements) {
  let total = 0;

  movements.forEach((m) => {
    total += itemAmount(m);
  });

  return {
    count: movements.length,
    total,
  };
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildChequesSectionHtml(cheques, chequesSummary) {
  const rowsHtml =
    cheques.length === 0
      ? `<tr><td colspan="4" style="padding:16px;text-align:center;color:#64748b;">No hay cheques a vencer en los próximos ${CHEQUES_DUE_DAYS} días.</td></tr>`
      : cheques
          .map((c) => {
            const amount = chequeAmount(c);
            const bankNote = c.bank
              ? `<br><small style="color:#2563eb;">${escapeHtml(c.bank)}</small>`
              : "";
            return `<tr>
              <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(chequeDate(c))}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(c.number || "—")}${bankNote}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(c.supplier_name || "—")}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">${formatAmount(amount)}</td>
            </tr>`;
          })
          .join("");

  return `
    <div style="margin-top:28px;padding-top:24px;border-top:2px solid #e2e8f0;">
      <h2 style="margin:0 0 8px;font-size:18px;color:#1e40af;">Cheques a vencer (próximos ${CHEQUES_DUE_DAYS} días)</h2>
      <p style="margin:0 0 16px;font-size:14px;"><strong>${chequesSummary.count}</strong> cheque(s) por un total de <strong>${formatAmount(chequesSummary.total)}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#eff6ff;">
            <th style="text-align:left;padding:8px 10px;">Vencimiento</th>
            <th style="text-align:left;padding:8px 10px;">Nº cheque</th>
            <th style="text-align:left;padding:8px 10px;">Pagado a</th>
            <th style="text-align:right;padding:8px 10px;">Importe</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot>
          <tr style="background:#eff6ff;font-weight:bold;font-size:15px;">
            <td colspan="3" style="padding:14px 10px;text-align:right;border-top:2px solid #bfdbfe;">Total</td>
            <td style="padding:14px 10px;text-align:right;border-top:2px solid #bfdbfe;">${formatAmount(chequesSummary.total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>`;
}

function buildReportHtml(movements, summary, cheques, chequesSummary) {
  const generatedAt = DateTime.now().setZone("America/Argentina/Buenos_Aires").toFormat(
    "dd/MM/yyyy HH:mm"
  );

  const rowsHtml =
    movements.length === 0
      ? `<tr><td colspan="4" style="padding:16px;text-align:center;color:#64748b;">No hay facturas pendientes sin orden de pago.</td></tr>`
      : movements
          .map((m) => {
            const amount = itemAmount(m);
            const detail = escapeHtml(m.description || "—");
            const subBits = [
              m.invoice_number
                ? `Factura ${escapeHtml(m.invoice_number)}`
                : "",
              SOURCE_LABELS[m.source] || "",
            ].filter(Boolean);
            const subNote = subBits.length
              ? `<br><small style="color:#2563eb;">${subBits.join(" · ")}</small>`
              : "";
            return `<tr>
              <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(itemDate(m))}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(m.supplier_name || "—")}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${detail}${subNote}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">${formatAmount(amount)}</td>
            </tr>`;
          })
          .join("");

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>Reporte diario</title></head>
<body style="font-family:Arial,sans-serif;color:#1e293b;line-height:1.5;margin:0;padding:24px;background:#f8fafc;">
  <div style="max-width:720px;margin:0 auto;background:#fff;border-radius:8px;border:1px solid #e2e8f0;overflow:hidden;">
    <div style="background:#fef3c7;padding:20px 24px;border-bottom:1px solid #fde68a;">
      <h1 style="margin:0 0 8px;font-size:20px;color:#92400e;">Reporte diario — Facturas y cheques</h1>
      <p style="margin:0;font-size:13px;color:#78716c;">Generado el ${escapeHtml(generatedAt)} (hora Argentina)</p>
    </div>
    <div style="padding:20px 24px;">
      <h2 style="margin:0 0 8px;font-size:18px;color:#92400e;">Facturas pendientes (sin orden de pago)</h2>
      <p style="margin:0 0 16px;font-size:14px;"><strong>${summary.count}</strong> factura(s) pendiente(s) sin orden de pago.</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="text-align:left;padding:8px 10px;">Fecha</th>
            <th style="text-align:left;padding:8px 10px;">Proveedor</th>
            <th style="text-align:left;padding:8px 10px;">Detalle</th>
            <th style="text-align:right;padding:8px 10px;">Monto</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot>
          <tr style="background:#fef3c7;font-weight:bold;font-size:15px;">
            <td colspan="3" style="padding:14px 10px;text-align:right;border-top:2px solid #fde68a;">Total</td>
            <td style="padding:14px 10px;text-align:right;border-top:2px solid #fde68a;">${formatAmount(summary.total)}</td>
          </tr>
        </tfoot>
      </table>
      ${buildChequesSectionHtml(cheques, chequesSummary)}
    </div>
  </div>
</body>
</html>`;
}

function buildReportText(movements, summary, cheques, chequesSummary) {
  const lines = [
    "Facturas Pendientes (sin orden de pago)",
    `Cantidad: ${summary.count}`,
    "",
  ];

  movements.forEach((m, i) => {
    const detail = [
      m.invoice_number ? `Factura ${m.invoice_number}` : null,
      m.description || null,
      SOURCE_LABELS[m.source] || null,
    ]
      .filter(Boolean)
      .join(" · ");
    lines.push(
      `${i + 1}. ${itemDate(m)} | ${m.supplier_name || "—"} | ${detail || "—"} | ${formatAmount(itemAmount(m))}`
    );
  });

  lines.push("");
  lines.push(`Total: ${formatAmount(summary.total)}`);
  lines.push("");
  lines.push(`Cheques a vencer (próximos ${CHEQUES_DUE_DAYS} días)`);
  lines.push(`Cantidad: ${chequesSummary.count}`);
  lines.push("");

  cheques.forEach((c, i) => {
    const bank = c.bank ? ` (${c.bank})` : "";
    lines.push(
      `${i + 1}. Vence ${chequeDate(c)} | Cheque ${c.number || "—"}${bank} | Pagado a: ${c.supplier_name || "—"} | ${formatAmount(chequeAmount(c))}`
    );
  });

  lines.push("");
  lines.push(`Total cheques: ${formatAmount(chequesSummary.total)}`);

  return lines.join("\n");
}

/**
 * Arma y envía el reporte de movimientos PENDIENTE.
 * @param {{ to: string }} options
 */
async function sendPendingMovementsReport({ to }) {
  const { sendEmail } = require("../utils/mailer");

  const [movements, cheques] = await Promise.all([
    fetchPendingMovements(),
    fetchChequesDueWithinDays(),
  ]);
  const summary = buildSummary(movements);
  const chequesSummary = buildChequesSummary(cheques);
  const html = buildReportHtml(movements, summary, cheques, chequesSummary);
  const text = buildReportText(movements, summary, cheques, chequesSummary);

  const dateLabel = DateTime.now()
    .setZone("America/Argentina/Buenos_Aires")
    .toFormat("dd/MM/yyyy");

  const result = await sendEmail({
    to,
    subject: `[Reporte] Facturas pendientes (${summary.count}) y cheques a vencer (${chequesSummary.count}) — ${dateLabel}`,
    text,
    html,
  });

  return { ...result, movements, summary, cheques, chequesSummary };
}

module.exports = {
  fetchPendingMovements,
  fetchChequesDueWithinDays,
  buildSummary,
  buildChequesSummary,
  buildReportHtml,
  buildReportText,
  sendPendingMovementsReport,
  formatAmount,
  CHEQUES_DUE_DAYS,
};
