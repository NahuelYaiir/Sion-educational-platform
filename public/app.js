const receiptForm = document.getElementById("receiptForm");
const pointOfSaleInput = document.getElementById("pointOfSaleInput");
const receiptNumberInput = document.getElementById("receiptNumberInput");
const dateInput = document.getElementById("dateInput");
const firstNameInput = document.getElementById("firstNameInput");
const lastNameInput = document.getElementById("lastNameInput");
const dniInput = document.getElementById("dniInput");
const conceptInput = document.getElementById("conceptInput");
const amountInput = document.getElementById("amountInput");
const amountWordsInput = document.getElementById("amountWordsInput");
const accountHolderInput = document.getElementById("accountHolderInput");
const loadExampleBtn = document.getElementById("loadExampleBtn");
const clearBtn = document.getElementById("clearBtn");
const downloadPdfBtn = document.getElementById("downloadPdfBtn");
const refreshHistoryBtn = document.getElementById("refreshHistoryBtn");
const receiptSheet = document.getElementById("receiptSheet");
const appBanner = document.getElementById("appBanner");
const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const sessionLabel = document.getElementById("sessionLabel");
const authFeedback = document.getElementById("authFeedback");
const historyEmpty = document.getElementById("historyEmpty");
const historyList = document.getElementById("historyList");
const loginScreen = document.getElementById("loginScreen");
const appScreen = document.getElementById("appScreen");
const sessionLabelApp = document.getElementById("sessionLabelApp");
const tabReceiptsBtn = document.getElementById("tabReceiptsBtn");
const tabTeachersBtn = document.getElementById("tabTeachersBtn");
const receiptsTabPanel = document.getElementById("receiptsTabPanel");
const teachersTabPanel = document.getElementById("teachersTabPanel");
const teacherDashboardMount = document.getElementById("teacherDashboardMount");

const previewPointOfSale = document.getElementById("previewPointOfSale");
const previewReceiptNumber = document.getElementById("previewReceiptNumber");
const previewDay = document.getElementById("previewDay");
const previewMonth = document.getElementById("previewMonth");
const previewYear = document.getElementById("previewYear");
const previewFirstName = document.getElementById("previewFirstName");
const previewLastName = document.getElementById("previewLastName");
const previewDni = document.getElementById("previewDni");
const previewConcept = document.getElementById("previewConcept");
const previewAmount = document.getElementById("previewAmount");
const previewAmountWords = document.getElementById("previewAmountWords");
const previewAccountHolder = document.getElementById("previewAccountHolder");

let supabaseClient = null;
let currentUser = null;
let latestSavedReceipt = null;
let historyItems = [];
let currentAppTab = "receipts";
let teacherDashboardMounted = false;

const exampleData = {
  pointOfSale: "0001",
  receiptNumber: "0000070",
  date: "2026-02-25",
  firstName: "Nahuel",
  lastName: "Gullifa",
  dni: "",
  concept: "Bono contribucion",
  amount: "15000",
  amountWords: "quince mil",
  accountHolder: ""
};

function padNumber(value, length) {
  return String(value || "").replace(/\D/g, "").slice(0, length).padStart(length, "0");
}

function sanitizeFilePart(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-_áéíóúÁÉÍÓÚñÑ]/g, "");
}

function formatAmountNumber(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return "";
  return new Intl.NumberFormat("es-AR").format(amount);
}

function splitDateParts(value) {
  const safeValue = value || new Date().toISOString().slice(0, 10);
  const [year = "", month = "", day = ""] = safeValue.split("-");
  return { day, month, year };
}

function unitsToWords(value) {
  const units = [
    "",
    "uno",
    "dos",
    "tres",
    "cuatro",
    "cinco",
    "seis",
    "siete",
    "ocho",
    "nueve"
  ];
  return units[value] || "";
}

function tensToWords(value) {
  const specials = {
    10: "diez",
    11: "once",
    12: "doce",
    13: "trece",
    14: "catorce",
    15: "quince",
    16: "dieciseis",
    17: "diecisiete",
    18: "dieciocho",
    19: "diecinueve",
    20: "veinte",
    21: "veintiuno",
    22: "veintidos",
    23: "veintitres",
    24: "veinticuatro",
    25: "veinticinco",
    26: "veintiseis",
    27: "veintisiete",
    28: "veintiocho",
    29: "veintinueve"
  };

  if (specials[value]) return specials[value];
  if (value < 10) return unitsToWords(value);

  const tensMap = {
    30: "treinta",
    40: "cuarenta",
    50: "cincuenta",
    60: "sesenta",
    70: "setenta",
    80: "ochenta",
    90: "noventa"
  };

  const tens = Math.floor(value / 10) * 10;
  const units = value % 10;
  return units ? `${tensMap[tens]} y ${unitsToWords(units)}` : tensMap[tens];
}

