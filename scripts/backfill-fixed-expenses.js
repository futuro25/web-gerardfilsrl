"use strict";

/**
 * Backfill de gastos fijos a partir de los movimientos que quedaron marcados
 * FIJO antes de que existieran las plantillas.
 *
 * El agrupado está definido a mano (el texto de los movimientos no alcanza:
 * el mismo gasto aparece escrito de varias formas y hay gastos distintos con
 * la misma descripción). Cada entrada dice qué movimientos absorbe, con qué
 * nombre queda la plantilla, qué día del mes cae y el importe vigente.
 *
 * Uso:
 *   node scripts/backfill-fixed-expenses.js          → dry run, no escribe nada
 *   node scripts/backfill-fixed-expenses.js --apply  → aplica los cambios
 */

const supabase = require("../controllers/db");
const { DateTime } = require("luxon");

const APPLY = process.argv.includes("--apply");

const PLAN = [
  {
    name: "CONTADORA FABIANA",
    day: 3,
    amount: 950000,
    // 229 CONTADORA FABIANA · 36 FABIANA CONTADORA · 86 MOSCOLONI FABIANA ALEJANDRA
    movementIds: [229, 36, 86, 334],
  },
  {
    name: "PERSONAL 1",
    day: 6,
    amount: 34875.78,
    // Internet fábrica. 15 era el "PERSONAL" genérico de $31.924.
    movementIds: [138, 15, 302],
  },
  {
    name: "PERSONAL 2",
    day: 6,
    amount: 96790.65,
    // Teléfonos fábrica. 16 era el "PERSONAL" genérico de $77.520.
    movementIds: [139, 16, 304],
  },
  {
    name: "FEDERACION PATRONAL 1",
    day: 6,
    amount: 67658.3,
    // El débito automático de servicio, ~$67.700.
    movementIds: [11, 137, 303],
  },
  {
    name: "FEDERACION PATRONAL 2",
    day: 21,
    amount: 351055,
    // El de ~$310.000/$351.000, cae cerca del 21.
    movementIds: [58, 147, 311],
  },
  {
    name: "FEDERACION PATRONAL 3",
    day: 22,
    amount: 43447,
    // El de ~$42.000/$43.000, cae cerca del 22.
    movementIds: [4, 66, 154, 313],
  },
  {
    name: "HABERES",
    day: 6,
    // $12.715.947 (06/08) + $673.758 (10/08), según lo indicado.
    amount: 13389705,
    movementIds: [22, 23, 24, 31, 140, 288, 333],
    // Reemplaza la plantilla creada a mano desde el movimiento 298.
    absorbsFixedExpenseId: 1,
  },
  {
    name: "AYUDANTE CONTADORA",
    day: 1,
    amount: 600000,
    movementIds: [176, 228, 282],
  },
  {
    name: "PRIETO SABRINA SOLEDAD",
    day: 4,
    // 33 LEANDRO ($500.000) + 182 SISTEMAS ($590.000) son el mismo gasto.
    amount: 1090000,
    movementIds: [33, 182],
  },
  {
    name: "CREDITO CAROLINA",
    day: 9,
    // Suma de los dos créditos del 09/08 (Galicia + BNA).
    amount: 2824918.14,
    movementIds: [32, 330, 331],
  },
  {
    name: "CREDITO SUSANA RUBIO",
    day: 10,
    amount: 2000000,
    movementIds: [47, 300, 332],
  },
  {
    name: "PROSEGUR",
    day: 3,
    amount: 196120.75,
    movementIds: [5, 81, 171, 329],
  },
  {
    name: "SETIA",
    day: 21,
    amount: 588989.58,
    movementIds: [52, 112, 211, 257],
  },
  {
    name: "EDENOR",
    day: 7,
    amount: 849110.24,
    movementIds: [38, 178, 232],
  },
];

// Movimientos que quedan sin plantilla: se les saca la marca de fijo.
const UNMARK_IDS = [13, 190, 224, 174, 141, 83, 84];

const fmt = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);

function effectiveDate(m) {
  return m.is_cheque && m.cheque_due_date ? m.cheque_due_date : m.date;
}

