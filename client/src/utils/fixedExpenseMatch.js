/**
 * Detecta si el detalle que se está cargando corresponde a un gasto fijo ya
 * registrado, escrito de otra forma.
 *
 * Hay dos caminos y los dos hacen falta:
 *  - Alias: detalles que ya se usaron en movimientos vinculados a esa plantilla.
 *    Es el único que resuelve casos sin parecido textual ("SISTEMAS" y
 *    "PRIETO SABRINA SOLEDAD" son el mismo gasto).
 *  - Parecido de texto: variantes y errores de tipeo ("Pago de Haberes" vs
 *    "HABERES", "FABIANA CONTADORA" vs "CONTADORA FABIANA").
 */

const STOPWORDS = new Set([
  "DE", "DEL", "LA", "EL", "LOS", "LAS", "Y", "A", "POR", "EN", "PARA", "SA",
  "SRL", "S", "AUTOMATICO",
]);

/** Mayúsculas, sin acentos, sin puntuación y con espacios colapsados. */
export function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value) {
  return normalize(value)
    .split(" ")
    .filter((t) => t && !STOPWORDS.has(t));
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = curr;
  }
  return prev[b.length];
}

function levenshteinRatio(a, b) {
  const longest = Math.max(a.length, b.length);
  if (!longest) return 0;
  return 1 - levenshtein(a, b) / longest;
}

/**
 * Puntaje entre 0 y 1 de cuánto se parece `input` a `candidate`.
 * Devuelve 0 cuando no hay coincidencia suficiente para molestar al usuario.
 */
function similarity(input, candidate) {
  const a = normalize(input);
  const b = normalize(candidate);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.length || !tb.length) return 0;

  const setA = new Set(ta);
  const setB = new Set(tb);
  const shared = [...setA].filter((t) => setB.has(t));

  // Todas las palabras significativas del más corto están en el más largo:
  // "PAGO DE HABERES" contiene "HABERES".
  const smaller = setA.size <= setB.size ? setA : setB;
  const sharedLength = shared.reduce((acc, t) => acc + t.length, 0);
  if (shared.length === smaller.size && sharedLength >= 5) {
    return 0.9;
  }

  // Errores de tipeo y plurales: "SISTEMA" vs "SISTEMAS".
  const ratio = levenshteinRatio(a, b);
  if (ratio >= 0.85) return ratio;

  return 0;
}

/**
 * Busca coincidencias del detalle contra los gastos fijos.
 * `expenses` viene de /fixed-expenses/names: { id, description, aliases }.
 *
 * Devuelve null si no hay nada que sugerir, o { input, matches } con los
 * candidatos empatados en el mejor puntaje (puede haber más de uno: los
 * "PERSONAL 1" y "PERSONAL 2" comparten el alias "PERSONAL").
 */
export function findFixedExpenseSuggestion(description, expenses) {
  const input = String(description || "").trim();
  if (!input || !expenses?.length) return null;

  const normalized = normalize(input);
  const scored = [];

  for (const expense of expenses) {
    // Ya está escrito igual que la plantilla: no hay nada que sugerir.
    if (normalize(expense.description) === normalized) return null;

    let best = similarity(input, expense.description);
    let via = null;

    for (const alias of expense.aliases || []) {
      const aliasNormalized = normalize(alias);
      // Un alias idéntico es la señal más fuerte que tenemos.
      const score = aliasNormalized === normalized ? 1 : similarity(input, alias);
      if (score > best) {
        best = score;
        via = alias;
      }
    }

    if (best > 0) scored.push({ expense, score: best, via });
  }

  if (!scored.length) return null;

  scored.sort((a, b) => b.score - a.score);
  const topScore = scored[0].score;
  const matches = scored
    .filter((s) => Math.abs(s.score - topScore) < 0.01)
    .slice(0, 3);

  return { input, matches };
}
