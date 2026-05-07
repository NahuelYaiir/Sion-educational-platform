import React, { useEffect, useMemo, useState } from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";
import htm from "https://esm.sh/htm@3.1.1";
import {
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
} from "./teacher-api.js";

const html = htm.bind(React.createElement);

const COURSE_FORM_INITIAL = {
  id: "",
  nombre: "",
  anio: "1",
  cuatrimestre: "1",
  horario: "",
  aula: "",
  descripcion: ""
};

const STUDENT_FORM_INITIAL = {
  id: "",
  dni: "",
  nombre: "",
  apellido: "",
  email: "",
  telefono: "",
  observaciones: ""
};

const EVALUATION_FORM_INITIAL = {
  id: "",
  nombre: "",
  tipo: "parcial",
  fecha: "",
  puntajeMaximo: "10"
};

const STATUS_CYCLE = ["present", "late", "absent", "justified"];

const STATUS_LABELS = {
  present: "Presente",
  late: "Tarde",
  absent: "Ausente",
  justified: "Justificada"
};

const STATUS_CLASS = {
  present: "green",
  late: "amber",
  absent: "red",
  justified: "blue"
};

let root = null;
let syncDashboardContext = null;

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function upsertById(items, nextItem) {
  const index = items.findIndex((item) => item.id === nextItem.id);
  if (index === -1) return [nextItem, ...items];
  const clone = items.slice();
  clone[index] = nextItem;
  return clone;
}

function normalizeDni(value) {
  return String(value || "").replace(/\D/g, "");
}

function studentFullName(student) {
  return [student?.apellido, student?.nombre].filter(Boolean).join(", ");
}

