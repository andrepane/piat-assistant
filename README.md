# PIAT Assistant

Aplicación web para mantener una ficha clínica longitudinal y generar PIAT con revisión humana.

## Modelo de datos v2

Cada paciente se guarda en `patients/{patientId}`. Los análisis se conservan en la subcolección
`patients/{patientId}/analyses/{analysisId}` para no mezclar el estado clínico del paciente con el
estado de procesamiento de la documentación.

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

`firestore.rules` protege cada paciente y sus análisis mediante el `userId` del usuario autenticado.
Las reglas deben desplegarse en el proyecto Firebase antes de probar el guardado del modelo v2:

```bash
firebase deploy --only firestore:rules
```

## Comprobaciones locales

```bash
npm install
npm run check
npm audit --omit=dev
```
