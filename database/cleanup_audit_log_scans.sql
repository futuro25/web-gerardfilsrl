-- Limpieza puntual: borra de la auditoria los 404 de rutas que no existen.
--
-- Son escaneos automaticos contra la API publica (entidades como "v1", "auth"
-- o "desconocido", que salen de rutas tipo /api/v1/chat/completions). Desde el
-- filtro agregado en middlewares/auditLog.js ya no se guardan mas, asi que este
-- script solo hace falta una vez, para los registros viejos.
--
-- Ejecutar primero el SELECT para ver que se va a borrar, y recien despues el
-- DELETE. No toca los 404 que devuelven los controladores ("VEP no encontrado"):
-- esos caen dentro de las entidades validas y son intentos fallidos reales.

-- 1) Vista previa: cuantos registros hay por entidad desconocida.
SELECT entity,
       count(*)            AS registros,
       min(created_at)     AS primero,
       max(created_at)     AS ultimo,
       count(DISTINCT ip)  AS ips
FROM audit_log
WHERE ok = FALSE
  AND user_id IS NULL
  AND username IS NULL
  AND entity NOT IN (
    'account-movements', 'aportes', 'cashflow', 'clients', 'cron', 'deliveries',
    'deliverynotes', 'fixed-expenses', 'invoices', 'orders', 'paychecks',
    'payment-orders', 'payments', 'presence', 'products',
    'retention-certificates', 'stock-entries', 'supplier-invoices', 'suppliers',
    'uploads', 'users', 'utils', 'veps'
  )
GROUP BY entity
ORDER BY registros DESC;

-- 2) Borrado (mismo WHERE que la vista previa).
DELETE FROM audit_log
WHERE ok = FALSE
  AND user_id IS NULL
  AND username IS NULL
  AND entity NOT IN (
    'account-movements', 'aportes', 'cashflow', 'clients', 'cron', 'deliveries',
    'deliverynotes', 'fixed-expenses', 'invoices', 'orders', 'paychecks',
    'payment-orders', 'payments', 'presence', 'products',
    'retention-certificates', 'stock-entries', 'supplier-invoices', 'suppliers',
    'uploads', 'users', 'utils', 'veps'
  );
