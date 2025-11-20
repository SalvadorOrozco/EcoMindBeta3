# EcoMind Backend

API REST construida con Express y SQL Server para gestionar indicadores ESG, generar reportes PDF y coordinar peticiones a la capa de IA.

## Scripts

```bash
npm run dev   # Ejecuta el servidor con nodemon
npm start     # Ejecuta el servidor en modo producción
```

## Variables de entorno

| Variable | Descripción |
| -------- | ----------- |
| `PORT` | Puerto del servidor HTTP (por defecto 4000) |
| `SQL_SERVER` | Host o IP de SQL Server |
| `SQL_DATABASE` | Nombre de la base de datos |
| `SQL_USER` | Usuario SQL |
| `SQL_PASSWORD` | Contraseña del usuario SQL |
| `SQL_ENCRYPT` | `true` si se fuerza cifrado TLS |
| `SQL_TRUST_CERT` | `true` para certificados auto firmados |
| `JWT_SECRET` | Clave secreta para firmar los JWT de sesión |
| `JWT_EXPIRES_IN` | Tiempo de expiración de los tokens (ej. `12h`) |
| `GEMINI_API_KEY` | API Key de Gemini (Google GenAI) |
| `GEMINI_MODEL` | Modelo de Gemini a utilizar (opcional). Valores soportados: `gemini-1.5-flash` o `gemini-1.5-pro`. |
| `STORAGE_DRIVER` | `local`, `s3` o `cloudinary` para almacenar evidencias |
| `S3_BUCKET_NAME` | Bucket S3 (requerido si `STORAGE_DRIVER=s3`) |
| `AWS_REGION` | Región de AWS (requerido si `STORAGE_DRIVER=s3`) |
| `S3_PUBLIC_BASE_URL` | URL pública base opcional para evidencias en S3 |
| `CLOUDINARY_CLOUD_NAME` | Cloud name de Cloudinary (requerido si `STORAGE_DRIVER=cloudinary`) |
| `CLOUDINARY_API_KEY` | API key de Cloudinary |
| `CLOUDINARY_API_SECRET` | API secret de Cloudinary |

## Arquitectura

- `src/app.js`: configuración Express, middlewares y rutas.
- `src/config/`: conexión a SQL Server y variables de entorno.
- `src/repositories/`: acceso a datos para empresas, usuarios e indicadores.
- `src/controllers/`: lógica HTTP (empresas, métricas, evidencias, importación y autenticación).
- `src/routes/authRoutes.js`: endpoints `/api/auth/*` para registro, login y perfil.
- `src/services/aiService.js`: integración con Gemini (Google GenAI) con fallback sin clave.
- `src/services/pdfService.js`: generación de PDFs con PDFKit.
- `src/services/storageService.js`: almacenamiento de evidencias en disco, S3 o Cloudinary.
- `src/utils/importParser.js`: parseo de archivos Excel/CSV para carga masiva.

## Endpoints destacados

- `POST /api/metrics/import/preview`: recibe un Excel/CSV, valida y devuelve una vista previa sin persistir.
- `POST /api/metrics/import/confirm`: confirma la importación masiva usando los registros validados.
- `POST /api/evidencias`: adjunta archivos de soporte a un indicador (local, S3 o Cloudinary según configuración).
- `GET /api/evidencias`: lista evidencias filtradas por empresa, periodo y tipo de indicador.
- `DELETE /api/evidencias/:id`: elimina la evidencia del almacenamiento y la base.
- `GET /api/indicadores`: lista indicadores personalizados por empresa (según permisos).
- `POST /api/indicadores`: crea indicadores personalizados y recalcula el puntaje ESG.
- `DELETE /api/indicadores/:id`: elimina indicadores personalizados propios y actualiza el puntaje ESG.
- `GET /api/indicadores/historico/:empresaId`: resume energía, emisiones, inversión social y cumplimiento por periodo.
- `GET /api/map`: devuelve los marcadores del mapa de sostenibilidad con su puntaje ESG.
- `PUT /api/map/:empresaId`: actualiza coordenadas o puntaje manual de una empresa en el mapa.
- `GET /api/integraciones/energia` y `/api/integraciones/agua`: placeholders documentados para conectar SAP, PowerBI o IoT.

## Notas

- Asegúrate de ejecutar el script `database/schema.sql` antes de iniciar la API.
- Los usuarios deben autenticarse vía `/api/auth/login` para consumir las rutas protegidas.
- Si no configuras `GEMINI_API_KEY`, se generarán textos por defecto en los reportes.
- La integración con Gemini usa el SDK oficial `@google/genai` (endpoint `v1`) y reintenta automáticamente ante errores 400, 401, 404 o 429; si la clave es inválida o el modelo responde vacío, se activa el `buildFallbackSummary` y se registra el detalle en consola.
- El endpoint `/health` devuelve el estado básico del servicio.
- La carpeta `uploads/evidencias` se crea automáticamente en modo local; monta un bucket S3 o Cloudinary en producción.
- Para integrar datos externos (SAP, PowerBI, sensores) expón payloads hacia los endpoints de `/api/integraciones/*` y adapta los servicios correspondientes.
