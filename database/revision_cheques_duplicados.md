# Cheques duplicados: listado para revisar

Generado el 16/11/2026 con datos de producción (solo lectura). **No se modificó nada.**

Criterio: cheques emitidos activos con el mismo banco y número (sin contar ceros a la izquierda). Nada se borra físicamente: lo que se da de baja es baja lógica y queda apuntando al registro que se conserva.

| Tipo | Cheques |
|---|---|
| ⚠️ Duplicado también en Control (dos salidas de banco) | 53, 52, 54, 55, 32061742, 33396740 |
| Control + Cashflow (fusión simple) | 51, 47, 48, 50, 33396742, 33396743 |
| Cheque huérfano | 33396744 |
| Mismo número en dos OP de la misma factura | 33396745 |
| Duplicado dentro de Cashflow | 14, 32061738 |
| Sin cambios (un cheque repartido entre varias facturas) | 33396750, 33396751, 5, 20, 32061731, 32061735, 32061736, 38, 46, 21, 1739, 1741 |

**16 cheques a revisar.**

## ⚠️ Duplicado también en Control (dos salidas de banco)

El cheque está en una OP de factura y además en un movimiento de Control cargado suelto. Hay dos movimientos de banco activos por el mismo cheque. Se conserva la OP; el movimiento suelto se da de baja **después de pasar a la OP lo que solo tenga él** (descripción, adjunto). Hay que confirmar importe y vencimiento reales.

### Cheque 53 · GALICIA

| Registro | N° cargado | Importe | Vence | Origen | Proveedor | Factura · OP | Movimiento Control | Cashflow | Adjunto |
|---|---|---|---|---|---|---|---|---|---|
| **#175 queda** | 53 | $1.182.384,00 | 06/04/2026 | OP | TEJEDURIA GUEMES S.R.L. | A000200007716 · OP-0885 | #520 ENTRETELA CUELLO (06/03/2026, $1.182.384,00) | — | sí |
| #113 baja | 00000053 | $1.186.864,00 | 30/04/2026 | CONTROL | — | — | #14 TEJEDURIA GUEMES (E CHEQ 53) (30/04/2026, $1.186.864,00) | — | — |
| #107 baja | 00000053 | $1.186.864,00 | 06/04/2026 | CASHFLOW | TEJEDURIA GUEMES S.R.L. | — | — | #632 ENTRE CUELLO BLANCO MEDIANO (RETENCIÓN NRO CR-20260313-0004 DE $19.872,00 - IMPORTE ORIGINAL FC $1.202.256,00) (06/03/2026, $1.186.864,00) | — |

- Importes distintos: $1.186.864,00 / $1.182.384,00. Confirmar el real.
- Vencimientos distintos: 30/04/2026 / 06/04/2026. Confirmar el real.
- El #175 recibe el vínculo al egreso de Cashflow #632.
- Movimientos de Control activos: #14, #520.

### Cheque 52 · GALICIA

| Registro | N° cargado | Importe | Vence | Origen | Proveedor | Factura · OP | Movimiento Control | Cashflow | Adjunto |
|---|---|---|---|---|---|---|---|---|---|
| **#174 queda** | 52 | $766.360,00 | 01/04/2026 | OP | B.A.N. TEXTIL S.R.L. | A000200003144 · OP-0883 | #497 ENTRETELA ALGODON (24/02/2026, $766.360,00) | — | sí |
| #118 baja | 52 | $766.359,99 | 13/04/2026 | CONTROL | — | — | #48 ECHEQ GALICIA 52 (13/04/2026, $766.359,99) | — | — |

- Importes distintos: $766.359,99 / $766.360,00. Confirmar el real.
- Vencimientos distintos: 13/04/2026 / 01/04/2026. Confirmar el real.
- Movimientos de Control activos: #48, #497.

### Cheque 54 · GALICIA

| Registro | N° cargado | Importe | Vence | Origen | Proveedor | Factura · OP | Movimiento Control | Cashflow | Adjunto |
|---|---|---|---|---|---|---|---|---|---|
| **#179 queda** | 54 | $1.450.182,48 | 20/04/2026 | OP | TIENDASTAR S.A | A000100000366 · OP-0891 | #543 MAQUINA DIGNA (20/03/2026, $1.450.182,48) | — | sí |
| #120 baja | 54 | $1.450.183,48 | 21/04/2026 | CONTROL | — | — | #57 E CHEQ 54 (21/04/2026, $1.450.183,48) | — | — |

