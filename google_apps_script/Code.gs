const DRIVE_FOLDER_ID = 'YOUR_DRIVE_FOLDER_ID';

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');

    if (payload.action === 'sync_academic_rows') {
      return handleAcademicSync_(payload);
    }

    const fileName = payload.fileName || `recibo-${Date.now()}.pdf`;
    const mimeType = payload.mimeType || 'application/pdf';
    const dataBase64 = payload.dataBase64 || '';

    if (!dataBase64) {
      return jsonResponse({ error: 'Falta dataBase64.' }, 400);
    }

    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const bytes = Utilities.base64Decode(dataBase64);
    const blob = Utilities.newBlob(bytes, mimeType, fileName);
    const file = folder.createFile(blob);

    const metadata = payload.metadata || {};
    const description = [
      `Recibo: ${metadata.punto_venta || ''}-${metadata.numero_recibo || ''}`,
      `Alumno: ${(metadata.apellido || '').trim()}, ${(metadata.nombre || '').trim()}`.trim(),
      `Concepto: ${metadata.concepto || ''}`,
      `Fecha: ${metadata.fecha || ''}`
    ].filter(Boolean).join('\n');

    file.setDescription(description);

    return jsonResponse({
      ok: true,
      fileId: file.getId(),
      url: file.getUrl(),
      name: file.getName()
    }, 200);
  } catch (error) {
    return jsonResponse({
      error: error && error.message ? error.message : 'No se pudo subir el archivo.'
    }, 500);
  }
}

function handleAcademicSync_(payload) {
  const spreadsheetId = payload.spreadsheetId || '';
  const sheetName = payload.sheetName || '';
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const replaceKey = payload.replaceKey || '';

  if (!spreadsheetId) {
    return jsonResponse({ error: 'Falta spreadsheetId.' }, 400);
  }

  if (!sheetName) {
    return jsonResponse({ error: 'Falta sheetName.' }, 400);
  }

  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheet = getOrCreateSheet_(spreadsheet, sheetName);
  const headers = buildHeaders_(rows);

  if (!headers.length) {
    return jsonResponse({ ok: true, written: 0, sheetName: sheetName }, 200);
  }

  ensureHeaderRow_(sheet, headers);
  replaceRowsByKey_(sheet, headers, replaceKey);

  if (rows.length) {
    const values = rows.map(function (row) {
      return headers.map(function (header) {
        return row[header] == null ? '' : row[header];
      });
    });

    sheet.getRange(sheet.getLastRow() + 1, 1, values.length, headers.length).setValues(values);
  }

  return jsonResponse({
    ok: true,
    sheetName: sheetName,
    written: rows.length
  }, 200);
}

function getOrCreateSheet_(spreadsheet, sheetName) {
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }
  return sheet;
}

function buildHeaders_(rows) {
  var keys = {};
  rows.forEach(function (row) {
    Object.keys(row || {}).forEach(function (key) {
      keys[key] = true;
    });
  });
  return Object.keys(keys);
}

function ensureHeaderRow_(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return;
  }

  var currentHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0];
  var normalizedCurrent = currentHeaders.filter(String);
  if (normalizedCurrent.join('|') !== headers.join('|')) {
    sheet.clearContents();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

function replaceRowsByKey_(sheet, headers, replaceKey) {
  if (!replaceKey || sheet.getLastRow() < 2) {
    return;
  }

  var keyIndex = headers.indexOf('sync_key');
  if (keyIndex === -1) {
    return;
  }

  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  for (var i = data.length - 1; i >= 0; i -= 1) {
    if (String(data[i][keyIndex] || '') === String(replaceKey)) {
      sheet.deleteRow(i + 2);
    }
  }
}

function jsonResponse(body, statusCode) {
  const output = ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);

  if (typeof output.setResponseCode === 'function') {
    output.setResponseCode(statusCode);
  }

  return output;
}
