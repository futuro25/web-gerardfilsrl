import * as XLSX from "xlsx-js-style";

const HEADERS = ["Proveedor", "Razón social", "CUIT", "Movimientos", "Saldo"];

const HEADER_STYLE = {
  font: { bold: true, color: { rgb: "FF000000" } },
  fill: { patternType: "solid", fgColor: { rgb: "FFE8E8E8" } },
  border: { bottom: { style: "thin", color: { rgb: "FF999999" } } },
};

const TOTAL_STYLE = {
  font: { bold: true },
  border: { top: { style: "thin", color: { rgb: "FF999999" } } },
};

const AMOUNT_FORMAT = '"$" #,##0.00;[Red]-"$" #,##0.00';

function round2(v) {
  return Math.round((parseFloat(v) || 0) * 100) / 100;
}

/**
 * Genera el .xlsx en el navegador con el listado de proveedores y su saldo.
 * `rows` son los items de /api/supplier-accounts ({ supplier, summary, movement_count }).
 */
export function buildSupplierAccountsExcelBlob(rows) {
  const data = rows.map((row) => {
    const s = row.supplier || {};
    return [
      s.fantasy_name || s.name || "",
      [s.name, s.last_name].filter(Boolean).join(" "),
      s.cuit || "",
      row.movement_count ?? 0,
      round2(row.summary?.balance),
    ];
  });

  const total = round2(data.reduce((acc, r) => acc + r[4], 0));

  const aoa = [HEADERS, ...data, ["TOTAL", "", "", "", total]];
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);

  HEADERS.forEach((_, c) => {
    const cell = worksheet[XLSX.utils.encode_cell({ r: 0, c })];
    if (cell) cell.s = HEADER_STYLE;
  });

  for (let r = 1; r < aoa.length; r++) {
    const cell = worksheet[XLSX.utils.encode_cell({ r, c: 4 })];
    if (cell) {
      cell.t = "n";
      cell.z = AMOUNT_FORMAT;
    }
  }

  const totalRow = aoa.length - 1;
  HEADERS.forEach((_, c) => {
    const ref = XLSX.utils.encode_cell({ r: totalRow, c });
    if (!worksheet[ref]) worksheet[ref] = { t: "s", v: "" };
    worksheet[ref].s = TOTAL_STYLE;
  });

  worksheet["!cols"] = [
    { wch: 36 },
    { wch: 36 },
    { wch: 16 },
    { wch: 13 },
    { wch: 18 },
  ];
  worksheet["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: Math.max(data.length, 1), c: HEADERS.length - 1 },
    }),
  };

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Cuentas corrientes");

  const out = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