- Importes distintos: $1.450.183,48 / $1.450.182,48. Confirmar el real.
- Vencimientos distintos: 21/04/2026 / 20/04/2026. Confirmar el real.
- Movimientos de Control activos: #57, #543.

### Cheque 55 · GALICIA

| Registro | N° cargado | Importe | Vence | Origen | Proveedor | Factura · OP | Movimiento Control | Cashflow | Adjunto |
|---|---|---|---|---|---|---|---|---|---|
| **#149 queda** | 00000055 | $942.543,67 | 01/06/2026 | OP | GOZAL S.A. | A000300016169 · OP-0730 | #240 FRESNO GRAFA 486 AZUL MARINO - ARCIEL INTA POL/VISC 1.60MT X 100 BLANCO - ETIQUETA ARCIEL - ETIQUETA SANTISTA TEXTIL (31/03/2026, $953.829,45) | — | sí |
| #122 baja | 55 | $942.543,67 | 29/05/2026 | CONTROL | — | — | #76 GOZAL (29/05/2026, $942.543,67) | — | — |

- Vencimientos distintos: 29/05/2026 / 01/06/2026. Confirmar el real.
- Movimientos de Control activos: #76, #240.

### Cheque 32061742 · GALICIA

| Registro | N° cargado | Importe | Vence | Origen | Proveedor | Factura · OP | Movimiento Control | Cashflow | Adjunto |
|---|---|---|---|---|---|---|---|---|---|
| **#217 queda** | 32061742 | $8.671.075,01 | 12/02/2026 | OP | HB MANAGMENT S.A. | A001100017909 · OP-1052 | #207 TELAS (06/08/2025, $8.671.075,01) | — | — |
| **#218 queda** | 32061742 | $9.074.380,90 | 12/02/2026 | OP | HB MANAGMENT S.A. | A001100017916 · OP-1053 | #208 TELAS (06/08/2025, $9.074.380,90) | — | — |
| #172 baja | 32061742 | $17.745.455,91 | 12/02/2026 | CONTROL | — | — | #484 CHEQUE 32061742 (12/02/2026, $17.745.455,91) | — | — |

- Las OP pagan facturas distintas con el mismo cheque (suman $17.745.455,91): se conservan todas y se da de baja el registro suelto.
- Movimientos de Control activos: #207, #484, #208.

### Cheque 33396740 · GALICIA

| Registro | N° cargado | Importe | Vence | Origen | Proveedor | Factura · OP | Movimiento Control | Cashflow | Adjunto |
|---|---|---|---|---|---|---|---|---|---|
| **#178 queda** | 33396740 | $969.560,00 | 30/04/2026 | OP | BLAIOTTA PABLO JOSE | A000200000093 · OP-0889 | #495 BATISTA COLOR ARENA (24/02/2026, $3.969.560,00) | — | — |
| #123 baja | 33396740 | $969.569,00 | 30/04/2026 | CONTROL | BLAIOTTA PABLO JOSE | — | #77 Pablo blaiotta (30/04/2026, $969.569,00) | #718 TELA BATISTA COLOR ARENA 1 (EL TOTAL DE ESTA FC ES DE $4.031.720,00 - RETENCIÓN DE $62.160,00 - SE PAGA CON 3 CHEQUES: $1.500.000,00 DEL CHQ 6738 - $1.500.000,00 DEL CHQ 6739 Y $969.560,00 DEL CHQ 6740) (24/02/2026, $969.560,00) | — |

- Importes distintos: $969.560,00 / $969.569,00. Confirmar el real.
- El #178 recibe el vínculo al egreso de Cashflow #718.
- Movimientos de Control activos: #495, #77.

## Control + Cashflow (fusión simple)

Una sola salida en Control; el otro registro viene de Cashflow (módulo viejo). Se conserva el de Control y se le agrega el vínculo al egreso de Cashflow para no perder la referencia.

### Cheque 51 · GALICIA

