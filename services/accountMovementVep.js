"use strict";

const supabase = require("../controllers/db");

function parseVepId(value) {
  const id = parseInt(value, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function validateEgresoVepFields(body) {
  if (body.type !== "EGRESO" || body.expense_category !== "VEP") {
    return null;
  }
  if (!parseVepId(body.vep_id)) {
    return "Seleccioná el VEP que estás pagando";
  }
  return null;
}

function applyEgresoVepFields(movement, body) {
  if (body.type === "EGRESO" && body.expense_category === "VEP") {
    movement.vep_id = parseVepId(body.vep_id);
  } else {
    movement.vep_id = null;
  }
  return movement;
}

async function assertVepAvailableForPayment(vepId) {
  const { data, error } = await supabase
    .from("veps")
    .select("id, paid_at, amount, category, custom_category, due_date")
    .eq("id", vepId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    const err = new Error("VEP no encontrado");
    err.code = "VEP_NOT_FOUND";
    throw err;
  }
  if (data.paid_at) {
    const err = new Error("El VEP seleccionado ya está marcado como pagado");
    err.code = "VEP_ALREADY_PAID";
    throw err;
  }
  return data;
}

async function linkVepPayment(vepId, accountMovementId) {
  const vep = await assertVepAvailableForPayment(vepId);

  const { data, error } = await supabase
    .from("veps")
    .update({
      paid_at: new Date().toISOString(),
      account_movement_id: accountMovementId,
    })
    .eq("id", vepId)
    .is("deleted_at", null)
    .is("paid_at", null)
    .select("id");

  if (error) throw error;
  if (!data?.length) {
    const err = new Error("No se pudo vincular el pago del VEP");
    err.code = "VEP_LINK_FAILED";
    throw err;
  }

  return vep;
}

async function clearVepPaymentByMovementId(accountMovementId) {
  if (accountMovementId == null) return;

  const { error } = await supabase
    .from("veps")
    .update({ paid_at: null, account_movement_id: null })
    .eq("account_movement_id", accountMovementId)
    .is("deleted_at", null);

  if (error) throw error;
}

async function attachVepInfo(movements) {
  if (!movements?.length) return movements || [];

  const vepIds = [
    ...new Set(movements.map((m) => m.vep_id).filter((id) => id != null)),
  ];
  if (!vepIds.length) return movements;

  const { data, error } = await supabase
    .from("veps")
    .select("id, category, custom_category, due_date, amount, paid_at")
    .in("id", vepIds)
    .is("deleted_at", null);

  if (error) throw error;

  const vepById = {};
  (data || []).forEach((v) => {
    vepById[v.id] = {
      ...v,
      display_category:
        v.category === "Otros" && v.custom_category
          ? v.custom_category
          : v.category,
    };
  });

  return movements.map((m) => ({
    ...m,
    vep: m.vep_id ? vepById[m.vep_id] || null : null,
    vep_label: m.vep_id ? vepById[m.vep_id]?.display_category || null : null,
  }));
}

module.exports = {
  parseVepId,
  validateEgresoVepFields,
  applyEgresoVepFields,
  assertVepAvailableForPayment,
  linkVepPayment,
  clearVepPaymentByMovementId,
  attachVepInfo,
};
