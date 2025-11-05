const self = {};
const supabase = require("./db");
const _ = require("lodash");

self.getProducts = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .is("deleted_at", null);

    if (error) throw error;

    res.json(data);
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.getProductById = async (req, res) => {
  const product_id = req.params.product_id;
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", product_id)
      .is("deleted_at", null);

    if (error) throw error;

    res.json(_.first(data));
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
