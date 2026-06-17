export function formatSupplierCuit(supplier) {
  const raw = supplier?.cuit ?? "";
  return String(raw).replace(/[^0-9]/g, "");
}

export function formatClientCuit(client) {
  if (client?.cuit) {
    return String(client.cuit).replace(/[^0-9]/g, "");
  }
  const docType = String(client?.document_type || "").toUpperCase();
  if (docType === "CUIT" || docType === "CUIL") {
    return String(client?.document_number || "").replace(/[^0-9]/g, "");
  }
  return "";
}

export function getComprobanteTotal(item) {
  const total = item?.total ?? item?.amount ?? 0;
  return Math.abs(Number(total) || 0);
}

export function getNetoGravado(item, ivaAmount = 0) {
  if (item?.net_amount != null) {
    return Math.abs(Number(item.net_amount) || 0);
  }
  const total = getComprobanteTotal(item);
  const iva = Math.abs(Number(ivaAmount) || 0);
  return Math.max(total - iva, 0);
}

export function getAlicuotaCodeFromRate(rate) {
  if (Math.abs(rate - 0.105) < 0.001) return "0005";
  if (Math.abs(rate - 0.27) < 0.001) return "0003";
  return "0004";
}
