# EcoMind Frontend

Aplicación React (Vite) que ofrece dashboard ESG, autenticación JWT, gestión de empresas, carga de indicadores y generación de reportes.

## Scripts

```bash
npm run dev      # Inicia el servidor de desarrollo (http://localhost:5173)
npm run build    # Compila la SPA para producción
npm run preview  # Sirve la versión compilada
```

## Integración con el backend

- El proxy de desarrollo redirige `/api` a `http://localhost:4000` (configurable en `vite.config.js`).
- Las funciones de `src/services/api.js` encapsulan las llamadas principales y adjuntan automáticamente el token JWT cuando el usuario inicia sesión.

## Características destacadas

- Flujo de registro e inicio de sesión con persistencia en `localStorage`.
- Panel ESG con métricas agregadas, alertas automáticas y gráficas (Recharts).
- Formulario CRUD de empresas con control de permisos por empresa asignada.
- Formularios por pilar (E, S, G) para cargar indicadores y sincronizarlos con la API.
- Generación de PDF ESG con un clic utilizando el endpoint `/api/reports/generate`.

## Estilos

- Se utiliza una hoja CSS ligera (`src/styles.css`) con un diseño inspirado en dashboards modernos y páginas de acceso diferenciadas.
- Puedes integrar TailwindCSS o MUI siguiendo las dependencias ya incluidas en `package.json`.
