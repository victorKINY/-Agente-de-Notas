# 🤖 Agente de Notas — Foto → IA → Calendar / Tasks / Sheets

Automatización gratuita con **Google Apps Script + Gemini** que lee una foto de una nota manuscrita, extrae cada línea, la clasifica (evento / tarea / nota) y la reparte sola en **Google Calendar**, **Google Tasks** o **Google Sheets** — sin instalar nada, sin coste, sincronizado en cualquier dispositivo con tu cuenta de Google.

## ✨ Qué hace

1. Subes una foto de una nota escrita a mano a una carpeta de Drive.
2. Gemini (visión) lee la imagen y extrae cada elemento independiente.
3. Clasifica cada elemento:
   - **Evento** (tiene fecha/hora) → se crea en el calendario correspondiente.
   - **Tarea** (acción pendiente sin fecha) → se añade a la lista de Tasks correspondiente.
   - **Nota** (idea suelta, sin acción clara) → se guarda en una fila de Google Sheets.
4. Todo lo que crea el script lleva un emoji 🤖 delante, para diferenciarlo de lo que añades a mano.
5. La foto se mueve a una carpeta "Procesadas" para no volver a leerla.

## 🧱 Arquitectura

```
Foto (Drive) → Apps Script + Gemini (clasifica) → Calendar / Tasks / Sheets
```

Corre en los servidores de Google (no en tu PC), mediante un disparador (trigger) que se ejecuta cada X minutos.

## 📋 Requisitos

