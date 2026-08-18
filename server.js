try {
  require("dotenv").config();
} catch (e) {
  // dotenv es opcional (en producción las variables vienen del entorno)
}

const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const routes = require("./routes/routes.js");
const auditLog = require("./middlewares/auditLog.js");
const { buildVersion } = require("./utils/buildVersion.js");
const MainController = require("./controllers/UserController.js");
const app = express();
const cors = require("cors");

const config = require("./config");

// Configuracion para evitar errores de CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH");
  res.header("Access-Control-Allow-Headers", "*");
  next();
});
app.use(cors());

console.log(config);

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

app.use(bodyParser.json());

// Put all API endpoints under '/api'
app.get("/api/status", (req, res) => {
  res.json({ message: "ok" });
});

// El cliente compara esta version con la del bundle que tiene corriendo para
// detectar que se hizo un deploy y ofrecer recargar.
app.get("/api/version", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ version: buildVersion });
});

// Registra toda escritura de la API antes de resolverla.
app.use("/api", auditLog);

app.use("/api", routes);

// Serve static files from the React app
const root = path.join(__dirname, "client/build");

// Los archivos de /static llevan hash en el nombre, asi que se pueden cachear
// para siempre. index.html no: es el que apunta al bundle nuevo despues de un
// deploy, y si queda cacheado el usuario sigue cargando la version vieja.
const NO_CACHE = "no-cache, no-store, must-revalidate";

app.use(
  express.static(root, {
    index: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith("index.html")) {
        res.set("Cache-Control", NO_CACHE);
      } else if (filePath.includes(`${path.sep}static${path.sep}`)) {
        res.set("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  })
);

app.get("*", (req, res) => {
  res.set("Cache-Control", NO_CACHE);
  res.sendFile("index.html", { root });
});

app.listen(process.env.PORT || 4000);

console.log("App running and listening on 4000");
