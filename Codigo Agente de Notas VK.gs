// ====================================================================
// AGENTE DE NOTAS — Foto → Gemini clasifica → Calendar / Tasks / Sheets
// ====================================================================

// --- CONFIGURACIÓN (rellena estos 3 valores antes de ejecutar) ---
const DRIVE_FOLDER_ID = 'TU_ID_DE_CARPETA_DRIVE_NOTAS';       // Carpeta donde subes las fotos
const PROCESSED_FOLDER_ID = 'TU_ID_DE_CARPETA_DRIVE_PROCESADAS'; // Carpeta donde se mueven ya leídas
const SHEET_ID = 'TU_ID_DE_GOOGLE_SHEET';                     // Sheet para notas sueltas

// La API key de Gemini NO va aquí en texto plano — se guarda como
// Script Property (ver README, sección "Configuración").
const GEMINI_API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');

// Categorías reales de Calendar (para eventos con fecha/hora)
// Sustituye por los nombres EXACTOS de tus propios calendarios.
const CATEGORIAS_CALENDAR = [
  'Personal', 'Trabajo', 'Ocio', 'Salud', 'Finanzas'
];

// Listas reales de Tasks (para tareas sin fecha fija) — no tienen
// por qué coincidir con las de Calendar, son estructuras distintas.
// Sustituye por los nombres EXACTOS de tus propias listas de Tasks.
const CATEGORIAS_TASKS = [
  'Pendientes', 'Compra', 'Proyectos', 'Ideas'
];

// Se antepone a todo lo que crea el script (eventos, tareas, notas),
// para diferenciarlo a simple vista de lo que añades tú a mano.
// Cambia solo este emoji si quieres usar otro.
const MARCADOR_SCRIPT = '🤖 ';

// --- FUNCIÓN PRINCIPAL (esta es la que se ejecuta con el trigger) ---
function procesarNotas() {
  const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const processedFolder = DriveApp.getFolderById(PROCESSED_FOLDER_ID);
  const files = folder.getFiles();

  while (files.hasNext()) {
    const file = files.next();
    const tipo = file.getMimeType();
    if (tipo !== 'image/png' && tipo !== 'image/jpeg') continue;

    try {
      const items = analizarImagenConGemini(file);
      items.forEach(procesarItem);
      file.moveTo(processedFolder);
      Logger.log('Procesado: ' + file.getName() + ' (' + items.length + ' elementos)');
    } catch (e) {
      Logger.log('ERROR con ' + file.getName() + ': ' + e);
    }
  }
}

// --- Llama a Gemini con la imagen y pide clasificación en JSON ---
function analizarImagenConGemini(file) {
  const base64 = Utilities.base64Encode(file.getBlob().getBytes());
  const mimeType = file.getBlob().getContentType();

  const hoy = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const prompt =
    'Hoy es ' + hoy + '. Si una nota menciona una fecha sin año (ej. "15 octubre"), ' +
    'usa el año en curso, o el año siguiente si esa fecha ya pasó este año.\n\n' +
    'Eres un asistente que lee notas manuscritas en fotos. ' +
    'Extrae cada línea o elemento independiente de la nota (puede haber varios) ' +
    'y clasifícalo.\n' +
    'Para cada elemento decide "tipo":\n' +
    '- "evento" si menciona una fecha u hora concreta\n' +
    '- "tarea" si es una acción pendiente sin fecha fija (algo que se puede tachar al hacerlo)\n' +
    '- "nota" si es una idea, apunte o cosa a considerar, sin acción clara ni fecha\n\n' +
    'La "categoria" depende del tipo:\n' +
    '- Si tipo es "evento", elige EXACTAMENTE una de: ' + CATEGORIAS_CALENDAR.join(', ') + '.\n' +
    '- Si tipo es "tarea", elige EXACTAMENTE una de: ' + CATEGORIAS_TASKS.join(', ') + '.\n' +
    '- Si tipo es "nota", usa "General".\n\n' +
    'Devuelve SOLO un JSON válido, sin texto adicional ni explicación, con este formato exacto:\n' +
    '[{"texto": "...", "categoria": "...", "tipo": "evento|tarea|nota", "fecha": "YYYY-MM-DDTHH:mm" o null}]';

  const payload = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mimeType, data: base64 } }
      ]
    }]
  };

  const response = UrlFetchApp.fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=' + GEMINI_API_KEY,
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    }
  );

  const data = JSON.parse(response.getContentText());
  if (!data.candidates || !data.candidates[0]) {
    throw new Error('Respuesta de Gemini sin candidatos: ' + response.getContentText());
  }

  let text = data.candidates[0].content.parts[0].text;
  text = text.replace(/```json|```/g, '').trim();
  return JSON.parse(text);
}

// --- Decide a dónde va cada elemento clasificado ---
function procesarItem(item) {
  if (item.tipo === 'evento' && item.fecha) {
    crearEvento(item);
  } else if (item.tipo === 'tarea') {
    crearTarea(item);
  } else {
    crearNotaEnSheet(item);
  }
}

function crearEvento(item) {
  const todos = CalendarApp.getAllCalendars();

  // 1) Coincidencia exacta ignorando emoji/espacios delante del nombre
  //    (ej. "👤 Personal" sí iguala con categoría "Personal").
  //    Esto evita que "Personal" empareje por error con "Personal VK".
  let calendar = todos.find(function (cal) {
    const nombreLimpio = cal.getName().replace(/^[^\p{L}]+/u, '').trim();
    return nombreLimpio === item.categoria.trim();
  });

  // 2) Si no hay exacta, coincidencia parcial como último recurso
  if (!calendar) {
    calendar = todos.find(function (cal) {
      return cal.getName().indexOf(item.categoria) !== -1;
    });
  }

  calendar = calendar || CalendarApp.getDefaultCalendar();
  const inicio = new Date(item.fecha);
  const fin = new Date(inicio.getTime() + 60 * 60000); // 1 hora de duración por defecto
  calendar.createEvent(MARCADOR_SCRIPT + item.texto, inicio, fin);
}

function crearTarea(item) {
  // Requiere el servicio avanzado "Tasks API" activado (ver README)
  const listas = Tasks.Tasklists.list().items || [];
  let lista = listas.find(function (l) { return l.title === item.categoria; });
  if (!lista) {
    lista = Tasks.Tasklists.insert({ title: item.categoria });
  }
  Tasks.Tasks.insert({ title: MARCADOR_SCRIPT + item.texto }, lista.id);
}

function crearNotaEnSheet(item) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('Notas') || ss.insertSheet('Notas');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Fecha', 'Categoría', 'Nota']);
  }
  sheet.appendRow([new Date(), item.categoria, MARCADOR_SCRIPT + item.texto]);
}
