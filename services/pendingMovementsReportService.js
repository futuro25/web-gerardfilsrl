"use strict";

const { DateTime } = require("luxon");
const supabase = require("../controllers/db");
const {
  attachPaycheckSupplier,
} = require("../controllers/PaycheckController");

const CHEQUES_DUE_DAYS = 60;
const VEPS_DUE_DAYS = 60;
const FUTURE_BALANCE_DAYS = 60;

const EXPENSE_CATEGORY_LABELS = {
  FACTURA: "Factura de proveedor",
  GASTOS_BANCARIOS: "Gastos bancarios",
  IMPUESTOS: "Impuestos",
  VEP: "VEP",
  PAGO_HABERES: "Pago de Haberes",
  SERVICIOS: "Servicios",
  OTRO: "Otro",
};

const PAYMENT_METHOD_LABELS = {
  TRANSFERENCIA: "Transferencia",
  CHEQUE: "Cheque",
  EFECTIVO: "Efectivo",
  "TARJETA DE CREDITO": "Tarjeta de crédito",
  "DEBITO AUTOMATICO": "Débito automático",
  "TARJETA DE DEBITO": "Débito automático",
  "NOTA DE CREDITO": "Nota de crédito",
};

function formatAmount(value) {
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return "$ 0,00";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(n);
}

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

function vepDisplayCategory(vep) {
  if (vep.category === "Otros" && vep.custom_category) {
    return vep.custom_category;
  }
  return vep.category || "—";
}

function vepDueDate(vep) {
  if (!vep.due_date) return "—";
  const d = DateTime.fromISO(vep.due_date);
  return d.isValid ? d.toFormat("dd/MM/yyyy") : "—";
}

function vepAmount(vep) {
  return Math.abs(parseFloat(vep.amount) || 0);
}

async function fetchUpcomingVeps(days = VEPS_DUE_DAYS) {
  const zone = "America/Argentina/Buenos_Aires";
  const today = DateTime.now().setZone(zone).startOf("day");
  const until = today.plus({ days });

  const { data, error } = await supabase
    .from("veps")
    .select("*")
    .is("deleted_at", null)
    .is("paid_at", null)
    .gte("due_date", today.toISODate())
    .lte("due_date", until.toISODate())
    .order("due_date", { ascending: true });

  if (error) throw error;

  return data || [];
}

/**
 * Saldo proyectado día a día. Se omiten los días sin movimientos: en 60 días
 * la mayoría no tiene nada y solo agregan ruido al mail.
 */
async function fetchFutureBalances(days = FUTURE_BALANCE_DAYS) {
  const { computeFutureBalances } = require("./futureBalances");
  const result = await computeFutureBalances({ days });
  return {
    ...result,
    days,
    rows: result.data.filter((row) => (row.items || []).length > 0),
  };
}

/** Qué es este movimiento proyectado, en una línea. */
function futureItemLabel(item) {
  const bits = [];

  if (item.source === "GASTO_FIJO") {
    bits.push("Gasto fijo proyectado");
  } else if (item.source === "VEP") {
    bits.push(item.overdue ? "VEP vencido sin pagar" : "VEP a vencer");
  } else {
    if (item.type === "EGRESO" && item.expense_category) {
      bits.push(
        EXPENSE_CATEGORY_LABELS[item.expense_category] || item.expense_category
      );
    }
    if (item.income_category === "NOTA_CREDITO") {
      bits.push(`NC ${item.credit_note_number || ""}`.trim());
      if (item.credit_note_invoice_number) {
        bits.push(`Fact. ${item.credit_note_invoice_number}`);
      }
    }
    if (item.supplier_name) bits.push(item.supplier_name);
    if (item.invoice_number && item.income_category !== "NOTA_CREDITO") {
      bits.push(`Fact. ${item.invoice_number}`);
    }
    if (item.vep_label) bits.push(`VEP: ${item.vep_label}`);
    if (item.is_cheque) {
      bits.push(
        `Cheque ${item.cheque_number || "s/n"}${item.cheque_bank ? ` · ${item.cheque_bank}` : ""}`
      );
    } else if (item.payment_method) {
      bits.push(PAYMENT_METHOD_LABELS[item.payment_method] || item.payment_method);
    }
    // En un cheque emitido el banco propio es el de la chequera: no repetirlo.
    if (item.bank && item.bank !== item.cheque_bank) bits.push(item.bank);
  }

  return bits.join(" · ");
}

function signedAmount(delta) {
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
  return `${sign}${formatAmount(Math.abs(delta))}`;
}

