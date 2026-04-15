SELECT
    -- 1. IDENTIFICACIÓN Y FECHAS
    r.revisacion      AS id_revisacion,
    r.fecha_publicacion,
    r.comprado_fecha,
    
    -- Fecha de primera habilitación (Evento 2)
    (
        SELECT MIN(cil.fecha_creacion) 
        FROM dcac.compra_inmediata cid 
        INNER JOIN dcac.compra_inmediata_logs cil ON cil.ci_id = cid.id 
        [[ INNER JOIN dcac.sociedades_tags st ON st.id = cid.sociedad AND st.asociado_comercial = {{filtro_usuario_nombre}} ]]
        WHERE cid.revisacion = r.revisacion
          AND cil.evento = 2 
    )                 AS fecha_primer_habilitacion,
    
    (
        SELECT MAX(cil.fecha_creacion) 
        FROM dcac.compra_inmediata cid 
        INNER JOIN dcac.compra_inmediata_logs cil ON cil.ci_id = cid.id 
        [[ INNER JOIN dcac.sociedades_tags st ON st.id = cid.sociedad AND st.asociado_comercial = {{filtro_usuario_nombre}} ]]
        WHERE cid.revisacion = r.revisacion
          AND cil.evento = 2 
    )                 AS fecha_ultima_habilitacion,
    
    (
        SELECT COUNT(DISTINCT cid.sociedad) 
        FROM dcac.compra_inmediata cid 
        INNER JOIN dcac.compra_inmediata_logs cil ON cil.ci_id = cid.id 
        [[ INNER JOIN dcac.sociedades_tags st ON st.id = cid.sociedad AND st.asociado_comercial = {{filtro_usuario_nombre}} ]]
        WHERE cid.revisacion = r.revisacion
          AND cil.evento = 2
    )                 AS q_habilitados_CI,
    
    (
        SELECT COUNT(DISTINCT cid.sociedad) 
        FROM dcac.compra_inmediata cid 
        INNER JOIN dcac.compra_inmediata_logs cil ON cil.ci_id = cid.id 
        [[ INNER JOIN dcac.sociedades_tags st ON st.id = cid.sociedad AND st.asociado_comercial = {{filtro_usuario_nombre}} ]]
        WHERE cid.revisacion = r.revisacion
          AND cil.evento = 1 
    )                 AS q_visitas_CI,
    
    (
        SELECT COUNT(DISTINCT o.oferta) 
        FROM dcac.ofertas o 
        [[ INNER JOIN dcac.sociedades_tags st ON st.id = o.sociedad AND st.asociado_comercial = {{filtro_usuario_nombre}} ]]
        WHERE o.revisacion = r.revisacion
    )                 AS q_ofertas,


    -- 2. DETALLE DE HACIENDA

    -- Cabezas: Prioriza carga, sino usa original
    r.cantidad        AS cabezas,
    r.peso,

    -- Categoría
    CASE c.categoria
        WHEN 1  THEN 'TM'        
        WHEN 2  THEN 'TH'        
        WHEN 3  THEN 'TM - TH'
        WHEN 4  THEN 'NT - VQ'   
        WHEN 5  THEN 'VCI'       
        WHEN 7  THEN 'VCP'
        WHEN 8  THEN 'NT'        
        WHEN 9  THEN 'VQ'        
        WHEN 10 THEN 'NV'
        WHEN 12 THEN 'TR'        
        WHEN 13 THEN 'VCC'       
        WHEN 14 THEN 'VQP'
        WHEN 16 THEN 'VcG'       
        WHEN 17 THEN 'VcM'       
        WHEN 18 THEN 'VcC'
        WHEN 19 THEN 'TrG'       
        WHEN 20 THEN 'TrM'       
        WHEN 21 THEN 'TrC'
        WHEN 27 THEN 'MEJ'       
        WHEN 28 THEN 'MyTM'      
        WHEN 29 THEN 'MyTH'
        WHEN 30 THEN 'MEJ y NT'  
        WHEN 32 THEN 'V y VQ'    
        WHEN 33 THEN 'MEJ y NV'
        WHEN 34 THEN 'NV y VQ'   
        WHEN 35 THEN 'V y NV'    
        WHEN 37 THEN 'TR y V'
        WHEN 38 THEN 'Tr, V y NV' 
        WHEN 40 THEN 'VQpM'
        ELSE 'Falta_Agregar' 
    END               AS categoria,

    -- Raza
    CASE rz.nombre
        WHEN 'Mestizo'           THEN 'MZ'
        WHEN 'Cuartino'          THEN 'CT'
        WHEN 'Holando Argentino' THEN 'HO'
        WHEN 'Bubalinos'         THEN 'BU'
        ELSE rz.nombre 
    END               AS raza,

    -- Calidad (Escala 1-9 a 6-10)
    CASE ir.calidad
        WHEN 1 THEN 6.0   
        WHEN 2 THEN 6.5   
        WHEN 3 THEN 7.0
        WHEN 4 THEN 7.5   
        WHEN 5 THEN 8.0   
        WHEN 6 THEN 8.5
        WHEN 7 THEN 9.0   
        WHEN 8 THEN 9.5   
        WHEN 9 THEN 10.0
    END               AS calidad,


    -- 3. UBICACIÓN

    REPLACE(
        REPLACE(
            REPLACE(
                REPLACE(
                    REPLACE(
                        REPLACE(pt.descripcion, "&iacute;", "í"), 
                    "&aacute;", "á"), 
                "&oacute;", "ó"), 
            "&eacute;", "é"), 
        "&uacute;", "ú"), 
    "&ntilde;", "ñ")  AS partido_origen,
    
    pv.abreviatura    AS provincia_origen,


    -- 4. ACTORES

    sv.razon_social   AS vendedor,
    
    -- Operador (Iniciales o Nombre Completo)
    CASE 
        WHEN op.nombre = 'Celestino'     AND op.apellido = 'Rodriguez' THEN 'CR'
        WHEN op.nombre = 'Alberto Pedro' AND op.apellido = 'Bernaudo'  THEN 'AB'
        WHEN op.nombre = 'Tomas Ignacio' AND op.apellido = 'Lasarte'   THEN 'TL'
        WHEN op.nombre = 'Maximiliano'   AND op.apellido = 'Oliveri'   THEN 'MO'
        WHEN op.nombre = 'Pedro'         AND op.apellido = 'de Hagen'  THEN 'PH'
        WHEN op.nombre = 'Segundo'       AND op.apellido = 'Guevara'   THEN 'SG'
        WHEN op.nombre = 'Benjamin'      AND op.apellido = 'Guiraldes' THEN 'BG'
        WHEN op.nombre = 'Segundo'       AND op.apellido = 'Balestra'  THEN 'SB'
        WHEN op.nombre = 'Santiago'      AND op.apellido = 'Zonni'     THEN 'SZ'
        WHEN op.nombre = 'Valentin'      AND op.apellido = 'Torriglia' THEN 'VT'
        WHEN op.nombre = 'David'         AND op.apellido = 'Menghi'    THEN 'DM'
        WHEN op.nombre = 'Gonzalo'       AND op.apellido = 'Haedo'     THEN 'GH'
        WHEN op.nombre = 'Ignacio'       AND op.apellido = 'Diez Peña' THEN 'IDP'
        WHEN op.nombre = 'Andres'        AND op.apellido = 'Moronell'  THEN 'AM'
        WHEN op.nombre = 'Santiago'      AND op.apellido = 'Busquet'   THEN 'SB'
        ELSE CONCAT(op.nombre, ' ', op.apellido) 
    END               AS operador_nombre,
    
    MIN(ci.rendimiento_esperado) AS rendimiento_minimo,
    r.visitas

FROM dcac.revisaciones r
    -- Joins Principales
    INNER JOIN dcac.compra_inmediata ci       ON r.revisacion = ci.revisacion
    INNER JOIN dcac.informes_revisaciones ir  ON ir.revisacion = r.revisacion
    
    -- Tablas Maestras / Lookups
    INNER JOIN dcac.provincias pv             ON pv.provincia = r.provincia
    INNER JOIN dcac.partidos pt               ON pt.partido = r.partido
    INNER JOIN dcac.categorias c              ON c.categoria = r.categoria
    INNER JOIN dcac.razas rz                  ON r.raza_publicacion = rz.raza
    INNER JOIN dcac.usuarios op               ON r.adm_solicitud = op.usuario
    INNER JOIN dcac.sociedades_tags sv        ON sv.id = r.sociedad_vendedora

WHERE r.estado IN (3, 6, 11, 12) 
  AND r.estado_b = 0 AND r.comprado_fecha = ""

GROUP BY 
    r.revisacion

ORDER BY 
    fecha_ultima_habilitacion DESC
