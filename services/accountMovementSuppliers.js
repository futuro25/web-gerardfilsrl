"use strict";

const supabase = require("../controllers/db");

/**
 * Agrega supplier_name a cada movimiento. El proveedor puede venir de la factura
 * asociada (supplier_invoices) o del propio movimiento (egresos Otro/Servicios).
 */
async function attachSupplierNames(movements) {
  if (!movements?.length) return movements || [];

  const movementIds = movements.map((m) => m.id);
  const { data: invoices, error } = await supabase
    .from("supplier_invoices")
    .select("account_movement_id, supplier_id")
    .in("account_movement_id", movementIds)
    .is("deleted_at", null);

  if (error) throw error;

  const supplierIds = new Set(
    (invoices || []).map((i) => i.supplier_id).filter((id) => id != null)
  );
  movements.forEach((m) => {
    if (m.supplier_id != null) supplierIds.add(m.supplier_id);
  });

  let supplierById = {};
  if (supplierIds.size) {
    const { data: suppliers, error: suppliersError } = await supabase
      .from("suppliers")
      .select("id, fantasy_name, name")
      .in("id", [...supplierIds])
      .is("deleted_at", null);

    if (suppliersError) throw suppliersError;

    (suppliers || []).forEach((s) => {
      supplierById[s.id] = s.fantasy_name || s.name || null;
    });
  }

  const nameByMovementId = {};
  (invoices || []).forEach((inv) => {
    if (inv.account_movement_id != null && !nameByMovementId[inv.account_movement_id]) {
      nameByMovementId[inv.account_movement_id] =
        supplierById[inv.supplier_id] || null;
    }
  });

  return movements.map((m) => ({
    ...m,
    supplier_name:
      nameByMovementId[m.id] || supplierById[m.supplier_id] || null,
  }));
}

module.exports = { attachSupplierNames };