| Registro | N° cargado | Importe | Vence | Origen | Proveedor | Factura · OP | Movimiento Control | Cashflow | Adjunto |
|---|---|---|---|---|---|---|---|---|---|
| **#173 queda** | 51 | $6.692.284,28 | 13/04/2026 | OP | AUSTRALTEX | A100100054875 · OP-0867 | #499 BATISTA LIVIANA (27/02/2026, $6.692.284,28) | — | sí |
| #106 baja | 00000051 | $6.586.147,74 | 13/04/2026 | CASHFLOW | AUSTRALTEX | — | — | #616 TELA M BATISTA LIVIANA 110X76 65%PES 35%ALG (RETENCIÓN NRO CR-20260302-0002 DE $106.136,26 - IMPORTE ORIGINAL DE FC $6.692.284,00) (27/02/2026, $6.586.147,74) | — |

- Importes distintos: $6.586.147,74 / $6.692.284,28. Confirmar el real.
- El #173 recibe el vínculo al egreso de Cashflow #616.

### Cheque 47 · GALICIA

| Registro | N° cargado | Importe | Vence | Origen | Proveedor | Factura · OP | Movimiento Control | Cashflow | Adjunto |
|---|---|---|---|---|---|---|---|---|---|
| **#169 queda** | 47 | $1.502.617,33 | 03/02/2026 | OP | GOZAL S.A. | A000300014978 · OP-0849 | #467 TELAS (02/12/2025, $1.502.617,33) | — | sí |
| #103 baja | 00000047 | $1.502.617,33 | 02/02/2025 | CASHFLOW | GOZAL S.A. | — | — | #544 TELA GRAFIL GRAFA 000 BLANCO - GRAFIL SANTISTA 000 BLANCO (02/12/2025, $1.502.617,33) | — |

- Vencimientos distintos: 03/02/2026 / 02/02/2025. Confirmar el real.
- El #169 recibe el vínculo al egreso de Cashflow #544.

### Cheque 48 · GALICIA

| Registro | N° cargado | Importe | Vence | Origen | Proveedor | Factura · OP | Movimiento Control | Cashflow | Adjunto |
|---|---|---|---|---|---|---|---|---|---|
| **#170 queda** | 48 | $1.761.472,30 | 23/01/2026 | OP | CLADD INDUSTRIA TEXTIL ARGENTINA S.A. | A0001136382 · OP-0850 | #468 TELAS (09/12/2025, $1.761.472,30) | — | sí |
| #104 baja | 00000048 | $1.761.472,30 | 23/01/2026 | CASHFLOW | CLADD INDUSTRIA TEXTIL ARGENTINA S.A. | — | — | #553 TELA BATISTA POL/ALG 45/1./BLANCO OPTICO (18/12/2025, $1.761.472,30) | — |

- El #170 recibe el vínculo al egreso de Cashflow #553.

### Cheque 50 · GALICIA

| Registro | N° cargado | Importe | Vence | Origen | Proveedor | Factura · OP | Movimiento Control | Cashflow | Adjunto |
|---|---|---|---|---|---|---|---|---|---|
| **#171 queda** | 50 | $4.810.960,00 | 03/02/2026 | OP | VANVOR Y OTTONE SRL | A000300000318 · OP-0851 | #469 BOTONES (27/11/2025, $4.810.960,00) | — | sí |
| #105 baja | 00000050 | $4.810.960,00 | 12/01/2026 | CASHFLOW | VANVOR Y OTTONE SRL | — | — | #570 BOTON (27/11/2025, $4.810.960,00) | — |

- Vencimientos distintos: 03/02/2026 / 12/01/2026. Confirmar el real.
- El #171 recibe el vínculo al egreso de Cashflow #570.

### Cheque 33396742 · GALICIA

