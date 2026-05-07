function ensureTeacherSupabase(providedClient) {
  if (providedClient) return providedClient;

  const url = window.SION_SUPABASE_URL || "";
  const anonKey = window.SION_SUPABASE_ANON_KEY || "";

  if (!window.supabase?.createClient) {
    throw new Error("No cargó la librería de Supabase.");
  }

  if (!url || !anonKey || url.includes("TU-PROYECTO") || anonKey.includes("TU_PUBLISHABLE_KEY")) {
    throw new Error("Falta configurar public/env.js con la URL y la publishable key de Supabase.");
  }

  return window.supabase.createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
}

async function unwrapSingle(query, fallbackMessage) {
  const { data, error } = await query;
  if (error) {
    throw new Error(error.message || fallbackMessage);
  }

  if (Array.isArray(data)) {
    if (data.length === 1) return data[0];
    if (data.length === 0) return null;
    throw new Error("La operación devolvió más de un registro y esperaba uno solo.");
  }

  return data || null;
}

async function fetchTeacherData(client) {
  const safeClient = ensureTeacherSupabase(client);

  const [
    coursesResult,
    studentsResult,
    enrollmentsResult,
    evaluationsResult,
    gradesResult,
    attendanceResult
  ] = await Promise.all([
    safeClient
      .from("materias")
      .select("*")
      .order("anio", { ascending: true })
      .order("cuatrimestre", { ascending: true })
      .order("nombre", { ascending: true }),
    safeClient
      .from("alumnos")
      .select("*")
      .order("apellido", { ascending: true })
      .order("nombre", { ascending: true }),
    safeClient
      .from("materia_alumnos")
      .select("id, materia_id, alumno_id, created_at")
      .order("created_at", { ascending: true }),
    safeClient
      .from("evaluaciones")
      .select("*")
      .order("orden", { ascending: true })
      .order("created_at", { ascending: true }),
    safeClient
      .from("calificaciones")
      .select("*")
      .order("updated_at", { ascending: false }),
    safeClient
      .from("asistencias")
      .select("*")
      .order("fecha", { ascending: false })
  ]);

  for (const result of [
    coursesResult,
    studentsResult,
    enrollmentsResult,
    evaluationsResult,
    gradesResult,
    attendanceResult
  ]) {
    if (result.error) {
      throw new Error(result.error.message || "No pude cargar la gestión docente.");
    }
  }

  return {
    courses: coursesResult.data || [],
    students: studentsResult.data || [],
    enrollments: enrollmentsResult.data || [],
    evaluations: evaluationsResult.data || [],
    grades: gradesResult.data || [],
    attendance: attendanceResult.data || []
  };
}

async function saveCourse(client, userId, payload) {
  const safeClient = ensureTeacherSupabase(client);
  const record = {
    nombre: payload.nombre,
    anio: payload.anio,
    cuatrimestre: payload.cuatrimestre,
    horario: payload.horario,
    aula: payload.aula,
    descripcion: payload.descripcion || ""
  };

  if (payload.id) {
    const updated = await unwrapSingle(
      safeClient.from("materias").update(record).eq("id", payload.id).select("*"),
      "No pude actualizar la materia."
    );

    if (!updated) {
      throw new Error("No se pudo actualizar la materia. Revisá la policy UPDATE de Supabase para public.materias.");
    }

    return updated;
  }

  const inserted = await unwrapSingle(
    safeClient.from("materias").insert(record).select("*"),
    "No pude guardar la materia."
  );

  if (!inserted) {
    throw new Error("No pude confirmar la materia creada.");
  }

  return inserted;
}

async function saveStudent(client, userId, payload) {
  const safeClient = ensureTeacherSupabase(client);
  const record = {
    dni: String(payload.dni || "").replace(/\D/g, ""),
    nombre: payload.nombre,
    apellido: payload.apellido,
    email: payload.email || "",
    telefono: payload.telefono || "",
    observaciones: payload.observaciones || ""
  };

  if (payload.id) {
    const updated = await unwrapSingle(
      safeClient.from("alumnos").update(record).eq("id", payload.id).select("*"),
      "No pude actualizar el alumno."
    );

    if (!updated) {
      throw new Error("No se pudo actualizar el alumno. Revisá la policy UPDATE de Supabase para public.alumnos.");
    }

    return updated;
  }

  const inserted = await unwrapSingle(
    safeClient.from("alumnos").insert(record).select("*"),
    "No pude guardar el alumno."
  );

  if (!inserted) {
    throw new Error("No pude confirmar el alumno creado.");
  }

  return inserted;
}