function buildVepsSummary(veps) {
  let total = 0;
  veps.forEach((v) => {
    total += vepAmount(v);
  });
  return {
    count: veps.length,
    total,
  };
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

function buildVepsSectionHtml(veps, vepsSummary) {
  const rowsHtml =
    veps.length === 0
      ? `<tr><td colspan="3" style="padding:16px;text-align:center;color:#64748b;">No hay VEPs por vencer en los próximos ${VEPS_DUE_DAYS} días.</td></tr>`
      : veps
          .map((v) => {
            const amount = vepAmount(v);
            return `<tr>
              <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(vepDisplayCategory(v))}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(vepDueDate(v))}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">${formatAmount(amount)}</td>
            </tr>`;
          })
          .join("");

  return `
    <div style="margin-top:28px;padding-top:24px;border-top:2px solid #e2e8f0;">
      <h2 style="margin:0 0 8px;font-size:18px;color:#92400e;">VEPs por vencer (próximos ${VEPS_DUE_DAYS} días)</h2>
      <p style="margin:0 0 16px;font-size:14px;"><strong>${vepsSummary.count}</strong> VEP(s) pendiente(s) por un total de <strong>${formatAmount(vepsSummary.total)}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#fffbeb;">
            <th style="text-align:left;padding:8px 10px;">Clasificación</th>
            <th style="text-align:left;padding:8px 10px;">Vencimiento</th>
            <th style="text-align:right;padding:8px 10px;">Importe</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot>
          <tr style="background:#fffbeb;font-weight:bold;font-size:15px;">
            <td colspan="2" style="padding:14px 10px;text-align:right;border-top:2px solid #fde68a;">Total</td>
            <td style="padding:14px 10px;text-align:right;border-top:2px solid #fde68a;">${formatAmount(vepsSummary.total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>`;
}

function buildFutureBalancesSectionHtml(future) {
  const rows = future?.rows || [];
  const currentBalance = future?.currentBalance ?? 0;
  const lastBalance = rows.length
    ? rows[rows.length - 1].balance
    : currentBalance;

  const rowsHtml =
    rows.length === 0
      ? `<tr><td colspan="3" style="padding:16px;text-align:center;color:#64748b;">No hay movimientos proyectados en los próximos ${future?.days ?? FUTURE_BALANCE_DAYS} días.</td></tr>`
      : rows
          .map((row) => {
            const itemsHtml = row.items
              .map((item) => {
                const label = futureItemLabel(item);
                const labelHtml = label
                  ? `<br><small style="color:#64748b;">${escapeHtml(label)}</small>`
                  : "";
                const color = item.delta > 0 ? "#15803d" : "#dc2626";
                return `<div style="margin-bottom:6px;">
                  <span>${escapeHtml(item.description || "Sin detalle")}</span>
                  <span style="color:${color};font-weight:600;"> ${signedAmount(item.delta)}</span>
                  ${labelHtml}
                </div>`;
              })
              .join("");

            const netHtml =
              row.items.length > 1
                ? `<div style="margin-top:4px;font-weight:600;color:${row.delta > 0 ? "#15803d" : "#dc2626"};">Neto del día: ${signedAmount(row.delta)}</div>`
                : "";

            const negative = row.balance < 0;
            return `<tr style="background:${negative ? "#fef2f2" : "#f0fdf4"};">
              <td style="padding:10px;border-bottom:1px solid #e2e8f0;vertical-align:top;white-space:nowrap;">${escapeHtml(itemDate(row))}</td>
              <td style="padding:10px;border-bottom:1px solid #e2e8f0;vertical-align:top;">${itemsHtml}${netHtml}</td>
              <td style="padding:10px;border-bottom:1px solid #e2e8f0;vertical-align:top;text-align:right;font-weight:700;white-space:nowrap;color:${negative ? "#dc2626" : "#15803d"};">${formatAmount(row.balance)}</td>
            </tr>`;
          })
          .join("");

  return `
    <div style="margin-top:28px;padding-top:24px;border-top:2px solid #e2e8f0;">
      <h2 style="margin:0 0 4px;font-size:18px;color:#0f766e;">Saldos Futuros <span style="font-size:13px;font-weight:normal;color:#b45309;">(en revisión)</span></h2>
      <p style="margin:0 0 12px;font-size:13px;color:#64748b;">
        Próximos ${future?.days ?? FUTURE_BALANCE_DAYS} días. Solo se listan los días con movimientos.
        Incluye movimientos con fecha futura, cheques en su vencimiento, VEPs pendientes
        y gastos fijos que todavía no tienen su movimiento cargado.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:12px;">
        <tr>
          <td style="padding:10px;background:#f0fdfa;border:1px solid #99f6e4;">Saldo actual en caja</td>
          <td style="padding:10px;background:#f0fdfa;border:1px solid #99f6e4;text-align:right;font-weight:700;color:${currentBalance < 0 ? "#dc2626" : "#0f766e"};">${formatAmount(currentBalance)}</td>
        </tr>
        <tr>
          <td style="padding:10px;background:#f0fdfa;border:1px solid #99f6e4;">Saldo proyectado a ${future?.days ?? FUTURE_BALANCE_DAYS} días</td>
          <td style="padding:10px;background:#f0fdfa;border:1px solid #99f6e4;text-align:right;font-weight:700;color:${lastBalance < 0 ? "#dc2626" : "#0f766e"};">${formatAmount(lastBalance)}</td>
        </tr>
      </table>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f0fdfa;">
            <th style="text-align:left;padding:8px 10px;">Fecha</th>
            <th style="text-align:left;padding:8px 10px;">Movimientos del día</th>
            <th style="text-align:right;padding:8px 10px;">Saldo proyectado</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>`;
}

function buildReportHtml(movements, summary, cheques, chequesSummary, veps, vepsSummary, future) {
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
      <h1 style="margin:0 0 8px;font-size:20px;color:#92400e;">Reporte diario — Facturas, cheques y VEPs</h1>
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
      ${buildVepsSectionHtml(veps, vepsSummary)}
      ${buildFutureBalancesSectionHtml(future)}
    </div>
  </div>
</body>
</html>`;
}

function buildReportText(movements, summary, cheques, chequesSummary, veps, vepsSummary, future) {
  const lines = [
    "Facturas Pendientes (sin orden de pago)",
    `Cantidad: ${summary.count}`,
    "",
  ];

  movements.forEach((m, i) => {
    const detail = [
      m.invoice_number ? `Factura ${m.invoice_number}` : null,
      m.description || null,
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
  lines.push("");
  lines.push(`VEPs por vencer (próximos ${VEPS_DUE_DAYS} días)`);
  lines.push(`Cantidad: ${vepsSummary.count}`);
  lines.push("");

  veps.forEach((v, i) => {
    lines.push(
      `${i + 1}. ${vepDisplayCategory(v)} | Vence ${vepDueDate(v)} | ${formatAmount(vepAmount(v))}`
    );
  });

  lines.push("");
  lines.push(`Total VEPs: ${formatAmount(vepsSummary.total)}`);

  const futureRows = future?.rows || [];
  const futureDays = future?.days ?? FUTURE_BALANCE_DAYS;
  lines.push("");
  lines.push(`Saldos Futuros (en revisión) — próximos ${futureDays} días`);
  lines.push(`Saldo actual en caja: ${formatAmount(future?.currentBalance ?? 0)}`);
  lines.push(
    `Saldo proyectado a ${futureDays} días: ${formatAmount(
      futureRows.length
        ? futureRows[futureRows.length - 1].balance
        : future?.currentBalance ?? 0
    )}`
  );
  lines.push("");

  if (futureRows.length === 0) {
    lines.push("Sin movimientos proyectados en el período.");
  } else {
    futureRows.forEach((row) => {
      lines.push(`${itemDate(row)} — saldo ${formatAmount(row.balance)}`);
      row.items.forEach((item) => {
        const label = futureItemLabel(item);
        lines.push(
          `   ${signedAmount(item.delta)} | ${item.description || "Sin detalle"}${label ? ` | ${label}` : ""}`
        );
      });
    });
  }

  return lines.join("\n");
}

/**
 * Arma y envía el reporte de movimientos PENDIENTE.
 * @param {{ to: string }} options
 */
async function sendPendingMovementsReport({ to }) {
  const { sendEmail } = require("../utils/mailer");

  const [movements, cheques, veps, future] = await Promise.all([
    fetchPendingMovements(),
    fetchChequesDueWithinDays(),
    fetchUpcomingVeps(),
    fetchFutureBalances(),
  ]);
  const summary = buildSummary(movements);
  const chequesSummary = buildChequesSummary(cheques);
  const vepsSummary = buildVepsSummary(veps);
  const html = buildReportHtml(
    movements,
    summary,
    cheques,
    chequesSummary,
    veps,
    vepsSummary,
    future
  );
  const text = buildReportText(
    movements,
    summary,
    cheques,
    chequesSummary,
    veps,
    vepsSummary,
    future
  );

  const dateLabel = DateTime.now()
    .setZone("America/Argentina/Buenos_Aires")
    .toFormat("dd/MM/yyyy");

  const result = await sendEmail({
    to,
    subject: `[Reporte] Facturas pendientes (${summary.count}), cheques (${chequesSummary.count}) y VEPs (${vepsSummary.count}) — ${dateLabel}`,
    text,
    html,
  });

  return {
    ...result,
    movements,
    summary,
    cheques,
    chequesSummary,
    veps,
    vepsSummary,
    future,
  };
}

module.exports = {
  fetchPendingMovements,
  fetchChequesDueWithinDays,
  fetchUpcomingVeps,
  fetchFutureBalances,
  buildSummary,
  buildChequesSummary,
  buildVepsSummary,
  buildReportHtml,
  buildReportText,
  sendPendingMovementsReport,
  formatAmount,
  CHEQUES_DUE_DAYS,
  VEPS_DUE_DAYS,
  FUTURE_BALANCE_DAYS,
};
