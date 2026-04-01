const self = {};
const supabase = require("./db");
const _ = require("lodash");
const XLSX = require("xlsx-js-style");

self.getOrders = async (req, res) => {
  try {
    const { data: orders, error } = await supabase
      .from("orders")
      .select("*, orders_products(*, products(*)), clients(fantasy_name)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const ordersWithDeliveryNotes = await Promise.all(
      orders.map(async (order) => {
        const { data: deliveryNotes, error: dnError } = await supabase
          .from("deliverynotes")
          .select("*, deliverynotes_products(*)")
          .eq("order_id", order.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false });

        if (dnError) {
          console.error("Error fetching delivery notes:", dnError);
        }

        if (order.orders_products) {
          order.orders_products = order.orders_products.map((op) => {
            // Calculate delivered quantity from delivery notes for this order product
            let calculatedDelivered = 0;
            
            if (deliveryNotes && deliveryNotes.length > 0) {
              const normalize = (val) => (val || "").toString().toUpperCase().trim();
              
              deliveryNotes.forEach((dn) => {
                if (dn.deliverynotes_products) {
                  dn.deliverynotes_products.forEach((dnp) => {
                    // Match by producto_tipo and talle (minimum required)
                    const matchProducto = normalize(dnp.producto_tipo) === normalize(op.producto_tipo);
                    const matchTalle = normalize(dnp.talle) === normalize(op.talle);
                    
                    // Also check color if both have it
                    const matchColor = !op.color || !dnp.color || 
                      normalize(dnp.color) === normalize(op.color);
                    
                    if (matchProducto && matchTalle && matchColor) {
                      calculatedDelivered += dnp.cantidad_por_talle || dnp.quantity || 0;
                    }
                  });
                }
              });
            }
            
            // Use calculated value or stored value, whichever is greater
            const quantityDelivered = Math.max(calculatedDelivered, op.quantity_delivered || 0);
            
            return {
              ...op,
              quantity_delivered: quantityDelivered,
              quantity_pending: Math.max(0, op.quantity - quantityDelivered),
            };
          });
        }

        return {
          ...order,
          delivery_notes: deliveryNotes || [],
        };
      })
    );

    res.json(ordersWithDeliveryNotes);
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.getActiveOrders = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select(
        `
        *,
        orders_products(*, products(*)),
        clients(fantasy_name)
      `
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const activeOrders = data
      .map((order) => {
        const hasPendingProducts = order.orders_products?.some((op) => {
          const quantityDelivered = op.quantity_delivered || 0;
          return op.quantity > quantityDelivered;
        });

        if (hasPendingProducts) {
          return {
            ...order,
            client_name: order.clients?.fantasy_name || "",
          };
        }
        return null;
      })
      .filter((order) => order !== null);

    res.json(activeOrders);
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.getOrderById = async (req, res) => {
  const order_id = req.params.order_id;
  try {
    const { data: orderData, error } = await supabase
      .from("orders")
      .select("*, orders_products(*, products(*))")
      .eq("id", order_id)
      .is("deleted_at", null);

    if (error) throw error;

    const order = _.first(orderData);

    if (!order) {
      return res.json({ error: "Order not found" });
    }

    if (order.orders_products) {
      const productsWithDelivered = await Promise.all(
        order.orders_products.map(async (op) => {
          const { data: deliveredData, error: deliveredError } = await supabase
            .from("deliverynotes")
            .select("id, deliverynotes_products!inner(product_id, quantity)")
            .eq("client_id", order.client_id)
            .eq("deliverynotes_products.product_id", op.product_id)
            .is("deleted_at", null);

          console.log(
            "[v0] Query for client:",
            order.client_id,
            "product:",
            op.product_id
          );
          console.log("[v0] deliveredData:", deliveredData);
          console.log("[v0] deliveredError:", deliveredError);

          let totalDelivered = 0;
          if (deliveredData && deliveredData.length > 0) {
            deliveredData.forEach((dn) => {
              if (dn.deliverynotes_products) {
                dn.deliverynotes_products.forEach((dnp) => {
                  totalDelivered += dnp.quantity || 0;
                });
              }
            });
          }

          console.log("[v0] totalDelivered:", totalDelivered);

          return {
            ...op,
            quantity_delivered: totalDelivered,
            quantity_pending: op.quantity - totalDelivered,
          };
        })
      );
      order.orders_products = productsWithDelivered;
    }

    res.json(order);
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.createOrder = async (req, res) => {
  try {
    const order = {
      client_id: req.body.client_id,
      order_number: req.body.order_number,
      order_type: req.body.order_type,
      order_date: req.body.order_date || null,
      delivery_date: req.body.delivery_date || null,
      description: req.body.description,
      amount: req.body.amount,
    };

    const { data: newOrder, error } = await supabase
      .from("orders")
      .insert(order)
      .select();

    if (error) {
      console.error("Error creating order:", error);
      return res.json({ error: error.message });
    }

    const orderProducts = req.body.products.map((product) => ({
      order_id: newOrder[0].id,
      product_id: product.product_id,
      quantity: product.quantity,
      quantity_delivered: 0,
      price: product.price,
      codigo: product.codigo || null,
      producto_tipo: product.producto_tipo || null,
      manga: product.manga || null,
      genero: product.genero || null,
      color: product.color || null,
      cuello: product.cuello || null,
      talle: product.talle || null,
    }));

    const { data: newOrderProducts, error: errorProducts } = await supabase
      .from("orders_products")
      .insert(orderProducts);

    if (errorProducts) {
      await supabase.from("orders").delete().eq("id", newOrder[0].id);
      console.error("Error creating order products:", errorProducts);
      return res.json({ error: errorProducts.message });
    }

    return res.json(newOrder);
  } catch (e) {
    console.log("Order creation error", e.message);
    return res.json({ error: e.message });
  }
};

self.getOrderByIdAndUpdate = async (req, res) => {
  try {
    const order_id = req.params.order_id;
    const update = req.body;

    if (update.id) {
      delete update.id;
    }

    if (update.products) {
      const { error: deleteError } = await supabase
        .from("orders_products")
        .delete()
        .eq("order_id", order_id);

      if (deleteError) {
        console.error("Error deleting order products:", deleteError);
        return res.json({ error: deleteError.message });
      }

      const orderProducts = update.products.map((product) => ({
        order_id: order_id,
        product_id: product.product_id,
        quantity: product.quantity,
        quantity_delivered: 0,
        price: product.price,
        codigo: product.codigo || null,
        producto_tipo: product.producto_tipo || null,
        manga: product.manga || null,
        genero: product.genero || null,
        color: product.color || null,
        cuello: product.cuello || null,
        talle: product.talle || null,
      }));

      const { error: insertError } = await supabase
        .from("orders_products")
        .insert(orderProducts);

      if (insertError) {
        console.error("Error inserting order products:", insertError);
        return res.json({ error: insertError.message });
      }

      delete update.products;
    }

    const { data: updatedOrder, error } = await supabase
      .from("orders")
      .update(update)
      .eq("id", order_id)
      .is("deleted_at", null)
      .select();

    if (error) throw error;

    res.json(updatedOrder);
  } catch (e) {
    console.error("update order by id", e.message);
    res.json({ error: e.message });
  }
};

self.deleteOrderById = async (req, res) => {
  try {
    const order_id = req.params.order_id;
    const update = { deleted_at: new Date() };

    const { data: updatedOrder, error } = await supabase
      .from("orders")
      .update(update)
      .eq("id", order_id)
      .select();

    if (error) throw error;

    res.json(updatedOrder);
  } catch (e) {
    console.error("delete order by id", e.message);
    res.json({ error: e.message });
  }
};

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

/** Valores seguros para celdas XLSX (evita BigInt/objetos que rompen el libro). */
function excelCell(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "number") return Number.isFinite(v) ? v : "";
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "object") return JSON.stringify(v);
  return v;
}

self.exportOrderToExcel = async (req, res) => {
  try {
    const order_id = req.params.order_id;

    const { data: rows, error } = await supabase
      .from("orders")
      .select("*, orders_products(*, products(*)), clients(fantasy_name)")
      .eq("id", order_id)
      .is("deleted_at", null)
      .limit(1);

    if (error) throw error;
    const order = _.first(rows);
    if (!order) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    const { data: deliveryNotes } = await supabase
      .from("deliverynotes")
      .select("*, deliverynotes_products(*)")
      .eq("order_id", order.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    const normalize = (val) => (val || "").toString().toUpperCase().trim();

    const ordersProductsEnriched = (order.orders_products || []).map((op) => {
      let calculatedDelivered = 0;
      if (deliveryNotes && deliveryNotes.length > 0) {
        deliveryNotes.forEach((dn) => {
          if (dn.deliverynotes_products) {
            dn.deliverynotes_products.forEach((dnp) => {
              const matchProducto =
                normalize(dnp.producto_tipo) === normalize(op.producto_tipo);
              const matchTalle = normalize(dnp.talle) === normalize(op.talle);
              const matchColor =
                !op.color ||
                !dnp.color ||
                normalize(dnp.color) === normalize(op.color);
              if (matchProducto && matchTalle && matchColor) {
                calculatedDelivered +=
                  dnp.cantidad_por_talle || dnp.quantity || 0;
              }
            });
          }
        });
      }
      const quantityDelivered = Math.max(
        calculatedDelivered,
        op.quantity_delivered || 0
      );
      const pending = Math.max(0, (op.quantity || 0) - quantityDelivered);
      return { ...op, quantityDelivered, quantity_pending: pending };
    });

    const clientName = order.clients?.fantasy_name || "";

    const cabecera = [
      { Campo: "Numero de pedido", Valor: excelCell(order.order_number) },
      { Campo: "Fecha pedido", Valor: formatOrderDate(order.order_date) },
      { Campo: "Fecha entrega", Valor: formatOrderDate(order.delivery_date) },
      { Campo: "Cliente", Valor: excelCell(clientName) },
      { Campo: "Tipo de pedido", Valor: excelCell(order.order_type) },
      { Campo: "Descripcion", Valor: excelCell(order.description) },
    ];

    const productosRows = ordersProductsEnriched.map((op) => ({
      Codigo: excelCell(op.codigo),
      Producto: excelCell(op.producto_tipo),
      Manga: excelCell(op.manga),
      Genero: excelCell(op.genero),
      Color: excelCell(op.color),
      Cuello: excelCell(op.cuello),
      Talle: excelCell(op.talle),
      Cantidad: excelCell(op.quantity),
      Entregado: excelCell(op.quantityDelivered),
      Pendiente: excelCell(op.quantity_pending),
      Precio_unit: excelCell(op.price),
      ID_producto: excelCell(op.product_id),
    }));

    const remitosRows = [];
    (deliveryNotes || []).forEach((dn) => {
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
    const maxCols = Math.max(
      1,
      ...rows.map((r) => (Array.isArray(r) ? r.length : 0))
    );
    const wchByIndex = [28, 42, 16, 16, 14, 14, 14, 12, 12, 12, 14, 14];
    worksheet["!cols"] = Array.from({ length: maxCols }, (_, i) => ({
      wch: wchByIndex[i] ?? 12,
    }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Detalle pedido");

    const rawOut = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
      compression: true,
    });
    const excelBuffer = Buffer.isBuffer(rawOut) ? rawOut : Buffer.from(rawOut);

    const safeName = String(order.order_number || order.id).replace(/[^\w.-]+/g, "_");
    const fileName = `pedido_${safeName}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Length", excelBuffer.length);
    res.end(excelBuffer);
  } catch (e) {
    console.error("export order excel", e);
    res.status(500).json({ error: e?.message || "Error al exportar pedido" });
  }
};

module.exports = self;
