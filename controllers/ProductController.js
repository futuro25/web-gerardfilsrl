const self = {};
const supabase = require("./db");
const _ = require("lodash");

self.getProducts = async (req, res) => {
  try {
    const { data: products, error } = await supabase
      .from("products")
      .select("*")
      .is("deleted_at", null);

    if (error) throw error;

    // Get stock variants for each product
    const productsWithVariants = await Promise.all(
      products.map(async (product) => {
        // Get all stock entries for this product
        const { data: stockVariants, error: variantsError } = await supabase
          .from("stock_entries_products")
          .select(
            `
            id,
            quantity,
            color,
            genre,
            sleeve,
            neck,
            fuerza,
            talle,
            stock_entry_id,
            stock_entries!inner(id, entry_date, remito_number, deleted_at)
          `
          )
          .eq("product_id", product.id)
          .is("stock_entries.deleted_at", null);

        if (variantsError) {
          console.error(
            `Error getting variants for product ${product.id}:`,
            variantsError
          );
          return { ...product, stock_variants: [] };
        }

        // Group variants by color, genre, sleeve, neck, fuerza, talle and sum quantities
        const groupedVariants = {};
        if (stockVariants) {
          stockVariants.forEach((variant) => {
            const key = `${variant.color || ""}-${variant.genre || ""}-${variant.sleeve || ""}-${variant.neck || ""}-${variant.fuerza || ""}-${variant.talle || ""}`;
            if (!groupedVariants[key]) {
              groupedVariants[key] = {
                color: variant.color || "",
                genre: variant.genre || "",
                sleeve: variant.sleeve || "",
                neck: variant.neck || "",
                fuerza: variant.fuerza || "",
                talle: variant.talle || "",
                total_quantity: 0,
                entries: [],
              };
            }
            groupedVariants[key].total_quantity += variant.quantity || 0;
            groupedVariants[key].entries.push({
              id: variant.id,
              quantity: variant.quantity,
              entry_date: variant.stock_entries?.entry_date,
              remito_number: variant.stock_entries?.remito_number,
            });
          });
        }

        return {
          ...product,
          stock_variants: Object.values(groupedVariants),
          total_stock_variants: Object.values(groupedVariants).reduce(
            (sum, variant) => sum + variant.total_quantity,
            0
          ),
        };
      })
    );

    res.json(productsWithVariants);
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.getProductById = async (req, res) => {
  const product_id = req.params.product_id;
  try {
    const { data: productData, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", product_id)
      .is("deleted_at", null);

    if (error) throw error;

    const product = _.first(productData);
    if (!product) {
      return res.json({ error: "Product not found" });
    }

    // Get stock variants for this product
    const { data: stockVariants, error: variantsError } = await supabase
      .from("stock_entries_products")
      .select(
        `
        id,
        quantity,
        color,
        genre,
        sleeve,
        neck,
        fuerza,
        talle,
        stock_entry_id,
        stock_entries!inner(id, entry_date, remito_number, deleted_at)
      `
      )
      .eq("product_id", product_id)
      .is("stock_entries.deleted_at", null);

    if (variantsError) {
      console.error(
        `Error getting variants for product ${product_id}:`,
        variantsError
      );
      return res.json({ ...product, stock_variants: [] });
    }

    // Group variants by color, genre, sleeve, neck, fuerza, talle and sum quantities
    const groupedVariants = {};
    if (stockVariants) {
      stockVariants.forEach((variant) => {
        const key = `${variant.color || ""}-${variant.genre || ""}-${variant.sleeve || ""}-${variant.neck || ""}-${variant.fuerza || ""}-${variant.talle || ""}`;
        if (!groupedVariants[key]) {
          groupedVariants[key] = {
            color: variant.color || "",
            genre: variant.genre || "",
            sleeve: variant.sleeve || "",
            neck: variant.neck || "",
            fuerza: variant.fuerza || "",
            talle: variant.talle || "",
            total_quantity: 0,
            entries: [],
          };
        }
        groupedVariants[key].total_quantity += variant.quantity || 0;
        groupedVariants[key].entries.push({
          id: variant.id,
          quantity: variant.quantity,
          entry_date: variant.stock_entries?.entry_date,
          remito_number: variant.stock_entries?.remito_number,
        });
      });
    }

    res.json({
      ...product,
      stock_variants: Object.values(groupedVariants),
      total_stock_variants: Object.values(groupedVariants).reduce(
        (sum, variant) => sum + variant.total_quantity,
        0
      ),
    });
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.getProductByProductName = async (req, res) => {
  const search = req.params.name;
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .is("deleted_at", null)
      .ilike("name", `%${search}%`);

    if (error) throw error;

    res.json(data);
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.createProduct = async (req, res) => {
  try {
    const product = {
      name: req.body.name,
      code: req.body.code,
      size: req.body.size,
      color: req.body.color,
      price: req.body.price,
      stock: req.body.stock,
      description: req.body.description,
      image: req.body.image,
      genre: req.body.genre,
      sleeve: req.body.sleeve,
      neck: req.body.neck,
    };

    const { data: newProduct, error } = await supabase
      .from("products")
      .insert(product)
      .select();

    return res.json(newProduct);
  } catch (e) {
    console.log("Product creation error", e.message);
    return res.json(e);
  }
};

self.getProductByIdAndUpdate = async (req, res) => {
  try {
    const product_id = req.params.product_id;
    const update = req.body;

    if (update.id) {
      delete update.id;
    }

    const { data: updatedProduct, error } = await supabase
      .from("products")
      .update(update)
      .eq("id", product_id)
      .is("deleted_at", null);

    if (error) throw error;

    res.json(updatedProduct);
  } catch (e) {
    console.error("delete product by id", e.message);
    res.json({ error: e.message });
  }
};

self.deleteProductById = async (req, res) => {
  try {
    const product_id = req.params.product_id;
    const update = { deleted_at: new Date() };
    const { data: updatedProduct, error } = await supabase
      .from("products")
      .update(update)
      .eq("id", product_id);

    res.json(updatedProduct);
  } catch (e) {
    console.error("delete product by id", e.message);
    res.json({ error: e.message });
  }
};

module.exports = self;
