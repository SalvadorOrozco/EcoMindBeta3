import { withControllerErrorHandling } from '../utils/controllerErrorHandler.js';

async function energiaIntegrationHandler(req, res) {
  res.json({
    status: 'pending',
    message:
      'Endpoint reservado para integrar consumo energético desde sensores IoT o APIs (ej. medidores inteligentes, SAP PM).',
    nextSteps: [
      'Configurar credenciales de la fuente externa (API Key, OAuth, etc.).',
      'Mapear campos de respuesta a los indicadores ambientales de EcoMind.',
      'Programar tareas de ingesta periódica y conciliación de datos.',
    ],
  });
}

async function aguaIntegrationHandler(req, res) {
  res.json({
    status: 'pending',
    message:
      'Endpoint reservado para integrar mediciones de agua desde SCADA, telemetría o proveedores externos.',
    nextSteps: [
      'Definir formato de payload esperado (JSON, XML, CSV).',
      'Implementar autenticación segura (mTLS, tokens).',
      'Persistir lecturas históricas para análisis en PowerBI o tableros internos.',
    ],
  });
}

export const energiaIntegrationPlaceholder = withControllerErrorHandling(
  energiaIntegrationHandler,
  'integrationController.energiaIntegrationPlaceholder',
);
export const aguaIntegrationPlaceholder = withControllerErrorHandling(
  aguaIntegrationHandler,
  'integrationController.aguaIntegrationPlaceholder',
);