function hundredsToWords(value) {
  if (value === 100) return "cien";
  if (value < 100) return tensToWords(value);

  const hundredsMap = {
    100: "ciento",
    200: "doscientos",
    300: "trescientos",
    400: "cuatrocientos",
    500: "quinientos",
    600: "seiscientos",
    700: "setecientos",
    800: "ochocientos",
    900: "novecientos"
  };

  const hundreds = Math.floor(value / 100) * 100;
  const remainder = value % 100;
  return remainder ? `${hundredsMap[hundreds]} ${tensToWords(remainder)}` : hundredsMap[hundreds];
}

function numberToSpanishWords(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount < 0) return "";
  if (amount === 0) return "cero";
  if (amount < 1000) return hundredsToWords(amount);

  if (amount < 1000000) {
    const thousands = Math.floor(amount / 1000);
    const remainder = amount % 1000;
    const thousandWords = thousands === 1 ? "mil" : `${hundredsToWords(thousands)} mil`;
    return remainder ? `${thousandWords} ${hundredsToWords(remainder)}` : thousandWords;
  }

  const millions = Math.floor(amount / 1000000);
  const remainder = amount % 1000000;
  const millionWords = millions === 1 ? "un millon" : `${numberToSpanishWords(millions)} millones`;
  return remainder ? `${millionWords} ${numberToSpanishWords(remainder)}` : millionWords;
}

function trimOrPlaceholder(value) {
  return value && value.trim() ? value.trim() : "\u00A0";
}

function setBanner(message, type = "") {
  appBanner.textContent = message || "";
  appBanner.className = `app-banner ${type}`.trim();
  appBanner.classList.toggle("hidden", !message);
}

function setAuthFeedback(message) {
  authFeedback.textContent = message || "";
}

function ensureSupabase() {
  const url = window.SION_SUPABASE_URL || "";
  const anonKey = window.SION_SUPABASE_ANON_KEY || "";

  if (!window.supabase?.createClient) {
    throw new Error("No cargó la librería de Supabase.");
  }

  if (!url || !anonKey || url.includes("TU-PROYECTO") || anonKey.includes("TU_PUBLISHABLE_KEY")) {
    throw new Error("Falta configurar public/env.js con la URL y la anon key de Supabase.");
  }

  if (!supabaseClient) {
    supabaseClient = window.supabase.createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  }

  return supabaseClient;
}

function getDriveUploadUrl() {
  return window.SION_DRIVE_UPLOAD_URL || "";
}

function updateSessionUi() {
  const label = currentUser?.email || "Iniciá sesión para entrar al sistema.";
  if (sessionLabel) {
    sessionLabel.textContent = label;
  }
  if (sessionLabelApp) {
    sessionLabelApp.textContent = currentUser?.email || "Sin sesión activa.";
  }
}

function getTeacherDashboardContext() {
  let client = null;
  try {
    client = ensureSupabase();
  } catch (_error) {
    client = null;
  }

  return {
    currentUser,
    supabase: client,
    notify: setBanner
  };
}

function syncTeacherDashboardSession() {
  if (window.updateTeacherDashboardSession) {
    window.updateTeacherDashboardSession(getTeacherDashboardContext());
  }
}

function ensureTeacherDashboardMounted() {
  if (teacherDashboardMounted || !teacherDashboardMount || !window.mountTeacherDashboard) return;
  window.mountTeacherDashboard(teacherDashboardMount, getTeacherDashboardContext());
  teacherDashboardMounted = true;
}

function switchAppTab(tab) {
  currentAppTab = tab;
  const isReceipts = tab === "receipts";
  if (receiptsTabPanel) receiptsTabPanel.classList.toggle("hidden", !isReceipts);
  if (teachersTabPanel) teachersTabPanel.classList.toggle("hidden", isReceipts);
  if (tabReceiptsBtn) tabReceiptsBtn.classList.toggle("active", isReceipts);
  if (tabTeachersBtn) tabTeachersBtn.classList.toggle("active", !isReceipts);
  if (!isReceipts) {
    ensureTeacherDashboardMounted();
  }
}