| Registro | N° cargado | Importe | Vence | Origen | Proveedor | Factura · OP | Movimiento Control | Cashflow | Adjunto |
|---|---|---|---|---|---|---|---|---|---|
| **#116 queda** | 33396742 | $1.500.000,00 | 15/05/2026 | CONTROL | BLAIOTTA PABLO JOSE | — | #41 PABLO BLAIOTTA (15/05/2026, $1.500.000,00) | #720 TELA BATISTA COLOR BLANCO 2 (EL TOTAL DE ESTA FC ES DE $4.593.160,00 - RETENCIÓN DE $71.440,00 - SE PAGA CON 3 CHEQUES: $1.500.000,00 DEL CHQ 6741 - $1.500.000,00 DEL CHQ 6742 Y $1.521.720,00 DEL CHQ 6743) (07/04/2026, $1.500.000,00) | — |
| #128 baja | 33396742 | $1.500.000,00 | 15/05/2026 | CASHFLOW | BLAIOTTA PABLO JOSE | — | — | #720 TELA BATISTA COLOR BLANCO 2 (EL TOTAL DE ESTA FC ES DE $4.593.160,00 - RETENCIÓN DE $71.440,00 - SE PAGA CON 3 CHEQUES: $1.500.000,00 DEL CHQ 6741 - $1.500.000,00 DEL CHQ 6742 Y $1.521.720,00 DEL CHQ 6743) (07/04/2026, $1.500.000,00) | — |

### Cheque 33396743 · GALICIA

| Registro | N° cargado | Importe | Vence | Origen | Proveedor | Factura · OP | Movimiento Control | Cashflow | Adjunto |
|---|---|---|---|---|---|---|---|---|---|
| **#117 queda** | 33396743 | $1.521.719,99 | 22/05/2026 | CONTROL | BLAIOTTA PABLO JOSE | — | #42 PABLO BLAIOTTA (22/05/2026, $1.521.719,99) | #721 TELA BATISTA COLOR BLANCO 3 (EL TOTAL DE ESTA FC ES DE $4.593.160,00 - RETENCIÓN DE $71.440,00 - SE PAGA CON 3 CHEQUES: $1.500.000,00 DEL CHQ 6741 - $1.500.000,00 DEL CHQ 6742 Y $1.521.720,00 DEL CHQ 6743) (07/04/2026, $1.521.720,00) | — |
| #129 baja | 33396743 | $1.521.720,00 | 22/05/2026 | CASHFLOW | BLAIOTTA PABLO JOSE | — | — | #721 TELA BATISTA COLOR BLANCO 3 (EL TOTAL DE ESTA FC ES DE $4.593.160,00 - RETENCIÓN DE $71.440,00 - SE PAGA CON 3 CHEQUES: $1.500.000,00 DEL CHQ 6741 - $1.500.000,00 DEL CHQ 6742 Y $1.521.720,00 DEL CHQ 6743) (07/04/2026, $1.521.720,00) | — |

- Importes distintos: $1.521.719,99 / $1.521.720,00. Confirmar el real.

## Cheque huérfano

Registro creado por una OP que falló a mitad de camino: no tiene OP ni movimiento que lo use. Se da de baja; no tiene datos propios.

### Cheque 33396744 · GALICIA

| Registro | N° cargado | Importe | Vence | Origen | Proveedor | Factura · OP | Movimiento Control | Cashflow | Adjunto |
|---|---|---|---|---|---|---|---|---|---|
| **#132 queda** | 33396744 | $900.000,00 | 15/06/2026 | OP | BLAIOTTA PABLO JOSE | A000200000095 · OP-0662 | #162 PABLO BLAIOTTA (18/05/2026, $1.437.479,99) | — | — |
| #133 baja | 33396744 | $900.000,00 | 15/06/2026 | sin OP | — | — | #162 PABLO BLAIOTTA (18/05/2026, $1.437.479,99) | — | — |

## Mismo número en dos OP de la misma factura

No es una fusión: casi seguro una OP tiene mal el número de cheque. Hay que corregir el número en la OP que corresponda.

### Cheque 33396745 · GALICIA

| Registro | N° cargado | Importe | Vence | Origen | Proveedor | Factura · OP | Movimiento Control | Cashflow | Adjunto |
|---|---|---|---|---|---|---|---|---|---|
| #220 | 33396745 | $10.000.000,00 | 17/06/2026 | OP | HB MANAGMENT S.A. | A001100019739 · OP-1055 | #201 CONFECCION (31/03/2026, $30.499.986,48) | — | — |
| #221 | 33396745 | $8.499.986,48 | 12/06/2026 | OP | HB MANAGMENT S.A. | A001100019739 · OP-1056 | #201 CONFECCION (31/03/2026, $30.499.986,48) | — | — |