- Cuenta de Google (gratuita)
- Clave de API de Gemini gratuita ([aistudio.google.com](https://aistudio.google.com))

## 🚀 Instalación paso a paso

### 1. Crear el proyecto en Apps Script
Ve a [script.google.com](https://script.google.com) → "Nuevo proyecto". Borra el código de ejemplo y pega el contenido de `Codigo.gs`.

### 2. Crear las carpetas de Drive
En [drive.google.com](https://drive.google.com), crea dos carpetas: una para las fotos de entrada (ej. "Notas") y otra para las ya procesadas (ej. "Procesadas"). Entra en cada una y copia su ID de la URL (`drive.google.com/drive/folders/AQUI_EL_ID`).

### 3. Crear la Google Sheet
Crea una hoja de cálculo nueva y vacía. Copia su ID de la URL (`docs.google.com/spreadsheets/d/AQUI_EL_ID/edit`). El script crea la pestaña "Notas" solo, no hace falta prepararla.

### 4. Rellenar los 3 IDs en el código
Sustituye `TU_ID_DE_CARPETA_DRIVE_NOTAS`, `TU_ID_DE_CARPETA_DRIVE_PROCESADAS` y `TU_ID_DE_GOOGLE_SHEET` por los IDs reales, entre comillas.

### 5. Ajustar tus categorías
Edita `CATEGORIAS_CALENDAR` con los nombres **exactos** de tus calendarios reales, y `CATEGORIAS_TASKS` con los nombres **exactos** de tus listas reales de Tasks. No hace falta que coincidan entre sí — son estructuras independientes.

### 6. Activar el servicio de Tasks
En el editor: **Servicios** (icono `+`) → busca **"Tasks API"** → Añadir.

### 7. Guardar tu clave de Gemini de forma segura
Genera tu clave gratuita en [aistudio.google.com](https://aistudio.google.com) (icono de llave 🔑 → "Create API key"). En Apps Script: icono del engranaje ⚙️ (Configuración del proyecto) → **Propiedades del script** → Añadir propiedad → nombre `GEMINI_API_KEY`, valor tu clave.

> ⚠️ La clave **nunca** va escrita directamente en el código — por eso se guarda como propiedad del script.

### 8. Probar manualmente
Sube una foto de prueba a la carpeta de entrada, selecciona la función `procesarNotas` en el desplegable, y pulsa ▶ Ejecutar. Acepta los permisos solicitados (Drive, Calendar, Tasks, Sheets — son necesarios para que el script pueda crear elementos en tu cuenta). Revisa el "Registro de ejecución" para confirmar que no hay errores.

### 9. Automatizar con un disparador
Icono del reloj ⏰ → "+ Añadir activador" → función `procesarNotas` → "Basado en tiempo" → "Temporizador de minutos" → cada 15 minutos → Guardar.

A partir de aquí, sube fotos cuando quieras y se procesan solas.

## 🔒 Seguridad

- La clave de Gemini se guarda como Script Property, nunca en el código.
- Los IDs de este repo son placeholders — sustitúyelos por los tuyos, nunca subas tus IDs reales a un repo público si te preocupa la exposición de recursos personales.
- Revisa los permisos solicitados: Drive, Calendar, Tasks y Sheets son los mínimos necesarios para el funcionamiento descrito.

## 🛠️ Personalización

- Cambia el emoji `MARCADOR_SCRIPT` por el que prefieras.
- Ajusta el intervalo del disparador según tu volumen de notas.
- El prompt de clasificación (dentro de `analizarImagenConGemini`) se puede afinar si tu letra o tus categorías necesitan más contexto.

## 🔄 Actualizar el script

Si cambias el código (`Codigo.gs`), no hace falta rehacer nada más:

1. Abre tu proyecto en [script.google.com](https://script.google.com).
2. Selecciona todo el contenido actual (Ctrl+A) y bórralo.
3. Pega la versión nueva del código.
4. Guarda (Ctrl+S).

El disparador (trigger) que ya tienes configurado sigue funcionando igual, no necesitas volver a crearlo — usa siempre la versión más reciente del código guardado.

## ❓ Problemas comunes

**Error `models/gemini-X no longer available`**
Google retira modelos antiguos de vez en cuando. Cambia el nombre del modelo en la URL dentro de `analizarImagenConGemini` por el que indique el propio mensaje de error.

**Error `503 UNAVAILABLE` / "high demand"**
Los servidores de Gemini están saturados en ese momento (pasa más en el nivel gratuito). Es temporal — espera un par de minutos y vuelve a ejecutar. La foto no se pierde: como el `try/catch` no mueve el archivo a "Procesadas" si falla, se reintenta sola en el siguiente ciclo del disparador.

**El evento/tarea cae en el calendario o lista equivocada**
Revisa que el nombre en `CATEGORIAS_CALENDAR` / `CATEGORIAS_TASKS` coincida EXACTAMENTE con el nombre real de tu calendario o lista (sensible a mayúsculas). Si un calendario tiene emoji delante del nombre (ej. "👤 Personal"), no hace falta incluirlo en la constante — el script ya lo ignora al comparar.

**El año de un evento sale mal (ej. pone 2024 en vez del año actual)**
El prompt ya incluye la fecha de hoy para que Gemini infiera el año correcto cuando la nota no lo especifica. Si sigue fallando, prueba a escribir la fecha completa en la nota (día, mes y año).

**Pide autorizar permisos cada vez que cambias algo**
Es normal la primera vez que ejecutas manualmente y la primera vez que activas el disparador — son dos autorizaciones distintas. Después de eso no debería volver a pedirlo salvo que cambies qué servicios usa el script (por ejemplo, si añades un nuevo servicio avanzado).

**Se duplica una tarea/evento**
Pasa si subes la MISMA foto dos veces a la carpeta de entrada — el script no sabe que ya la procesó, solo mira qué hay en la carpeta en ese momento. No subas fotos de prueba repetidas una vez esté en producción.

## 💡 Recomendaciones

- Revisa de vez en cuando el "Registro de ejecución" (o "Ejecuciones" en el panel del reloj) para detectar errores acumulados sin que te des cuenta.
- Si tu letra es complicada o tienes muchas categorías parecidas, prueba con una nota de prueba variada (evento + tarea + nota) antes de dejarlo en automático.
- No compartas tus IDs reales de Drive/Sheets en un repo público — usa placeholders como en este README.

## 📄 Licencia

Uso libre para proyectos personales. Sin garantías — revisa y adapta antes de usar con datos reales.