function showLoginScreen() {
  if (loginScreen) loginScreen.classList.remove("hidden");
  if (appScreen) appScreen.classList.add("hidden");
}

function showAppScreen() {
  if (loginScreen) loginScreen.classList.add("hidden");
  if (appScreen) appScreen.classList.remove("hidden");
  switchAppTab(currentAppTab);
}

function buildFileName() {
  const lastName = sanitizeFilePart(lastNameInput.value || "sin-apellido") || "sin-apellido";
  const receiptNumber = padNumber(receiptNumberInput.value, 8) || "00000000";
  return `${lastName}-${receiptNumber}.pdf`;
}

function collectReceiptPayload() {
  const { day, month, year } = splitDateParts(dateInput.value);
  const fullName = [firstNameInput.value.trim(), lastNameInput.value.trim()].filter(Boolean).join(" ").trim();

  return {
    user_id: currentUser?.id || null,
    fecha: dateInput.value || `${year}-${month}-${day}`,
    nombre_cliente: fullName || "Sin nombre",
    monto: Number(amountInput.value || 0),
    concepto: conceptInput.value.trim() || "",
    url_archivo: latestSavedReceipt?.url_archivo || null,
    punto_venta: padNumber(pointOfSaleInput.value, 4),
    numero_recibo: padNumber(receiptNumberInput.value, 8),
    nombre: firstNameInput.value.trim() || "",
    apellido: lastNameInput.value.trim() || "",
    dni: dniInput.value.trim() || "",
    importe_letra: (amountWordsInput.value.trim() || numberToSpanishWords(Number(amountInput.value || 0))).trim(),
    titular_cuenta: accountHolderInput.value.trim() || "",
    file_name: buildFileName(),
    drive_url: latestSavedReceipt?.drive_url || null
  };
}

