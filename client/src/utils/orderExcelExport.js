import * as XLSX from "xlsx-js-style";

function formatOrderDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("es-AR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function excelCell(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "number") return Number.isFinite(v) ? v : "";
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "object") return JSON.stringify(v);
  return v;
}

function clientFantasyName(order) {
  const c = order.clients;
  if (!c) return "";
  if (Array.isArray(c)) return c[0]?.fantasy_name || "";
  return c.fantasy_name || "";
}

const PRODUCT_KEYS = [
  "Codigo",
  "Producto",
  "Manga",
  "Genero",
  "Color",
  "Cuello",
  "Talle",
  "Cantidad",
  "Entregado",
  "Pendiente",
  "Precio_unit",
  "ID_producto",
];

const REMITO_KEYS = [
  "Remito_ID",
  "Fecha",
  "Cliente",
  "Producto",
  "Talle",
  "Color",
  "Cantidad",
];

/** Fondo gris claro y texto negro en negrita (filas de sección y cabeceras de tabla). */
const TITLE_CELL_STYLE = {
  font: { bold: true, color: { rgb: "FF000000" } },
  fill: { patternType: "solid", fgColor: { rgb: "FFE8E8E8" } },
};

function patchSheetRef(worksheet, r, c) {
  const ref = worksheet["!ref"];
  if (!ref) {
    worksheet["!ref"] = XLSX.utils.encode_cell({ r, c });
    return;
  }
  const range = XLSX.utils.decode_range(ref);
  range.s.r = Math.min(range.s.r, r);
  range.s.c = Math.min(range.s.c, c);
  range.e.r = Math.max(range.e.r, r);
  range.e.c = Math.max(range.e.c, c);
  worksheet["!ref"] = XLSX.utils.encode_range(range);
}

function applyOrderSheetTitleStyles(
  worksheet,
  nCabecera,
  productosCount,
  remitosCount
) {
  const applyTitleRow = (rowIndex, colCount) => {
    for (let c = 0; c < colCount; c++) {
      const addr = XLSX.utils.encode_cell({ r: rowIndex, c });
      if (!worksheet[addr]) worksheet[addr] = { t: "s", v: "" };
      worksheet[addr].s = { ...TITLE_CELL_STYLE };
      patchSheetRef(worksheet, rowIndex, c);
    }
  };

  applyTitleRow(0, 2);
  applyTitleRow(1, 2);

  const R_EMPTY_AFTER_DATOS = 2 + nCabecera;
  const R_PRODUCTOS_TITLE = R_EMPTY_AFTER_DATOS + 1;
  applyTitleRow(R_PRODUCTOS_TITLE, PRODUCT_KEYS.length);

  if (productosCount > 0) {
    applyTitleRow(R_PRODUCTOS_TITLE + 1, PRODUCT_KEYS.length);
  }

  if (remitosCount > 0) {
    const rAfterProductos =
      productosCount > 0
        ? R_PRODUCTOS_TITLE + 1 + productosCount
        : R_PRODUCTOS_TITLE + 1;
    const R_REMITOS_TITLE = rAfterProductos + 2;
    applyTitleRow(R_REMITOS_TITLE, REMITO_KEYS.length);
    applyTitleRow(R_REMITOS_TITLE + 1, REMITO_KEYS.length);
  }
}

/** Anchos en caracteres (wch) para columnas A, B, …; el resto con ancho por defecto. */
function applyOrderSheetColumnWidths(worksheet, rows) {
  const maxCols = Math.max(
    1,
    ...rows.map((r) => (Array.isArray(r) ? r.length : 0))
  );
  const wchByIndex = [
    28, // A: títulos, códigos, IDs
    42, // B: valores largos, cliente, producto
    16,
    16,
    14,
    14,
    14,
    12,
    12,
    12,
    14,
    14,
  ];
  worksheet["!cols"] = Array.from({ length: maxCols }, (_, i) => ({
    wch: wchByIndex[i] ?? 12,
  }));
}

/**
 * Genera el .xlsx en el navegador: una sola hoja con pedido, productos y remitos.
 */
export function buildOrderExcelBlob(order) {
  const clientName = clientFantasyName(order);

  const cabecera = [
    { Campo: "Numero de pedido", Valor: excelCell(order.order_number) },
    { Campo: "Fecha pedido", Valor: formatOrderDate(order.order_date) },
    { Campo: "Fecha entrega", Valor: formatOrderDate(order.delivery_date) },
    { Campo: "Cliente", Valor: excelCell(clientName) },
    { Campo: "Tipo de pedido", Valor: excelCell(order.order_type) },
    { Campo: "Descripcion", Valor: excelCell(order.description) },
  ];

  const productosRows = (order.orders_products || []).map((op) => ({
    Codigo: excelCell(op.codigo),
    Producto: excelCell(op.producto_tipo),
    Manga: excelCell(op.manga),
    Genero: excelCell(op.genero),
    Color: excelCell(op.color),
    Cuello: excelCell(op.cuello),
    Talle: excelCell(op.talle),
    Cantidad: excelCell(op.quantity),
    Entregado: excelCell(op.quantity_delivered),
    Pendiente: excelCell(op.quantity_pending),
    Precio_unit: excelCell(op.price),
    ID_producto: excelCell(op.product_id),
  }));

  const remitosRows = [];
  (order.delivery_notes || []).forEach((dn) => {
    const base = {
      Remito_ID: excelCell(dn.id),
      Fecha: formatOrderDate(dn.created_at || dn.delivery_date),
      Cliente: excelCell(clientName),
    };
    if (dn.deliverynotes_products?.length) {
      dn.deliverynotes_products.forEach((dnp) => {
        remitosRows.push({
          ...base,
          Producto: excelCell(dnp.producto_tipo),
          Talle: excelCell(dnp.talle),
          Color: excelCell(dnp.color),
          Cantidad: excelCell(
            dnp.cantidad_por_talle ?? dnp.quantity ?? ""
          ),
        });
      });
    } else {
      remitosRows.push({
        ...base,
        Producto: "",
        Talle: "",
        Color: "",
        Cantidad: "",
      });
    }
  });

  const rows = [];

  rows.push(["DATOS DEL PEDIDO"]);
  rows.push(["Campo", "Valor"]);
  cabecera.forEach((r) => rows.push([r.Campo, r.Valor]));
  rows.push([]);

  rows.push(["PRODUCTOS"]);
  if (productosRows.length === 0) {
    rows.push(["Sin lineas de producto en este pedido"]);
  } else {
    rows.push(PRODUCT_KEYS);
    productosRows.forEach((r) =>
      rows.push(PRODUCT_KEYS.map((k) => r[k] ?? ""))
    );
  }

  if (remitosRows.length > 0) {
    rows.push([]);
    rows.push(["REMITOS"]);
    rows.push(REMITO_KEYS);
    remitosRows.forEach((r) =>
      rows.push(REMITO_KEYS.map((k) => r[k] ?? ""))
    );
  }

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  applyOrderSheetTitleStyles(
    worksheet,
    cabecera.length,
    productosRows.length,
    remitosRows.length
  );
  applyOrderSheetColumnWidths(worksheet, rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Detalle pedido");

  const out = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
