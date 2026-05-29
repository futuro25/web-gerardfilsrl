"use strict";

const supabase = require("../controllers/db");
const { DateTime } = require("luxon");

function formatAmount(value) {
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return "$ 0,00";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(n);
}

function effectiveDate(movement) {
  const d =
    movement.is_cheque && movement.cheque_due_date
      ? movement.cheque_due_date
      : movement.date;
  if (!d) return "—";
  return DateTime.fromISO(d).toFormat("dd/MM/yyyy");
}

function movementAmount(movement) {
  return Math.abs(parseFloat(movement.amount) || 0);
}

async function attachSupplierNames(movements) {
  if (!movements?.length) return [];

  const movementIds = movements.map((m) => m.id);
  const { data: invoices, error } = await supabase
    .from("supplier_invoices")
    .select("account_movement_id, supplier_id")
    .in("account_movement_id", movementIds)
    .is("deleted_at", null);

  if (error) throw error;

  const nameByMovementId = {};
  if (invoices?.length) {
    const supplierIds = [...new Set(invoices.map((i) => i.supplier_id))];
    const { data: suppliers } = await supabase
      .from("suppliers")
      .select("id, fantasy_name, name")
      .in("id", supplierIds)
      .is("deleted_at", null);

    const supplierById = {};
    (suppliers || []).forEach((s) => {
      supplierById[s.id] = s.fantasy_name || s.name || "";
    });

    invoices.forEach((inv) => {
      if (inv.account_movement_id != null) {
        nameByMovementId[inv.account_movement_id] =
          supplierById[inv.supplier_id] || "";
      }
    });
  }

  return movements.map((m) => ({
    ...m,
    supplier_name: nameByMovementId[m.id] || "",
  }));
}

async function fetchPendingMovements() {
  const { data, error } = await supabase
    .from("account_movements")
    .select("*")
    .eq("movement_kind", "PENDIENTE")
    .is("deleted_at", null)
    .order("date", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw error;
  return attachSupplierNames(data || []);
}

function buildSummary(movements) {
  let total = 0;

  movements.forEach((m) => {
    total += movementAmount(m);
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

function buildReportHtml(movements, summary) {
  const generatedAt = DateTime.now().setZone("America/Argentina/Buenos_Aires").toFormat(
    "dd/MM/yyyy HH:mm"
  );

  const rowsHtml =
    movements.length === 0
      ? `<tr><td colspan="4" style="padding:16px;text-align:center;color:#64748b;">No hay movimientos con clasificación Pendiente.</td></tr>`
      : movements
          .map((m) => {
            const amount = movementAmount(m);
            const chequeNote =
              m.is_cheque && m.cheque_number
                ? `<br><small style="color:#2563eb;">Cheque #${escapeHtml(m.cheque_number)} · ${escapeHtml(m.cheque_bank || "")}</small>`
                : "";
            return `<tr>
              <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(effectiveDate(m))}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(m.supplier_name)}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(m.description || "—")}${chequeNote}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">${formatAmount(amount)}</td>
            </tr>`;
          })
          .join("");

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>Movimientos pendientes</title></head>
<body style="font-family:Arial,sans-serif;color:#1e293b;line-height:1.5;margin:0;padding:24px;background:#f8fafc;">
  <div style="max-width:720px;margin:0 auto;background:#fff;border-radius:8px;border:1px solid #e2e8f0;overflow:hidden;">
    <div style="background:#fef3c7;padding:20px 24px;border-bottom:1px solid #fde68a;">
      <h1 style="margin:0 0 8px;font-size:20px;color:#92400e;">Control — Movimientos Pendientes</h1>
      <p style="margin:0;font-size:13px;color:#78716c;">Generado el ${escapeHtml(generatedAt)} (hora Argentina)</p>
    </div>
    <div style="padding:20px 24px;">
      <p style="margin:0 0 16px;font-size:14px;"><strong>${summary.count}</strong> movimiento(s) con clasificación <strong>Pendiente</strong>.</p>
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
    </div>
  </div>
</body>
</html>`;
}

function buildReportText(movements, summary) {
  const lines = [
    "Control — Movimientos Pendientes",
    `Cantidad: ${summary.count}`,
    "",
  ];

  movements.forEach((m, i) => {
    lines.push(
      `${i + 1}. ${effectiveDate(m)} | ${m.supplier_name || "—"} | ${m.description || "—"} | ${formatAmount(movementAmount(m))}`
    );
  });

  lines.push("");
  lines.push(`Total: ${formatAmount(summary.total)}`);

  return lines.join("\n");
}

/**
 * Arma y envía el reporte de movimientos PENDIENTE.
 * @param {{ to: string }} options
 */
async function sendPendingMovementsReport({ to }) {
  const { sendEmail } = require("../utils/mailer");

  const movements = await fetchPendingMovements();
  const summary = buildSummary(movements);
  const html = buildReportHtml(movements, summary);
  const text = buildReportText(movements, summary);

  const dateLabel = DateTime.now()
    .setZone("America/Argentina/Buenos_Aires")
    .toFormat("dd/MM/yyyy");

  const result = await sendEmail({
    to,
    subject: `[Control] Movimientos pendientes — ${dateLabel} (${summary.count})`,
    text,
    html,
  });

  return { ...result, movements, summary };
}

module.exports = {
  fetchPendingMovements,
  buildSummary,
  buildReportHtml,
  buildReportText,
  sendPendingMovementsReport,
  formatAmount,
};