function averageOf(values) {
  const clean = values.map(Number).filter((value) => Number.isFinite(value));
  if (!clean.length) return null;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function gradeState(value) {
  if (!Number.isFinite(value)) return "neutral";
  if (value >= 7) return "approved";
  if (value >= 4) return "warning";
  return "failed";
}

function nextStatus(current) {
  const index = STATUS_CYCLE.indexOf(current);
  return STATUS_CYCLE[(index + 1) % STATUS_CYCLE.length] || STATUS_CYCLE[0];
}

function formatScore(value) {
  if (!Number.isFinite(Number(value))) return "-";
  return Number(value).toFixed(1).replace(/\.0$/, "");
}

function getAcademicSyncUrl() {
  return window.SION_ACADEMIC_SYNC_URL || window.SION_DRIVE_UPLOAD_URL || "";
}

function getAcademicSpreadsheetId() {
  return window.SION_ACADEMIC_SPREADSHEET_ID || "";
}

function summarizeAttendance(records) {
  return records.reduce(
    (acc, record) => {
      acc.total += 1;
      if (record.estado === "present") acc.present += 1;
      if (record.estado === "late") acc.late += 1;
      if (record.estado === "absent") acc.absent += 1;
      if (record.estado === "justified") acc.justified += 1;
      return acc;
    },
    { total: 0, present: 0, late: 0, absent: 0, justified: 0 }
  );
}

function TeacherDashboardApp({ context }) {
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [notice, setNotice] = useState({ message: "", type: "" });
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [grades, setGrades] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedStudentIdToEnroll, setSelectedStudentIdToEnroll] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(todayString());
  const [dniQuery, setDniQuery] = useState("");
  const [teacherSection, setTeacherSection] = useState("my-courses");
  const [courseForm, setCourseForm] = useState(COURSE_FORM_INITIAL);
  const [studentForm, setStudentForm] = useState(STUDENT_FORM_INITIAL);
  const [evaluationForm, setEvaluationForm] = useState(EVALUATION_FORM_INITIAL);
  const [gradeDrafts, setGradeDrafts] = useState({});
  const [gradeCommentDrafts, setGradeCommentDrafts] = useState({});
  const [selectedGradeKey, setSelectedGradeKey] = useState("");

  const supabaseClient = useMemo(() => {
    try {
      return ensureTeacherSupabase(context?.supabase || null);
    } catch (_error) {
      return null;
    }
  }, [context?.supabase]);

  const userId = context?.currentUser?.id || "";

  const announce = (message, type = "info") => {
    setNotice({ message, type });
    if (typeof context?.notify === "function" && type !== "info") {
      context.notify(message, type === "error" ? "error" : type === "warning" ? "warning" : "success");
    }
  };

  const loadData = async (preferredCourseId = "") => {
    if (!supabaseClient || !userId) {
      setCourses([]);
      setStudents([]);
      setEnrollments([]);
      setEvaluations([]);
      setGrades([]);
      setAttendance([]);
      setSelectedCourseId("");
      setSelectedStudentId("");
      setSelectedStudentIdToEnroll("");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const payload = await fetchTeacherData(supabaseClient);
      setCourses(payload.courses);
      setStudents(payload.students);
      setEnrollments(payload.enrollments);
      setEvaluations(payload.evaluations);
      setGrades(payload.grades);
      setAttendance(payload.attendance);
      setSelectedCourseId((current) => {
        const candidate = preferredCourseId || current;
        if (candidate && payload.courses.some((course) => course.id === candidate)) return candidate;
        return payload.courses[0]?.id || "";
      });
      setSelectedStudentId((current) => {
        if (current && payload.students.some((student) => student.id === current)) return current;
        return payload.students[0]?.id || "";
      });
      setSelectedStudentIdToEnroll((current) => {
        if (current && payload.students.some((student) => student.id === current)) return current;
        return payload.students[0]?.id || "";
      });
      setNotice({ message: "", type: "" });
    } catch (error) {
      announce(error.message || "No pude cargar la gestión docente.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [supabaseClient, userId]);

  const studentMap = useMemo(
    () => Object.fromEntries(students.map((student) => [student.id, student])),
    [students]
  );

  const evaluationMap = useMemo(
    () => Object.fromEntries(evaluations.map((evaluation) => [evaluation.id, evaluation])),
    [evaluations]
  );

  const groupedCourses = useMemo(() => {
    return courses.reduce((acc, course) => {
      const key = `${course.anio}° Año · ${course.cuatrimestre}° Cuatrimestre`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(course);
      return acc;
    }, {});
  }, [courses]);

  const selectedCourse = courses.find((course) => course.id === selectedCourseId) || null;
  const selectedEnrollments = enrollments
    .filter((enrollment) => enrollment.materia_id === selectedCourseId)
    .map((enrollment) => ({ ...enrollment, student: studentMap[enrollment.alumno_id] }))
    .filter((enrollment) => enrollment.student);

  const selectedEvaluations = evaluations.filter((evaluation) => evaluation.materia_id === selectedCourseId);

  const availableStudents = students.filter(
    (student) => !selectedEnrollments.some((enrollment) => enrollment.alumno_id === student.id)
  );

  const searchResults = useMemo(() => {
    const query = dniQuery.trim().toLowerCase();
    if (!query) return [];
    return students.filter((student) => {
      const haystack = [
        normalizeDni(student.dni),
        student.nombre?.toLowerCase() || "",
        student.apellido?.toLowerCase() || ""
      ].join(" ");
      return haystack.includes(query);
    });
  }, [dniQuery, students]);

  const focusedStudent =
    students.find((student) => student.id === selectedStudentId) ||
    searchResults[0] ||
    students[0] ||
    null;

  const focusedStudentEnrollments = enrollments
    .filter((enrollment) => enrollment.alumno_id === focusedStudent?.id)
    .map((enrollment) => ({
      ...enrollment,
      course: courses.find((course) => course.id === enrollment.materia_id) || null
    }))
    .filter((enrollment) => enrollment.course);

  const focusedStudentAttendance = attendance.filter((record) => record.alumno_id === focusedStudent?.id);
  const focusedAttendanceSummary = summarizeAttendance(focusedStudentAttendance);

  const focusedStudentGrades = grades
    .filter((grade) => grade.alumno_id === focusedStudent?.id)
    .map((grade) => ({
      ...grade,
      evaluation: evaluationMap[grade.evaluacion_id] || null
    }))
    .filter((grade) => grade.evaluation)
    .slice(0, 6);

  const correctionSummary = courses.map((course) => {
    const courseEnrollments = enrollments.filter((enrollment) => enrollment.materia_id === course.id);
    const courseEvaluations = evaluations.filter(
      (evaluation) => evaluation.materia_id === course.id && evaluation.cuenta_pendientes
    );

    const pending = courseEvaluations.reduce((sum, evaluation) => {
      const corrected = grades.filter((grade) => grade.evaluacion_id === evaluation.id).length;
      return sum + Math.max(courseEnrollments.length - corrected, 0);
    }, 0);

    return { course, pending };
  });

  const getAttendanceRecord = (studentId) =>
    attendance.find(
      (record) =>
        record.materia_id === selectedCourseId &&
        record.alumno_id === studentId &&
        record.fecha === attendanceDate
    ) || null;

  const getDisplayedGrade = (evaluationId, studentId) => {
    const key = `${evaluationId}:${studentId}`;
    if (Object.prototype.hasOwnProperty.call(gradeDrafts, key)) {
      return gradeDrafts[key];
    }

    const existing = grades.find(
      (grade) => grade.evaluacion_id === evaluationId && grade.alumno_id === studentId
    );
    return existing ? String(existing.nota) : "";
  };

  const getExistingGrade = (evaluationId, studentId) =>
    grades.find((grade) => grade.evaluacion_id === evaluationId && grade.alumno_id === studentId) || null;

  const getDisplayedComment = (evaluationId, studentId) => {
    const key = `${evaluationId}:${studentId}`;
    if (Object.prototype.hasOwnProperty.call(gradeCommentDrafts, key)) {
      return gradeCommentDrafts[key];
    }

    return getExistingGrade(evaluationId, studentId)?.comentario || "";
  };

  const selectedGradeMeta = useMemo(() => {
    if (!selectedGradeKey) return null;
    const [evaluationId, studentId] = selectedGradeKey.split(":");
    const evaluation = selectedEvaluations.find((item) => item.id === evaluationId) || null;
    const student = selectedEnrollments.find((item) => item.student.id === studentId)?.student || null;
    if (!evaluation || !student) return null;
    return { evaluationId, studentId, evaluation, student };
  }, [selectedGradeKey, selectedEvaluations, selectedEnrollments]);

  const handleCourseSubmit = async (event) => {
    event.preventDefault();
    if (!userId || !supabaseClient) return;

    const payload = {
      ...courseForm,
      nombre: courseForm.nombre.trim(),
      horario: courseForm.horario.trim(),
      aula: courseForm.aula.trim(),
      descripcion: courseForm.descripcion.trim(),
      anio: Number(courseForm.anio),
      cuatrimestre: Number(courseForm.cuatrimestre)
    };

    if (!payload.nombre || !payload.horario || !payload.aula) {
      announce("Completá nombre, horario y aula para guardar la materia.", "warning");
      return;
    }

    setBusyKey("course");
    try {
      const saved = await saveCourse(supabaseClient, userId, payload);
      setCourseForm(COURSE_FORM_INITIAL);
      await loadData(saved.id);
      announce(payload.id ? "Materia actualizada." : "Materia creada.", "success");
    } catch (error) {
      announce(error.message || "No pude guardar la materia.", "error");
    } finally {
      setBusyKey("");
    }
  };

  const handleStudentSubmit = async (event) => {
    event.preventDefault();
    if (!userId || !supabaseClient) return;

    const payload = {
      ...studentForm,
      dni: normalizeDni(studentForm.dni),
      nombre: studentForm.nombre.trim(),
      apellido: studentForm.apellido.trim(),
      email: studentForm.email.trim(),
      telefono: studentForm.telefono.trim(),
      observaciones: studentForm.observaciones.trim()
    };

    if (!payload.dni || !payload.nombre || !payload.apellido) {
      announce("Completá DNI, nombre y apellido para guardar el alumno.", "warning");
      return;
    }

    setBusyKey("student");
    try {
      const saved = await saveStudent(supabaseClient, userId, payload);
      setStudents((current) => upsertById(current, saved).sort((a, b) => studentFullName(a).localeCompare(studentFullName(b))));
      setSelectedStudentId(saved.id);
      setSelectedStudentIdToEnroll(saved.id);
      setStudentForm(STUDENT_FORM_INITIAL);
      announce(payload.id ? "Alumno actualizado." : "Alumno guardado.", "success");
    } catch (error) {
      announce(error.message || "No pude guardar el alumno.", "error");
    } finally {
      setBusyKey("");
    }
  };

  const handleEnrollStudent = async () => {
    if (!selectedCourseId || !selectedStudentIdToEnroll || !userId || !supabaseClient) {
      announce("Elegí una materia y un alumno para inscribirlo.", "warning");
      return;
    }

    setBusyKey("enrollment");
    try {
      const saved = await saveEnrollment(supabaseClient, userId, selectedCourseId, selectedStudentIdToEnroll);
      setEnrollments((current) => upsertById(current, saved));
      announce("Alumno inscripto en la materia.", "success");
    } catch (error) {
      announce(error.message || "No pude inscribir el alumno.", "error");
    } finally {
      setBusyKey("");
    }
  };

  const handleRemoveEnrollment = async (enrollmentId) => {
    if (!supabaseClient) return;

    setBusyKey(`unenroll:${enrollmentId}`);
    try {
      await deleteEnrollment(supabaseClient, enrollmentId);
      setEnrollments((current) => current.filter((enrollment) => enrollment.id !== enrollmentId));
      announce("Alumno quitado de la materia.", "success");
    } catch (error) {
      announce(error.message || "No pude quitar el alumno.", "error");
    } finally {
      setBusyKey("");
    }
  };

  const handleToggleAttendance = async (studentId) => {
    if (!selectedCourseId || !userId || !supabaseClient) return;

    const currentRecord = getAttendanceRecord(studentId);
    const next = nextStatus(currentRecord?.estado || "justified");

    setBusyKey(`attendance:${studentId}`);
    try {
      const saved = await saveAttendance(supabaseClient, userId, {
        materiaId: selectedCourseId,
        alumnoId: studentId,
        fecha: attendanceDate,
        estado: next
      });
      setAttendance((current) => upsertById(current, saved));
    } catch (error) {
      announce(error.message || "No pude guardar la asistencia.", "error");
    } finally {
      setBusyKey("");
    }
  };

  const handleEvaluationSubmit = async (event) => {
    event.preventDefault();
    if (!selectedCourseId || !userId || !supabaseClient) {
      announce("Seleccioná una materia antes de crear evaluaciones.", "warning");
      return;
    }

    const payload = {
      ...evaluationForm,
      materiaId: selectedCourseId,
      nombre: evaluationForm.nombre.trim(),
      tipo: evaluationForm.tipo,
      fecha: evaluationForm.fecha,
      puntajeMaximo: evaluationForm.puntajeMaximo || "10",
      orden: evaluationForm.id
        ? selectedEvaluations.find((item) => item.id === evaluationForm.id)?.orden || selectedEvaluations.length + 1
        : selectedEvaluations.length + 1
    };

    if (!payload.nombre) {
      announce("Poné un nombre para la evaluación.", "warning");
      return;
    }

    setBusyKey("evaluation");
    try {
      const saved = await saveEvaluation(supabaseClient, userId, payload);
      setEvaluations((current) =>
        upsertById(current, saved).sort((a, b) => (a.orden || 0) - (b.orden || 0))
      );
      setEvaluationForm(EVALUATION_FORM_INITIAL);
      announce(payload.id ? "Evaluación actualizada." : "Evaluación creada.", "success");
    } catch (error) {
      announce(error.message || "No pude guardar la evaluación.", "error");
    } finally {
      setBusyKey("");
    }
  };

  const handleDeleteEvaluation = async (evaluationId) => {
    if (!supabaseClient) return;
    setBusyKey(`delete-evaluation:${evaluationId}`);
    try {
      await deleteEvaluation(supabaseClient, evaluationId);
      setEvaluations((current) => current.filter((item) => item.id !== evaluationId));
      setGrades((current) => current.filter((item) => item.evaluacion_id !== evaluationId));
      if (selectedGradeKey && selectedGradeKey.startsWith(`${evaluationId}:`)) {
        setSelectedGradeKey("");
      }
      setEvaluationForm(EVALUATION_FORM_INITIAL);
      announce("Evaluación borrada.", "success");
    } catch (error) {
      announce(error.message || "No pude borrar la evaluación.", "error");
    } finally {
      setBusyKey("");
    }
  };

  const persistGrade = async (evaluationId, studentId) => {
    if (!userId || !supabaseClient) return;
    const key = `${evaluationId}:${studentId}`;
    const rawValue = Object.prototype.hasOwnProperty.call(gradeDrafts, key)
      ? gradeDrafts[key]
      : getExistingGrade(evaluationId, studentId)?.nota ?? "";
    const commentValue = getDisplayedComment(evaluationId, studentId);
    const existing = getExistingGrade(evaluationId, studentId);

    if (rawValue === undefined && !Object.prototype.hasOwnProperty.call(gradeCommentDrafts, key)) {
      return;
    }

    if (String(rawValue).trim() === "") {
      setGradeDrafts((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      return;
    }

    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) {
      announce("La nota debe ser numérica.", "warning");
      return;
    }

    setBusyKey(`grade:${key}`);
    try {
      const saved = await saveGrade(supabaseClient, userId, {
        evaluacionId: evaluationId,
        alumnoId: studentId,
        nota: numeric,
        comentario: commentValue
      });
      setGrades((current) => upsertById(current, saved));
      setGradeDrafts((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      setGradeCommentDrafts((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      if (!existing || existing.comentario !== saved.comentario || Number(existing.nota) !== Number(saved.nota)) {
        announce("Nota guardada.", "success");
      }
    } catch (error) {
      announce(error.message || "No pude guardar la nota.", "error");
    } finally {
      setBusyKey("");
    }
  };

  const exportAttendanceToSheet = async () => {
    const syncUrl = getAcademicSyncUrl();
    const spreadsheetId = getAcademicSpreadsheetId();

    if (!syncUrl || !spreadsheetId) {
      announce("Falta configurar la URL del Apps Script o el Spreadsheet ID para exportar presentismo.", "warning");
      return;
    }

    if (!selectedCourse || !selectedEnrollments.length) {
      announce("Necesitás una materia con alumnos inscriptos para exportar presentismo.", "warning");
      return;
    }

    setBusyKey("export-attendance");
    try {
      const rows = selectedEnrollments.map((enrollment) => {
        const record = getAttendanceRecord(enrollment.student.id);
        return {
          sync_key: `${selectedCourse.id}:${attendanceDate}`,
          materia_id: selectedCourse.id,
          materia: selectedCourse.nombre,
          fecha: attendanceDate,
          alumno_id: enrollment.student.id,
          alumno: studentFullName(enrollment.student),
          dni: enrollment.student.dni,
          estado: STATUS_LABELS[record?.estado || "absent"],
          horario: selectedCourse.horario,
          aula: selectedCourse.aula
        };
      });

      const response = await fetch(syncUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync_academic_rows",
          spreadsheetId,
          sheetName: "presentismo",
          replaceKey: `${selectedCourse.id}:${attendanceDate}`,
          rows
        })
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.error) {
        throw new Error(result.error || `Sheets respondió con ${response.status}.`);
      }

      announce("Presentismo exportado a Google Sheets.", "success");
    } catch (error) {
      announce(error.message || "No pude exportar presentismo a Google Sheets.", "error");
    } finally {
      setBusyKey("");
    }
  };

  const exportGradesToSheet = async () => {
    const syncUrl = getAcademicSyncUrl();
    const spreadsheetId = getAcademicSpreadsheetId();

    if (!syncUrl || !spreadsheetId) {
      announce("Falta configurar la URL del Apps Script o el Spreadsheet ID para exportar notas.", "warning");
      return;
    }

    if (!selectedCourse || !selectedEnrollments.length || !selectedEvaluations.length) {
      announce("Necesitás una materia con alumnos y evaluaciones para exportar notas.", "warning");
      return;
    }

    setBusyKey("export-grades");
    try {
      const rows = selectedEnrollments.flatMap((enrollment) =>
        selectedEvaluations.map((evaluation) => {
          const grade = getExistingGrade(evaluation.id, enrollment.student.id);
          return {
            sync_key: `${selectedCourse.id}:notas`,
            materia_id: selectedCourse.id,
            materia: selectedCourse.nombre,
            alumno_id: enrollment.student.id,
            alumno: studentFullName(enrollment.student),
            dni: enrollment.student.dni,
            evaluacion_id: evaluation.id,
            evaluacion: evaluation.nombre,
            tipo: evaluation.tipo,
            fecha: evaluation.fecha || "",
            nota: grade?.nota ?? "",
            comentario: grade?.comentario || ""
          };
        })
      );

      const response = await fetch(syncUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync_academic_rows",
          spreadsheetId,
          sheetName: "notas",
          replaceKey: `${selectedCourse.id}:notas`,
          rows
        })
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.error) {
        throw new Error(result.error || `Sheets respondió con ${response.status}.`);
      }

      announce("Notas exportadas a Google Sheets.", "success");
    } catch (error) {
      announce(error.message || "No pude exportar notas a Google Sheets.", "error");
    } finally {
      setBusyKey("");
    }
  };

  if (!supabaseClient) {
    return html`
      <div className="teacher-dashboard">
        <section className="teacher-hero">
          <div>
            <p className="teacher-kicker">Gestión docente</p>
            <h2 className="teacher-title">Falta configurar Supabase</h2>
            <p className="teacher-subtitle">
              La pestaña docente ya está preparada, pero necesita la configuración de Supabase para poder guardar materias, alumnos, asistencias y notas reales.
            </p>
          </div>
        </section>
      </div>
    `;
  }

  if (!userId) {
    return html`
      <div className="teacher-dashboard">
        <section className="teacher-hero">
          <div>
            <p className="teacher-kicker">Gestión docente</p>
            <h2 className="teacher-title">Iniciá sesión para entrar al tablero</h2>
            <p className="teacher-subtitle">
              Cuando tu sesión esté activa, esta pestaña te deja crear materias, cargar alumnos reales e inscribirlos para tomar asistencia y cargar notas.
            </p>
          </div>
        </section>
      </div>
    `;
  }

  return html`
    <div className="teacher-dashboard">
      <section className="teacher-hero">
        <div>
          <p className="teacher-kicker">Tablero docente real</p>
          <h2 className="teacher-title">Materias, alumnos, asistencia y notas en un solo lugar</h2>
          <p className="teacher-subtitle">
            Cada profesor trabaja sobre su propia base privada. Podés crear materias, cargar alumnos, inscribirlos y registrar asistencia y calificaciones con persistencia real.
          </p>
        </div>
        <div className="teacher-metrics">
          <span className="status-pill blue">${courses.length} materias</span>
          <span className="status-pill green">${students.length} alumnos cargados</span>
          <span className="status-pill amber">
            ${enrollments.length} inscripciones activas
          </span>
        </div>
      </section>

      ${notice.message
        ? html`
            <section className=${`teacher-alert ${notice.type || "info"}`}>
              ${notice.message}
            </section>
          `
        : null}

      <section className="teacher-subnav">
        <button
          type="button"
          className=${`teacher-subnav-btn ${teacherSection === "create-course" ? "active" : ""}`}
          onClick=${() => setTeacherSection("create-course")}
        >
          Crear materia
        </button>
        <button
          type="button"
          className=${`teacher-subnav-btn ${teacherSection === "enroll-student" ? "active" : ""}`}
          onClick=${() => setTeacherSection("enroll-student")}
        >
          Inscribir alumno
        </button>
        <button
          type="button"
          className=${`teacher-subnav-btn ${teacherSection === "my-courses" ? "active" : ""}`}
          onClick=${() => setTeacherSection("my-courses")}
        >
          Mis materias
        </button>
      </section>

      <div className="teacher-shell">
        <aside className="teacher-sidebar">
          ${teacherSection === "create-course"
            ? html`
                <section className="teacher-panel">
                  <div className="teacher-head">
                    <div>
                      <p className="teacher-kicker">Cátedras</p>
                      <h3>${courseForm.id ? "Editar materia" : "Nueva materia"}</h3>
                    </div>
                  </div>
                  <form className="teacher-form" onSubmit=${handleCourseSubmit}>
                    <div className="teacher-form-grid">
                      <label>
                        <span>Nombre</span>
                        <input
                          value=${courseForm.nombre}
                          onInput=${(event) => setCourseForm({ ...courseForm, nombre: event.target.value })}
                          placeholder="Ej: Hermenéutica"
                        />
                      </label>
                      <label>
                        <span>Año</span>
                        <select
                          value=${courseForm.anio}
                          onChange=${(event) => setCourseForm({ ...courseForm, anio: event.target.value })}
                        >
                          ${[1, 2, 3, 4, 5, 6].map((value) => html`<option value=${String(value)}>${value}°</option>`)}
                        </select>
                      </label>
                      <label>
                        <span>Cuatrimestre</span>
                        <select
                          value=${courseForm.cuatrimestre}
                          onChange=${(event) => setCourseForm({ ...courseForm, cuatrimestre: event.target.value })}
                        >
                          <option value="1">1°</option>
                          <option value="2">2°</option>
                        </select>
                      </label>
                      <label>
                        <span>Horario</span>
                        <input
                          value=${courseForm.horario}
                          onInput=${(event) => setCourseForm({ ...courseForm, horario: event.target.value })}
                          placeholder="Miércoles 19:00 a 22:00"
                        />
                      </label>
                      <label>
                        <span>Aula</span>
                        <input
                          value=${courseForm.aula}
                          onInput=${(event) => setCourseForm({ ...courseForm, aula: event.target.value })}
                          placeholder="Aula 2"
                        />
                      </label>
                    </div>
                    <label>
                      <span>Descripción</span>
                      <textarea
                        rows="3"
                        value=${courseForm.descripcion}
                        onInput=${(event) => setCourseForm({ ...courseForm, descripcion: event.target.value })}
                        placeholder="Notas internas de la materia"
                      ></textarea>
                    </label>
                    <div className="teacher-actions">
                      <button className="teacher-btn primary" type="submit" disabled=${busyKey === "course"}>
                        ${busyKey === "course" ? "Guardando..." : courseForm.id ? "Actualizar materia" : "Crear materia"}
                      </button>
                      ${courseForm.id
                        ? html`
                            <button
                              className="teacher-btn ghost"
                              type="button"
                              onClick=${() => setCourseForm(COURSE_FORM_INITIAL)}
                            >
                              Cancelar edición
                            </button>
                          `
                        : null}
                    </div>
                  </form>
                </section>
              `
            : null}

          ${teacherSection === "my-courses"
            ? html`
                <section className="teacher-panel">
                  <div className="teacher-head">
                    <div>
                      <p className="teacher-kicker">Mis materias</p>
                      <h3>Entrá a cada cátedra</h3>
                    </div>
                  </div>
                  <div className="teacher-stack">
                    ${Object.keys(groupedCourses).length
                      ? Object.entries(groupedCourses).map(
                          ([group, items]) => html`
                            <div className="semester-group" key=${group}>
                              <p className="semester-heading">${group}</p>
                              ${items.map(
                                (course) => html`
                                  <article className=${`course-card ${course.id === selectedCourseId ? "active" : ""}`} key=${course.id}>
                                    <button
                                      type="button"
                                      className="course-card-button"
                                      onClick=${() => setSelectedCourseId(course.id)}
                                    >
                                      <h4>${course.nombre}</h4>
                                      <div className="course-meta">
                                        <span>${course.horario}</span>
                                        <span>${course.aula}</span>
                                      </div>
                                    </button>
                                    <div className="course-card-actions">
                                      <button
                                        type="button"
                                        className="teacher-btn ghost compact"
                                        onClick=${() => {
                                          setTeacherSection("create-course");
                                          setCourseForm({
                                            id: course.id,
                                            nombre: course.nombre,
                                            anio: String(course.anio),
                                            cuatrimestre: String(course.cuatrimestre),
                                            horario: course.horario,
                                            aula: course.aula,
                                            descripcion: course.descripcion || ""
                                          });
                                        }}
                                      >
                                        Editar
                                      </button>
                                    </div>
                                  </article>
                                `
                              )}
                            </div>
                          `
                        )
                      : html`<div className="empty-card">Todavía no creaste materias. Empezá desde Crear materia.</div>`}
                  </div>
                </section>
              `
            : null}
        </aside>

        <section className="teacher-panel-grid">
          ${teacherSection === "create-course"
            ? html`
                <section className="teacher-panel span-2">
                  <div className="teacher-head">
                    <div>
                      <p className="teacher-kicker">Panorama</p>
                      <h3>Resumen de cátedras</h3>
                    </div>
                  </div>
                  <div className="teacher-overview-grid">
                    <div className="history-stat">
                      <span className="teacher-note">Materias creadas</span>
                      <strong>${courses.length}</strong>
                    </div>
                    <div className="history-stat">
                      <span className="teacher-note">Alumnos cargados</span>
                      <strong>${students.length}</strong>
                    </div>
                    <div className="history-stat">
                      <span className="teacher-note">Inscripciones</span>
                      <strong>${enrollments.length}</strong>
                    </div>
                  </div>
                </section>
              `
            : null}

          ${teacherSection === "enroll-student"
            ? html`
              <section className="teacher-panel">
                <div className="teacher-head">
                  <div>
                    <p className="teacher-kicker">Base de alumnos</p>
                    <h3>Alta, edición y búsqueda por DNI</h3>
                  </div>
                </div>
                <div className="search-shell">
              <input
                className="teacher-search"
                placeholder="Buscar por DNI, nombre o apellido"
                value=${dniQuery}
                onInput=${(event) => setDniQuery(event.target.value)}
              />
              ${searchResults.length
                ? html`
                    <div className="results-list">
                      ${searchResults.map(
                        (student) => html`
                          <button
                            type="button"
                            className=${`result-chip ${student.id === focusedStudent?.id ? "active" : ""}`}
                            onClick=${() => setSelectedStudentId(student.id)}
                            key=${student.id}
                          >
                            ${student.apellido}, ${student.nombre} · DNI ${student.dni}
                          </button>
                        `
                      )}
                    </div>
                  `
                : dniQuery
                ? html`<div className="empty-card">No encontré alumnos con ese criterio.</div>`
                : null}

              <form className="teacher-form" onSubmit=${handleStudentSubmit}>
                <div className="teacher-form-grid">
                  <label>
                    <span>DNI</span>
                    <input
                      value=${studentForm.dni}
                      onInput=${(event) => setStudentForm({ ...studentForm, dni: event.target.value })}
                      placeholder="Documento"
                    />
                  </label>
                  <label>
                    <span>Nombre</span>
                    <input
                      value=${studentForm.nombre}
                      onInput=${(event) => setStudentForm({ ...studentForm, nombre: event.target.value })}
                    />
                  </label>
                  <label>
                    <span>Apellido</span>
                    <input
                      value=${studentForm.apellido}
                      onInput=${(event) => setStudentForm({ ...studentForm, apellido: event.target.value })}
                    />
                  </label>
                  <label>
                    <span>Email</span>
                    <input
                      value=${studentForm.email}
                      onInput=${(event) => setStudentForm({ ...studentForm, email: event.target.value })}
                    />
                  </label>
                  <label>
                    <span>Teléfono</span>
                    <input
                      value=${studentForm.telefono}
                      onInput=${(event) => setStudentForm({ ...studentForm, telefono: event.target.value })}
                    />
                  </label>
                </div>
                <label>
                  <span>Observaciones</span>
                  <textarea
                    rows="3"
                    value=${studentForm.observaciones}
                    onInput=${(event) => setStudentForm({ ...studentForm, observaciones: event.target.value })}
                  ></textarea>
                </label>
                <div className="teacher-actions">
                  <button className="teacher-btn primary" type="submit" disabled=${busyKey === "student"}>
                    ${busyKey === "student" ? "Guardando..." : studentForm.id ? "Actualizar alumno" : "Guardar alumno"}
                  </button>
                  ${studentForm.id
                    ? html`
                        <button
                          className="teacher-btn ghost"
                          type="button"
                          onClick=${() => setStudentForm(STUDENT_FORM_INITIAL)}
                        >
                          Cancelar edición
                        </button>
                      `
                    : null}
                </div>
              </form>

              ${focusedStudent
                ? html`
                    <article className="student-card">
                      <div className="student-card-head">
                        <div>
                          <h4>${studentFullName(focusedStudent)}</h4>
                          <div className="student-meta">
                            <span>DNI ${focusedStudent.dni}</span>
                            ${focusedStudent.email ? html`<span>${focusedStudent.email}</span>` : null}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="teacher-btn ghost compact"
                          onClick=${() => {
                            setSelectedStudentId(focusedStudent.id);
                            setSelectedStudentIdToEnroll(focusedStudent.id);
                            setStudentForm({
                              id: focusedStudent.id,
                              dni: focusedStudent.dni,
                              nombre: focusedStudent.nombre,
                              apellido: focusedStudent.apellido,
                              email: focusedStudent.email || "",
                              telefono: focusedStudent.telefono || "",
                              observaciones: focusedStudent.observaciones || ""
                            });
                          }}
                        >
                          Editar
                        </button>
                      </div>
                      <div className="history-grid">
                        <div className="history-stat">
                          <span className="teacher-note">Materias</span>
                          <strong>${focusedStudentEnrollments.length}</strong>
                        </div>
                        <div className="history-stat">
                          <span className="teacher-note">Asistencia registrada</span>
                          <strong>${focusedAttendanceSummary.total}</strong>
                        </div>
                      </div>
                      <div className="mini-list">
                        <div>
                          <p className="teacher-mini-title">Cursadas</p>
                          ${focusedStudentEnrollments.length
                            ? focusedStudentEnrollments.map(
                                (item) => html`<div className="mini-row" key=${item.id}>${item.course.nombre}</div>`
                              )
                            : html`<div className="teacher-note">Todavía no está inscripto en materias.</div>`}
                        </div>
                        <div>
                          <p className="teacher-mini-title">Notas recientes</p>
                          ${focusedStudentGrades.length
                            ? focusedStudentGrades.map(
                                (item) => html`
                                  <div className="mini-row" key=${item.id}>
                                    ${item.evaluation.nombre}: ${formatScore(item.nota)}
                                  </div>
                                `
                              )
                            : html`<div className="teacher-note">Sin calificaciones cargadas.</div>`}
                        </div>
                      </div>
                    </article>
                  `
                : null}
                </div>
              </section>

              <section className="teacher-panel">
                <div className="teacher-head">
                  <div>
                    <p className="teacher-kicker">Inscripciones</p>
                    <h3>${selectedCourse ? selectedCourse.nombre : "Seleccioná una materia"}</h3>
                  </div>
                </div>
                ${selectedCourse
                  ? html`
                      <div className="teacher-form">
                        <label>
                          <span>Agregar alumno a la materia</span>
                          <select
                            value=${selectedStudentIdToEnroll}
                            onChange=${(event) => setSelectedStudentIdToEnroll(event.target.value)}
                          >
                            <option value="">Elegí un alumno</option>
                            ${availableStudents.map(
                              (student) => html`
                                <option value=${student.id} key=${student.id}>
                                  ${student.apellido}, ${student.nombre} · DNI ${student.dni}
                                </option>
                              `
                            )}
                          </select>
                        </label>
                        <div className="teacher-actions">
                          <button
                            type="button"
                            className="teacher-btn primary"
                            disabled=${busyKey === "enrollment" || !availableStudents.length}
                            onClick=${handleEnrollStudent}
                          >
                            ${busyKey === "enrollment" ? "Inscribiendo..." : "Inscribir alumno"}
                          </button>
                        </div>
                      </div>

                      <div className="roster-list">
                        ${selectedEnrollments.length
                          ? selectedEnrollments.map(
                              (enrollment) => html`
                                <article className="roster-item" key=${enrollment.id}>
                                  <div>
                                    <strong>${studentFullName(enrollment.student)}</strong>
                                    <div className="teacher-note">DNI ${enrollment.student.dni}</div>
                                  </div>
                                  <div className="roster-actions">
                                    <button
                                      type="button"
                                      className="teacher-btn ghost compact"
                                      onClick=${() => setSelectedStudentId(enrollment.student.id)}
                                    >
                                      Ver perfil
                                    </button>
                                    <button
                                      type="button"
                                      className="teacher-btn danger compact"
                                      disabled=${busyKey === `unenroll:${enrollment.id}`}
                                      onClick=${() => handleRemoveEnrollment(enrollment.id)}
                                    >
                                      Quitar
                                    </button>
                                  </div>
                                </article>
                              `
                            )
                          : html`<div className="empty-card">Todavía no hay alumnos inscriptos en esta materia.</div>`}
                      </div>
                    `
                  : html`<div className="empty-card">Elegí una materia desde Mis materias para gestionar inscripciones.</div>`}
              </section>
            `
            : null}

          ${teacherSection === "my-courses"
            ? html`<section className="teacher-panel">
            <div className="teacher-head">
              <div>
                <p className="teacher-kicker">Bandeja de corrección</p>
                <h3>Exámenes pendientes por materia</h3>
              </div>
            </div>
            <div className="correction-list">
              ${correctionSummary.length
                ? correctionSummary.map(
                    (item) => html`
                      <div className="correction-item" key=${item.course.id}>
                        <div>
                          <h4>${item.course.nombre}</h4>
                          <div className="teacher-note">
                            ${item.course.anio}° Año · ${item.course.cuatrimestre}° Cuatrimestre
                          </div>
                        </div>
                        <span className=${`status-pill ${item.pending > 0 ? "amber" : "green"}`}>
                          ${item.pending} pendientes
                        </span>
                      </div>
                    `
                  )
                : html`<div className="empty-card">Las materias que crees van a mostrar acá sus pendientes de corrección.</div>`}
            </div>
          </section>`
            : null}

          ${teacherSection === "my-courses"
            ? html`<section className="teacher-panel span-2">
            <div className="attendance-toolbar">
              <div>
                <p className="teacher-kicker">Asistencia</p>
                <h3>${selectedCourse ? selectedCourse.nombre : "Centro de control de asistencia"}</h3>
                <div className="teacher-help">
                  ${selectedCourse ? `${selectedCourse.horario} · ${selectedCourse.aula}` : "Seleccioná una materia para pasar lista."}
                </div>
              </div>
              <div className="toolbar-actions">
                <input
                  className="teacher-date"
                  type="date"
                  value=${attendanceDate}
                  onChange=${(event) => setAttendanceDate(event.target.value)}
                />
                <button
                  type="button"
                  className="teacher-btn ghost compact"
                  disabled=${busyKey === "export-attendance"}
                  onClick=${exportAttendanceToSheet}
                >
                  ${busyKey === "export-attendance" ? "Exportando..." : "Exportar presentismo"}
                </button>
              </div>
            </div>
            ${selectedCourse && selectedEnrollments.length
              ? html`
            <div className="attendance-grid">
                    <div className="attendance-row header">
                      <span>Alumno</span>
                      <span>Estado actual</span>
                      <span>Pasar lista</span>
                      <span>Resumen</span>
                      <span>Perfil</span>
                    </div>
                    ${selectedEnrollments.map((enrollment) => {
                      const record = getAttendanceRecord(enrollment.student.id);
                      const status = record?.estado || "absent";
                      const studentAttendanceSummary = summarizeAttendance(
                        attendance.filter(
                          (item) =>
                            item.materia_id === selectedCourseId &&
                            item.alumno_id === enrollment.student.id
                        )
                      );

                      return html`
                        <div className="attendance-row" key=${enrollment.id}>
                          <span className="attendance-name">${studentFullName(enrollment.student)}</span>
                          <span className=${`status-pill ${STATUS_CLASS[status] || "amber"}`}>
                            ${STATUS_LABELS[status]}
                          </span>
                          <button
                            type="button"
                            className=${`attendance-cell ${status}`}
                            disabled=${busyKey === `attendance:${enrollment.student.id}`}
                            onClick=${() => handleToggleAttendance(enrollment.student.id)}
                          >
                            ${busyKey === `attendance:${enrollment.student.id}` ? "Guardando..." : "Un clic"}
                          </button>
                          <span className="teacher-note">
                            ${studentAttendanceSummary.present} P · ${studentAttendanceSummary.late} T · ${studentAttendanceSummary.absent} A
                          </span>
                          <button
                            type="button"
                            className="teacher-btn ghost compact"
                            onClick=${() => setSelectedStudentId(enrollment.student.id)}
                          >
                            Abrir alumno
                          </button>
                        </div>
                      `;
                    })}
                  </div>
                `
              : html`<div className="empty-card">Necesitás una materia con alumnos inscriptos para poder tomar asistencia.</div>`}
          </section>`
            : null}

          ${teacherSection === "my-courses"
            ? html`<section className="teacher-panel span-2">
            <div className="grades-toolbar">
              <div>
                <p className="teacher-kicker">Calificaciones</p>
                <h3>Tabla dinámica con promedio automático</h3>
              </div>
              <div className="toolbar-actions">
                <div className="teacher-note">
                  Las columnas salen de las evaluaciones que crees para cada materia.
                </div>
                <button
                  type="button"
                  className="teacher-btn ghost compact"
                  disabled=${busyKey === "export-grades"}
                  onClick=${exportGradesToSheet}
                >
                  ${busyKey === "export-grades" ? "Exportando..." : "Exportar notas"}
                </button>
              </div>
            </div>
            ${selectedCourse
              ? html`
                  <form className="teacher-form inline-form" onSubmit=${handleEvaluationSubmit}>
                    <label>
                      <span>Evaluación</span>
                      <input
                        value=${evaluationForm.nombre}
                        onInput=${(event) => setEvaluationForm({ ...evaluationForm, nombre: event.target.value })}
                        placeholder="Ej: Parcial 1"
                      />
                    </label>
                    <label>
                      <span>Tipo</span>
                      <select
                        value=${evaluationForm.tipo}
                        onChange=${(event) => setEvaluationForm({ ...evaluationForm, tipo: event.target.value })}
                      >
                        <option value="parcial">Parcial</option>
                        <option value="tp">Trabajo práctico</option>
                        <option value="integrador">Integrador</option>
                        <option value="final">Final</option>
                        <option value="otro">Otro</option>
                      </select>
                    </label>
                    <label>
                      <span>Fecha</span>
                      <input
                        type="date"
                        value=${evaluationForm.fecha}
                        onChange=${(event) => setEvaluationForm({ ...evaluationForm, fecha: event.target.value })}
                      />
                    </label>
                    <label>
                      <span>Puntaje máximo</span>
                      <input
                        type="number"
                        min="1"
                        step="0.5"
                        value=${evaluationForm.puntajeMaximo}
                        onInput=${(event) =>
                          setEvaluationForm({ ...evaluationForm, puntajeMaximo: event.target.value })
                        }
                      />
                    </label>
                    <button className="teacher-btn primary" type="submit" disabled=${busyKey === "evaluation"}>
                      ${busyKey === "evaluation" ? "Guardando..." : "Agregar columna"}
                    </button>
                  </form>

                  ${selectedEvaluations.length
                    ? html`
                        <div className="evaluation-list">
                          ${selectedEvaluations.map(
                            (evaluation) => html`
                              <article className="evaluation-card" key=${evaluation.id}>
                                <div>
                                  <strong>${evaluation.nombre}</strong>
                                  <div className="teacher-note">
                                    ${evaluation.tipo} · ${evaluation.fecha || "Sin fecha"} · Máx ${evaluation.puntaje_maximo}
                                  </div>
                                </div>
                                <div className="evaluation-actions">
                                  <button
                                    type="button"
                                    className="teacher-btn ghost compact"
                                    onClick=${() =>
                                      setEvaluationForm({
                                        id: evaluation.id,
                                        nombre: evaluation.nombre,
                                        tipo: evaluation.tipo,
                                        fecha: evaluation.fecha || "",
                                        puntajeMaximo: String(evaluation.puntaje_maximo || 10)
                                      })}
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    className="teacher-btn danger compact"
                                    disabled=${busyKey === `delete-evaluation:${evaluation.id}`}
                                    onClick=${() => handleDeleteEvaluation(evaluation.id)}
                                  >
                                    Borrar
                                  </button>
                                </div>
                              </article>
                            `
                          )}
                        </div>
                      `
                    : null}

                  ${selectedEvaluations.length && selectedEnrollments.length
                    ? html`
                        <div className="grades-table-wrap">
                          <table className="grades-table">
                            <thead>
                              <tr>
                                <th>Alumno</th>
                                ${selectedEvaluations.map(
                                  (evaluation) => html`<th key=${evaluation.id}>${evaluation.nombre}</th>`
                                )}
                                <th>Promedio</th>
                              </tr>
                            </thead>
                            <tbody>
                              ${selectedEnrollments.map((enrollment) => {
                                const values = selectedEvaluations
                                  .map((evaluation) => Number(getDisplayedGrade(evaluation.id, enrollment.student.id)))
                                  .filter((value) => Number.isFinite(value));
                                const average = averageOf(values);

                                return html`
                                  <tr key=${enrollment.id}>
                                    <td>${studentFullName(enrollment.student)}</td>
                                    ${selectedEvaluations.map((evaluation) => {
                                      const key = `${evaluation.id}:${enrollment.student.id}`;
                                      return html`
                                        <td key=${key}>
                                          <input
                                            className="grade-input"
                                            type="number"
                                            min="0"
                                            step="0.1"
                                            max=${String(evaluation.puntaje_maximo || 10)}
                                            value=${getDisplayedGrade(evaluation.id, enrollment.student.id)}
                                            onInput=${(event) =>
                                              setGradeDrafts((current) => ({
                                                ...current,
                                                [key]: event.target.value
                                              }))
                                            }
                                            onFocus=${() => setSelectedGradeKey(key)}
                                            onBlur=${() => persistGrade(evaluation.id, enrollment.student.id)}
                                          />
                                        </td>
                                      `;
                                    })}
                                    <td>
                                      <span className=${`average-chip ${gradeState(average)}`}>
                                        ${average === null ? "-" : average.toFixed(1)}
                                      </span>
                                    </td>
                                  </tr>
                                `;
                              })}
                            </tbody>
                          </table>
                        </div>
                      `
                    : html`<div className="empty-card">Creá al menos una evaluación y tené alumnos inscriptos para cargar notas.</div>`}

                  ${selectedGradeMeta
                    ? html`
                        <div className="comment-editor">
                          <div>
                            <p className="teacher-kicker">Comentario de nota</p>
                            <h4>${selectedGradeMeta.student.apellido}, ${selectedGradeMeta.student.nombre} · ${selectedGradeMeta.evaluation.nombre}</h4>
                          </div>
                          <textarea
                            rows="3"
                            value=${getDisplayedComment(selectedGradeMeta.evaluationId, selectedGradeMeta.studentId)}
                            onInput=${(event) =>
                              setGradeCommentDrafts((current) => ({
                                ...current,
                                [selectedGradeKey]: event.target.value
                              }))
                            }
                            placeholder="Observación de corrección, devolución o seguimiento"
                          ></textarea>
                          <div className="teacher-actions">
                            <button
                              type="button"
                              className="teacher-btn primary"
                              disabled=${busyKey === `grade:${selectedGradeKey}`}
                              onClick=${() => persistGrade(selectedGradeMeta.evaluationId, selectedGradeMeta.studentId)}
                            >
                              ${busyKey === `grade:${selectedGradeKey}` ? "Guardando..." : "Guardar comentario"}
                            </button>
                          </div>
                        </div>
                      `
                    : null}
                `
              : html`<div className="empty-card">Primero seleccioná una materia para definir sus evaluaciones.</div>`}
          </section>`
            : null}
        </section>
      </div>

      ${loading
        ? html`
            <section className="teacher-loading">
              Sincronizando datos docentes...
            </section>
          `
        : null}
    </div>
  `;
}

function TeacherDashboardRoot({ initialContext }) {
  const [context, setContext] = useState(initialContext || {});

  useEffect(() => {
    syncDashboardContext = (nextContext) => {
      setContext((current) => ({ ...current, ...nextContext }));
    };

    return () => {
      syncDashboardContext = null;
    };
  }, []);

  return html`<${TeacherDashboardApp} context=${context} />`;
}

function mountTeacherDashboard(target, initialContext = {}) {
  if (!target) return;
  if (!root) {
    root = createRoot(target);
  }
  root.render(html`<${TeacherDashboardRoot} initialContext=${initialContext} />`);
}

function updateTeacherDashboardSession(nextContext = {}) {
  if (typeof syncDashboardContext === "function") {
    syncDashboardContext(nextContext);
  }
}

window.mountTeacherDashboard = mountTeacherDashboard;
window.updateTeacherDashboardSession = updateTeacherDashboardSession;
window.dispatchEvent(new Event("teacher-dashboard-ready"));