- Importes distintos: $10.000.000,00 / $8.499.986,48. Confirmar el real.
- Vencimientos distintos: 17/06/2026 / 12/06/2026. Confirmar el real.

## Duplicado dentro de Cashflow

Varios egresos de Cashflow tienen el mismo cheque con el mismo importe. Confirmar si es un cheque que pagó varias facturas (y el importe de cada registro está mal) o un egreso cargado dos veces.

### Cheque 14 · GALICIA

| Registro | N° cargado | Importe | Vence | Origen | Proveedor | Factura · OP | Movimiento Control | Cashflow | Adjunto |
|---|---|---|---|---|---|---|---|---|---|
| **#48 queda** | 00000014 | $897.748,00 | 23/06/2025 | CASHFLOW | INSTALACIONES COMERCIALES TISERA SA | — | — | #140 SILLA OFICINA (06/05/2025, $532.862,22) | — |
| #49 baja | 00000014 | $897.748,00 | 23/06/2025 | CASHFLOW | INSTALACIONES COMERCIALES TISERA SA | — | — | #141 MUEBLE BAJO MESADA (06/05/2025, $364.885,78) | — |

- Cada egreso de Cashflow: #140 $532.862,22, #141 $364.885,78; cada cheque figura por $897.748,00.

### Cheque 32061738 · GALICIA

| Registro | N° cargado | Importe | Vence | Origen | Proveedor | Factura · OP | Movimiento Control | Cashflow | Adjunto |
|---|---|---|---|---|---|---|---|---|---|
| **#96 queda** | 32061738 | $10.915.000,00 | 16/10/2025 | CASHFLOW | AYL SA | — | — | #512 TELA 950 POLI 20 001 IC04 128900 J (13/06/2025, $10.915.000,00) | — |
| #97 baja | 32061738 | $10.915.000,00 | 16/10/2025 | CASHFLOW | AYL SA | — | — | #513 TELAS VARIAS (12/06/2025, $10.915.000,00) | — |

- Cada egreso de Cashflow: #512 $10.915.000,00, #513 $10.915.000,00; cada cheque figura por $10.915.000,00.

## Sin cambios: un cheque repartido entre varias facturas

Mismo número, pero cada registro es la parte que paga una factura distinta. Quedan como están hasta unificar el modelo (paso 3).

| Cheque | Registros | Importes |
|---|---|---|
| 33396750 · GALICIA | #162 (OP), #163 (OP) | $4.640.016,88 + $5.359.983,12 |
| 33396751 · GALICIA | #164 (OP), #165 (OP) | $9.280.033,76 + $719.966,24 |
| 5 · GALICIA | #50 (CASHFLOW), #51 (CASHFLOW), #52 (CASHFLOW) | $707.076,50 + $144.376,80 + $32.926,86 |
| 20 · GALICIA | #54 (CASHFLOW), #55 (CASHFLOW), #56 (CASHFLOW) | $43.463,63 + $1.920.000,00 + $902.272,00 |
| 32061731 · GALICIA | #64 (CASHFLOW), #65 (CASHFLOW) | $7.836.337,19 + $428.125,62 |
| 32061735 · GALICIA | #81 (CASHFLOW), #82 (CASHFLOW), #83 (CASHFLOW) | $10.274.380,17 + $1.073.305,79 + $5.181.239,65 |
| 32061736 · GALICIA | #84 (CASHFLOW), #85 (CASHFLOW) | $3.762.975,22 + $8.944.214,86 |
| 38 · GALICIA | #89 (CASHFLOW), #90 (CASHFLOW) | $182.821,32 + $511.222,58 |
| 46 · GALICIA | #99 (CASHFLOW), #100 (CASHFLOW) | $238.370,00 + $71.232,70 |
| 21 · GALICIA | #101 (CASHFLOW), #102 (CASHFLOW) | $3.457.240,77 + $1.101.156,75 |
| 1739 · GALICIA | #108 (CASHFLOW), #109 (CASHFLOW) | $8.470.014,66 + $1.529.985,34 |
| 1741 · GALICIA | #110 (CASHFLOW), #111 (CASHFLOW) | $4.520.246,14 + $9.680.000,25 |