function formatFullDate(value) {
  if (!value) return "-";
  const safe = value.includes("T") ? value : `${value}T12:00:00`;
  const date = new Date(safe);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function updatePreview() {
  const { day, month, year } = splitDateParts(dateInput.value);
  const amountWords = amountWordsInput.value.trim() || numberToSpanishWords(Number(amountInput.value || 0));

  previewPointOfSale.textContent = padNumber(pointOfSaleInput.value, 4);
  previewReceiptNumber.textContent = padNumber(receiptNumberInput.value, 8);
  previewDay.textContent = day || "00";
  previewMonth.textContent = month || "00";
  previewYear.textContent = year || "0000";
  previewFirstName.textContent = trimOrPlaceholder(firstNameInput.value);
  previewLastName.textContent = trimOrPlaceholder(lastNameInput.value);
  previewDni.textContent = trimOrPlaceholder(dniInput.value);
  previewConcept.textContent = trimOrPlaceholder(conceptInput.value);
  previewAmount.textContent = trimOrPlaceholder(formatAmountNumber(amountInput.value));
  previewAmountWords.textContent = trimOrPlaceholder(amountWords);
  previewAccountHolder.textContent = trimOrPlaceholder(accountHolderInput.value);
}

function applyData(data) {
  pointOfSaleInput.value = data.pointOfSale || "";
  receiptNumberInput.value = data.receiptNumber || "";
  dateInput.value = data.date || "";
  firstNameInput.value = data.firstName || "";
  lastNameInput.value = data.lastName || "";
  dniInput.value = data.dni || "";
  conceptInput.value = data.concept || "";
  amountInput.value = data.amount || "";
  amountWordsInput.value = data.amountWords || "";
  accountHolderInput.value = data.accountHolder || "";
  updatePreview();
}

async function generatePdfBlob() {
  const pdf = await buildReceiptPdf();
  return pdf.output("blob");
}

async function downloadPdf() {
  const filename = buildFileName();
  const pdf = await buildReceiptPdf();
  pdf.save(filename);
}

async function buildReceiptPdf() {
  if (!window.html2canvas || !window.jspdf?.jsPDF) {
    throw new Error("No se cargaron las librerías necesarias para exportar el PDF.");
  }

  const canvas = await window.html2canvas(receiptSheet, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false
  });

  const imageData = canvas.toDataURL("image/jpeg", 0.98);
  const padding = 24;
  const pdf = new window.jspdf.jsPDF({
    orientation: canvas.width >= canvas.height ? "landscape" : "portrait",
    unit: "px",
    format: [canvas.width + padding * 2, canvas.height + padding * 2]
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const maxWidth = pageWidth - padding * 2;
  const maxHeight = pageHeight - padding * 2;
  const scale = Math.min(maxWidth / canvas.width, maxHeight / canvas.height, 1);
  const renderWidth = Math.floor(canvas.width * scale);
  const renderHeight = Math.floor(canvas.height * scale);
  const offsetX = (pageWidth - renderWidth) / 2;
  const offsetY = (pageHeight - renderHeight) / 2;

  pdf.addImage(imageData, "JPEG", offsetX, offsetY, renderWidth, renderHeight);
  return pdf;
}

function renderHistory(items) {
  historyItems = items.slice();
  historyList.innerHTML = "";

  if (!currentUser) {
    historyEmpty.textContent = "Iniciá sesión para ver el historial.";
    return;
  }

  if (!items.length) {
    historyEmpty.textContent = "Todavía no hay recibos guardados.";
    return;
  }

  historyEmpty.textContent = "";

  for (const item of items) {
    const article = document.createElement("article");
    article.className = "history-item";
    article.innerHTML = `
      <div class="history-item-top">
        <div>
          <p class="history-title">${item.apellido || ""} ${item.nombre || ""}</p>
          <p class="history-subtitle">Recibo ${item.punto_venta || "0001"}-${item.numero_recibo || ""} · ${formatFullDate(item.fecha)}</p>
        </div>
        <div class="history-title">${formatAmountNumber(item.monto)}</div>
      </div>
      <div class="history-item-actions">
        <button type="button" class="mini-action" data-action="load" data-id="${item.id}">Cargar datos</button>
        ${item.drive_url ? `<a class="history-link" href="${item.drive_url}" target="_blank" rel="noreferrer">Abrir PDF</a>` : ""}
      </div>
    `;
    historyList.appendChild(article);
  }
}

async function loadHistory() {
  if (!currentUser) {
    renderHistory([]);
    return;
  }

  const client = ensureSupabase();
  const { data, error } = await client
    .from("recibos")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    throw new Error(error.message || "No pude cargar el historial.");
  }

  renderHistory(data || []);
}

async function persistReceipt({ silent = false } = {}) {
  if (!currentUser) {
    if (!silent) {
      setBanner("Iniciá sesión para guardar historial automático del recibo.", "warning");
    }
    return null;
  }

  const payload = collectReceiptPayload();
  if (!payload.fecha || !payload.apellido || !payload.nombre || !payload.concepto || !Number.isFinite(payload.monto) || payload.monto <= 0) {
    if (!silent) {
      setBanner("Completá fecha, nombre, apellido, concepto e importe antes de continuar.", "warning");
    }
    return null;
  }

  const client = ensureSupabase();

  try {
    const { data, error } = await client
      .from("recibos")
      .upsert(payload, { onConflict: "user_id,punto_venta,numero_recibo" })
      .select("*")
      .single();

    if (error) throw error;

    latestSavedReceipt = data;
    await loadHistory();
    if (!silent) {
      setBanner("Recibo guardado en el historial.", "success");
    }
    return data;
  } catch (error) {
    if (!silent) {
      setBanner(error.message || "No se pudo guardar el historial.", "error");
    }
    throw error;
  }
}

async function uploadPdfToDrive() {
  const uploadUrl = getDriveUploadUrl();
  if (!uploadUrl) {
    return false;
  }

  try {
    await persistReceipt({ silent: true });
    const blob = await generatePdfBlob();
    const fileName = buildFileName();
    const payload = collectReceiptPayload();
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = String(reader.result || "");
        resolve(result.split(",")[1] || "");
      };
      reader.onerror = () => reject(new Error("No pude serializar el PDF."));
      reader.readAsDataURL(blob);
    });

    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName,
        mimeType: "application/pdf",
        dataBase64: base64,
        metadata: payload
      })
    });

    if (!response.ok) {
      throw new Error(`Drive respondió con ${response.status}.`);
    }

    const result = await response.json().catch(() => ({}));
    const driveUrl = result.url || result.webViewLink || result.link || null;

    if (latestSavedReceipt?.id && driveUrl && currentUser) {
      const client = ensureSupabase();
      const { data, error } = await client
        .from("recibos")
        .update({ url_archivo: driveUrl, drive_url: driveUrl, file_name: fileName })
        .eq("id", latestSavedReceipt.id)
        .select("*")
        .single();

      if (!error && data) {
        latestSavedReceipt = data;
      }
    }

    await loadHistory();
    return true;
  } catch (error) {
    throw new Error(error.message || "No se pudo subir el PDF a Drive.");
  }
}

