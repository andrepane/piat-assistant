# PIAT Assistant

Aplicación web para mantener una ficha clínica longitudinal y generar PIAT con revisión humana.

## Modelo de datos v2

Cada paciente se guarda en `patients/{patientId}` y utiliza subcolecciones con responsabilidades
separadas:

- `documents/{documentId}`: metadatos y estado del documento analizado;
- `analyses/{analysisId}`: extracción de Gemini y revisión de esa extracción;
- `revisions/{revisionId}`: cambios manuales posteriores de la ficha;
- `reports/{reportId}`: reservado para los futuros informes generados.

Los PDF se envían temporalmente al endpoint de análisis y no se almacenan en Firebase ni en
Vercel. Se conserva la extracción revisada, los metadatos necesarios y una huella SHA-256 para
identificar el archivo sin guardar su contenido. Los originales deben permanecer en el sistema
documental autorizado del centro.

Antes de cada envío, la aplicación muestra una revisión de privacidad obligatoria. El usuario debe
confirmar que la copia no contiene nombre, NH ni otros identificadores. El backend rechaza las
peticiones que no incluyan esa confirmación y el análisis conserva la fecha y la versión de la
revisión realizada. Esta barrera no anonimiza automáticamente el PDF ni sustituye su comprobación
manual.

Como ayuda adicional, el navegador extrae el texto mediante PDF.js y busca localmente el nombre y
NH conocidos, además de correos, DNI/NIE, teléfonos y etiquetas sensibles. Las coincidencias claras
bloquean el envío. Si el PDF es un escaneo o no contiene texto extraíble, la aplicación lo advierte y
exige igualmente la comprobación visual. El archivo no se envía a PDF.js ni a otro servidor durante
esta inspección: el análisis del texto ocurre en el navegador.

- Estados del paciente: `activo`, `alta`, `archivado`.
- Estados de análisis: `pendiente`, `procesando`, `revisado`, `error`.
- Estados de documento previstos: `subido`, `procesando`, `analizado`, `error`, `archivado`.

La creación inicial usa un lote de Firestore: el paciente y su primer análisis se guardan juntos o
no se guarda ninguno. Los registros antiguos continúan siendo legibles mediante campos de respaldo.

## Variables de entorno de Vercel

Configurar las variables indicadas en `.env.example`:

- `GEMINI_API_KEY`: secreto utilizado únicamente en `/api/analyze`.
- `FIREBASE_PROJECT_ID`: `piat-assistant`, salvo que se utilice otro proyecto.

El endpoint exige un ID token válido de Firebase Authentication y nunca recibe la contraseña del
usuario.

## Reglas de Firestore

`firestore.rules` protege cada paciente y sus subcolecciones mediante el `userId` autenticado. Las
reglas deben desplegarse antes de probar la gestión documental:

```bash
firebase deploy --only firestore:rules
```

## Comprobaciones locales

```bash
npm install
npm run check
npm audit --omit=dev
```
