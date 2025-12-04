SELECT e.id, e.nota, e.marca, e.modelo, ee.estado, ee.updated_at FROM equipos e LEFT JOIN estado_equipos ee ON e.id = ee.equipo_id ORDER BY e.nota;