async function main() {
  const allIds = [...new Set(PLAN.flatMap((p) => p.movementIds)), ...UNMARK_IDS];

  const { data: movements, error } = await supabase
    .from("account_movements")
    .select("id, description, amount, date, is_cheque, cheque_due_date, movement_kind, fixed_expense_id")
    .in("id", allIds)
    .is("deleted_at", null);
  if (error) throw error;

  const byId = new Map(movements.map((m) => [m.id, m]));

  console.log(APPLY ? "=== APLICANDO ===\n" : "=== DRY RUN (no escribe nada) ===\n");

  let created = 0;
  let linked = 0;

  for (const entry of PLAN) {
    const own = entry.movementIds.map((id) => byId.get(id)).filter(Boolean);
    const missing = entry.movementIds.filter((id) => !byId.has(id));

    const dates = own.map(effectiveDate).filter(Boolean).sort();
    const startMonth = dates.length
      ? DateTime.fromISO(dates[0]).startOf("month").toISODate()
      : DateTime.now().startOf("month").toISODate();

    console.log(`${entry.name}`);
    console.log(`   día ${entry.day} · ${fmt(entry.amount)} · desde ${startMonth}`);
    own.forEach((m) => {
      console.log(
        `     ← #${m.id} ${effectiveDate(m)} ${fmt(m.amount).padStart(18)}  ${m.description}`
      );
    });
    if (missing.length) console.log(`     !! no encontrados: ${missing.join(", ")}`);
    if (entry.absorbsFixedExpenseId) {
      console.log(`     ↻ reemplaza la plantilla existente #${entry.absorbsFixedExpenseId}`);
    }
    console.log("");

    if (!APPLY) {
      created++;
      linked += own.length;
      continue;
    }

    let expenseId = entry.absorbsFixedExpenseId || null;

    if (expenseId) {
      const { error: updErr } = await supabase
        .from("fixed_expenses")
        .update({
          description: entry.name,
          day_of_month: entry.day,
          start_month: startMonth,
        })
        .eq("id", expenseId);
      if (updErr) throw updErr;

      const { error: delErr } = await supabase
        .from("fixed_expense_amounts")
        .delete()
        .eq("fixed_expense_id", expenseId);
      if (delErr) throw delErr;
    } else {
      const { data: ins, error: insErr } = await supabase
        .from("fixed_expenses")
        .insert({
          description: entry.name,
          day_of_month: entry.day,
          start_month: startMonth,
          source_movement_id: own[0]?.id ?? null,
        })
        .select();
      if (insErr) throw insErr;
      expenseId = ins[0].id;
    }
    created++;

    const { error: amtErr } = await supabase
      .from("fixed_expense_amounts")
      .insert({
        fixed_expense_id: expenseId,
        amount: entry.amount,
        effective_from: startMonth,
      });
    if (amtErr) throw amtErr;

    if (own.length) {
      const { error: linkErr } = await supabase
        .from("account_movements")
        .update({ fixed_expense_id: expenseId, movement_kind: "FIJO" })
        .in("id", own.map((m) => m.id));
      if (linkErr) throw linkErr;
      linked += own.length;
    }
  }

  console.log("Se les saca la marca de fijo (quedan como movimientos comunes):");
  UNMARK_IDS.forEach((id) => {
    const m = byId.get(id);
    console.log(
      m
        ? `   #${m.id} ${effectiveDate(m)} ${fmt(m.amount).padStart(18)}  ${m.description}`
        : `   #${id} !! no encontrado`
    );
  });

  if (APPLY && UNMARK_IDS.length) {
    const { error: unmarkErr } = await supabase
      .from("account_movements")
      .update({ movement_kind: "UNICA VEZ", fixed_expense_id: null })
      .in("id", UNMARK_IDS);
    if (unmarkErr) throw unmarkErr;
  }

  console.log(
    `\n${APPLY ? "Aplicado" : "Se crearían"}: ${created} plantilla(s), ${linked} movimiento(s) vinculado(s), ${UNMARK_IDS.length} desmarcado(s).`
  );
  if (!APPLY) console.log("Volvé a correrlo con --apply para escribir.");
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