async function handleLogin(event) {
  event.preventDefault();
  setAuthFeedback("");

  try {
    const client = ensureSupabase();
    loginBtn.disabled = true;
    const { data, error } = await client.auth.signInWithPassword({
      email: emailInput.value.trim(),
      password: passwordInput.value
    });
    if (error) throw error;
    currentUser = data.user || null;
    updateSessionUi();
    syncTeacherDashboardSession();
    showAppScreen();
    await loadHistory();
    setBanner("Sesión iniciada correctamente.", "success");
  } catch (error) {
    setAuthFeedback(error.message || "No se pudo iniciar sesión.");
  } finally {
    loginBtn.disabled = false;
  }
}

async function handleLogout() {
  if (!supabaseClient) return;
  await supabaseClient.auth.signOut();
  currentUser = null;
  latestSavedReceipt = null;
  updateSessionUi();
  syncTeacherDashboardSession();
  showLoginScreen();
  renderHistory([]);
  setBanner("Sesión cerrada.", "success");
}

function loadReceiptIntoForm(id) {
  const receipt = historyItems.find((item) => String(item.id) === String(id));
  if (!receipt) return;

  applyData({
    pointOfSale: receipt.punto_venta || "0001",
    receiptNumber: receipt.numero_recibo || "00000000",
    date: receipt.fecha || "",
    firstName: receipt.nombre || "",
    lastName: receipt.apellido || "",
    dni: receipt.dni || "",
    concept: receipt.concepto || "",
    amount: receipt.monto || "",
    amountWords: receipt.importe_letra || "",
    accountHolder: receipt.titular_cuenta || ""
  });
  latestSavedReceipt = receipt;
  setBanner("Recibo cargado desde el historial.", "success");
}

async function boot() {
  updateSessionUi();
  updatePreview();

  try {
    const client = ensureSupabase();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    currentUser = data.session?.user || null;
    updateSessionUi();
    syncTeacherDashboardSession();
    if (currentUser) {
      showAppScreen();
    } else {
      showLoginScreen();
    }
    await loadHistory();
  } catch (error) {
    showLoginScreen();
    renderHistory([]);
    setBanner("Configurar Supabase habilita guardado, historial y Drive dentro del sistema.", "warning");
  }
}

receiptForm.addEventListener("input", updatePreview);
loginForm.addEventListener("submit", handleLogin);
loadExampleBtn.addEventListener("click", () => applyData(exampleData));
clearBtn.addEventListener("click", () => {
  receiptForm.reset();
  pointOfSaleInput.value = "0001";
  receiptNumberInput.value = "0000001";
  dateInput.value = new Date().toISOString().slice(0, 10);
  latestSavedReceipt = null;
  updatePreview();
});
downloadPdfBtn.addEventListener("click", async () => {
  downloadPdfBtn.disabled = true;
  try {
    await persistReceipt({ silent: true });
    const driveSynced = await uploadPdfToDrive().catch((error) => {
      setBanner(error.message || "No se pudo subir el PDF a Drive.", "error");
      return false;
    });
    await downloadPdf();
    setBanner(
      driveSynced
        ? "Recibo descargado, guardado en historial y subido a Drive."
        : "Recibo descargado y guardado en historial.",
      "success"
    );
  } catch (_error) {
    // If history save fails, still allow local download.
    await downloadPdf();
    setBanner("Recibo descargado localmente.", "warning");
  } finally {
    downloadPdfBtn.disabled = false;
  }
});
logoutBtn.addEventListener("click", handleLogout);
refreshHistoryBtn.addEventListener("click", async () => {
  try {
    await loadHistory();
    setBanner("Historial actualizado.", "success");
  } catch (error) {
    setBanner(error.message || "No se pudo actualizar el historial.", "error");
  }
});
historyList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action='load']");
  if (!button) return;
  loadReceiptIntoForm(button.dataset.id);
});
if (tabReceiptsBtn) {
  tabReceiptsBtn.addEventListener("click", () => switchAppTab("receipts"));
}
if (tabTeachersBtn) {
  tabTeachersBtn.addEventListener("click", () => switchAppTab("teachers"));
}
window.addEventListener("teacher-dashboard-ready", () => {
  if (currentAppTab === "teachers") {
    ensureTeacherDashboardMounted();
  }
});

applyData({
  ...exampleData,
  date: new Date().toISOString().slice(0, 10)
});

boot();