async function saveEnrollment(client, userId, materiaId, alumnoId) {
  const safeClient = ensureTeacherSupabase(client);
  const { data, error } = await safeClient
    .from("materia_alumnos")
    .upsert(
      {
        materia_id: materiaId,
        alumno_id: alumnoId
      },
      { onConflict: "materia_id,alumno_id" }
    )
    .select("*");

  if (error) throw new Error(error.message || "No pude inscribir el alumno en la materia.");
  return Array.isArray(data) ? data[0] || null : data;
}

async function deleteEnrollment(client, enrollmentId) {
  const safeClient = ensureTeacherSupabase(client);
  const { error } = await safeClient.from("materia_alumnos").delete().eq("id", enrollmentId);
  if (error) throw new Error(error.message || "No pude quitar el alumno de la materia.");
}

async function saveEvaluation(client, userId, payload) {
  const safeClient = ensureTeacherSupabase(client);
  const record = {
    materia_id: payload.materiaId,
    nombre: payload.nombre,
    tipo: payload.tipo,
    fecha: payload.fecha || null,
    orden: Number(payload.orden || 0),
    puntaje_maximo: Number(payload.puntajeMaximo || 10),
    cuenta_pendientes: payload.cuentaPendientes !== false
  };

  if (payload.id) {
    const updated = await unwrapSingle(
      safeClient.from("evaluaciones").update(record).eq("id", payload.id).select("*"),
      "No pude actualizar la evaluación."
    );
    if (!updated) {
      throw new Error("No se pudo actualizar la evaluación. Revisá la policy UPDATE de Supabase para public.evaluaciones.");
    }
    return updated;
  }

  const inserted = await unwrapSingle(
    safeClient.from("evaluaciones").insert(record).select("*"),
    "No pude guardar la evaluación."
  );

  if (!inserted) {
    throw new Error("No pude confirmar la evaluación creada.");
  }

  return inserted;
}

async function deleteEvaluation(client, evaluationId) {
  const safeClient = ensureTeacherSupabase(client);
  const { error } = await safeClient.from("evaluaciones").delete().eq("id", evaluationId);
  if (error) throw new Error(error.message || "No pude borrar la evaluación.");
}

async function saveGrade(client, userId, payload) {
  const safeClient = ensureTeacherSupabase(client);
  const { data, error } = await safeClient
    .from("calificaciones")
    .upsert(
      {
        evaluacion_id: payload.evaluacionId,
        alumno_id: payload.alumnoId,
        nota: Number(payload.nota),
        comentario: payload.comentario || ""
      },
      { onConflict: "evaluacion_id,alumno_id" }
    )
    .select("*");

  if (error) throw new Error(error.message || "No pude guardar la calificación.");
  return Array.isArray(data) ? data[0] || null : data;
}

async function saveAttendance(client, userId, payload) {
  const safeClient = ensureTeacherSupabase(client);
  const { data, error } = await safeClient
    .from("asistencias")
    .upsert(
      {
        materia_id: payload.materiaId,
        alumno_id: payload.alumnoId,
        fecha: payload.fecha,
        estado: payload.estado,
        observaciones: payload.observaciones || ""
      },
      { onConflict: "materia_id,alumno_id,fecha" }
    )
    .select("*");

  if (error) throw new Error(error.message || "No pude guardar la asistencia.");
  return Array.isArray(data) ? data[0] || null : data;
}

export {
  ensureTeacherSupabase,
  fetchTeacherData,
  saveCourse,
  saveStudent,
  saveEnrollment,
  deleteEnrollment,
  saveEvaluation,
  deleteEvaluation,
  saveGrade,
  saveAttendance
};
