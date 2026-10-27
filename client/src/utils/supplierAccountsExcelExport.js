import * as XLSX from "xlsx-js-style";

const HEADERS = [
  "Proveedor",
  "Razón social",
  "CUIT",
  "Cierre ejercicio",
  "Movimientos",
  "Saldo",
];

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

function legalName(s) {
  const name = (s.name || "").trim();
  const last = (s.last_name || "").trim();
  if (!last || name.toUpperCase().includes(last.toUpperCase())) return name;
  return `${name} ${last}`;
}

function round2(v) {
  return Math.round((parseFloat(v) || 0) * 100) / 100;
}

function buildSheet(headers, data, totalRow, amountCols, widths) {
  const aoa = [headers, ...data, totalRow];
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);

  headers.forEach((_, c) => {
    const cell = worksheet[XLSX.utils.encode_cell({ r: 0, c })];
    if (cell) cell.s = HEADER_STYLE;
  });

  for (let r = 1; r < aoa.length; r++) {
    amountCols.forEach((c) => {
      const cell = worksheet[XLSX.utils.encode_cell({ r, c })];
      if (cell) {
        cell.t = "n";
        cell.z = AMOUNT_FORMAT;
      }
    });
  }

  const last = aoa.length - 1;
  headers.forEach((_, c) => {
    const ref = XLSX.utils.encode_cell({ r: last, c });
    if (!worksheet[ref]) worksheet[ref] = { t: "s", v: "" };
    worksheet[ref].s = TOTAL_STYLE;
  });

  worksheet["!cols"] = widths.map((wch) => ({ wch }));
  worksheet["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: Math.max(data.length, 1), c: headers.length - 1 },
    }),
  };
  return worksheet;
}

function toBlob(worksheet, sheetName) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const out = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/**
 * Genera el .xlsx en el navegador con el listado de proveedores y su saldo.
 * `rows` son los items de /api/supplier-accounts ({ supplier, summary, movement_count }).
 * `fiscalCloseOf(supplier)` devuelve el mes de cierre de ejercicio según ARCA.
 */
export function buildSupplierAccountsExcelBlob(rows, fiscalCloseOf = () => "") {
  const data = rows.map((row) => {
    const s = row.supplier || {};
    return [
      s.fantasy_name || s.name || "",
      legalName(s),
      s.cuit || "",
      fiscalCloseOf(s) || "",
      row.movement_count ?? 0,
      round2(row.summary?.balance),
    ];
  });

  const total = round2(data.reduce((acc, r) => acc + r[5], 0));
  const worksheet = buildSheet(
    HEADERS,
    data,
    ["TOTAL", "", "", "", "", total],
    [5],
    [36, 36, 16, 16, 13, 18]
  );
  return toBlob(worksheet, "Cuentas corrientes");
}

/** Años con movimientos, del más reciente al más viejo (siempre incluye el actual). */
export function supplierAccountYears(rows) {
  const years = new Set([new Date().getFullYear()]);
  (rows || []).forEach((row) =>
    Object.keys(row.yearly || {}).forEach((y) => {
      const n = parseInt(y, 10);
      if (Number.isFinite(n)) years.add(n);
    })
  );
  return [...years].sort((a, b) => b - a);
}

/**
 * Saldo de cada proveedor en un año: saldo al 1/1, facturado, pagado y saldo
 * al 31/12 (o a hoy si es el año en curso). Se omiten los proveedores sin
 * saldo ni movimientos en el año.
 */
export function buildSupplierAccountsYearExcelBlob(
  rows,
  year,
  fiscalCloseOf = () => ""
) {
  const isCurrent = year === new Date().getFullYear();
  const headers = [
    "Proveedor",
    "Razón social",
    "CUIT",
    "Cierre ejercicio",
    `Saldo al 01/01/${year}`,
    `Facturado ${year}`,
    `Pagado ${year}`,
    isCurrent ? "Saldo a hoy" : `Saldo al 31/12/${year}`,
  ];

  const data = [];
  rows.forEach((row) => {
    const s = row.supplier || {};
    let opening = 0;
    let debit = 0;
    let credit = 0;
    Object.entries(row.yearly || {}).forEach(([y, v]) => {
      const n = parseInt(y, 10);
      // Sin fecha: se toma como saldo previo a cualquier año.
      if (!Number.isFinite(n) || n < year) opening += v.debit - v.credit;
      else if (n === year) {
        debit += v.debit;
        credit += v.credit;
      }
    });
    const closing = opening + debit - credit;
    if ([opening, debit, credit, closing].every((v) => Math.abs(v) < 0.01)) {
      return;
    }
    data.push([
      s.fantasy_name || s.name || "",
      legalName(s),
      s.cuit || "",
      fiscalCloseOf(s) || "",
      round2(opening),
      round2(debit),
      round2(credit),
      round2(closing),
    ]);
  });

  const sum = (c) => round2(data.reduce((acc, r) => acc + r[c], 0));
  const worksheet = buildSheet(
    headers,
    data,
    ["TOTAL", "", "", "", sum(4), sum(5), sum(6), sum(7)],
    [4, 5, 6, 7],
    [36, 36, 16, 16, 20, 18, 18, 20]
  );
  return toBlob(worksheet, `Cuentas corrientes ${year}`);
}
