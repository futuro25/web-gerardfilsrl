"use strict";

const { OWN_BANKS } = require("./accountMovementPayment");
const { isOwnBanksTransfer } = require("./accountMovementTransfer");
const { movementCountsInBalance } = require("./accountMovementBalance");

/** Bolsa para lo que no salió ni entró por una cuenta nuestra: efectivo, tarjeta, etc. */
const UNASSIGNED = "SIN_ASIGNAR";

/**
 * Saldo abierto por cuenta propia.
 *
 * Usa el mismo criterio que `balanceWithoutCheques` (un cheque recién mueve la
 * cuenta el día que vence) para que la suma de las cuentas dé exactamente el
 * saldo global y las dos cifras no se contradigan en pantalla.
 *
 * Las transferencias entre cuentas propias son el único movimiento que toca dos
 * cuentas: restan en el banco de origen y suman en el de destino, y por eso se
 * cuentan acá aunque estén excluidas del saldo global.
 *
 * @param {Array} movements filas con type, amount, bank, bank_to, expense_category, is_cheque, cheque_due_date
 * @param {Set<number>} excludedIds movimientos que no impactan saldo (facturas impagas)
 * @param {string} today fecha ISO
 */
function computeBankBalances(movements, excludedIds, today) {
  const byBank = new Map();
  OWN_BANKS.forEach((bank) => byBank.set(bank, 0));
  byBank.set(UNASSIGNED, 0);

  const add = (bank, delta) => {
    const key = bank || UNASSIGNED;
    byBank.set(key, (byBank.get(key) || 0) + delta);
  };

  (movements || []).forEach((m) => {
    const amount = parseFloat(m.amount);
    if (!Number.isFinite(amount)) return;
    if (m.is_cheque && m.cheque_due_date && m.cheque_due_date > today) return;

    if (isOwnBanksTransfer(m)) {
      add(m.bank, -amount);
      add(m.bank_to, amount);
      return;
    }

    if (!movementCountsInBalance(m, excludedIds)) return;

    add(m.bank, m.type === "INGRESO" ? amount : -amount);
  });

  const unassigned = byBank.get(UNASSIGNED) || 0;
  const banks = [...byBank.entries()]
    .filter(([bank]) => bank !== UNASSIGNED)
    .map(([bank, balance]) => ({ bank, balance }));

  return {
    banks,
    unassigned,
    total: banks.reduce((acc, b) => acc + b.balance, 0) + unassigned,
  };
}

module.exports = { UNASSIGNED, computeBankBalances };
