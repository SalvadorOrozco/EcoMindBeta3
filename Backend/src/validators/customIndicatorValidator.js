import { z } from 'zod';

const indicatorSchema = z.object({
  name: z
    .string({ required_error: 'El nombre es obligatorio' })
    .trim()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(120, 'El nombre no puede superar 120 caracteres'),
  plantId: z
    .preprocess((value) => {
      if (value === undefined || value === null || value === '') return null;
      const number = Number(value);
      return Number.isNaN(number) ? undefined : number;
    },
    z.union([
      z
        .number({ invalid_type_error: 'Selecciona una planta válida' })
        .int('Selecciona una planta válida')
        .positive('Selecciona una planta válida'),
      z.null(),
    ])),
  category: z.enum(['environmental', 'social', 'governance'], {
    errorMap: () => ({ message: 'Categoría inválida' }),
  }),
  value: z.coerce
    .number({ invalid_type_error: 'El valor debe ser numérico' })
    .min(0, 'El valor debe ser mayor o igual a 0')
    .max(100, 'El valor no puede superar 100'),
  period: z
    .preprocess(
      (value) => {
        if (value === undefined || value === null) return undefined;
        const trimmed = String(value).trim();
        return trimmed === '' ? undefined : trimmed;
      },
      z
        .string()
        .min(2, 'El periodo debe tener al menos 2 caracteres')
        .max(10, 'El periodo no puede superar 10 caracteres'),
    )
    .optional(),
  unit: z
    .preprocess(
      (value) => {
        if (value === undefined || value === null) return undefined;
        const trimmed = String(value).trim();
        return trimmed === '' ? undefined : trimmed;
      },
      z.string().max(20, 'La unidad no puede superar 20 caracteres'),
    )
    .optional(),
  description: z
    .preprocess(
      (value) => {
        if (value === undefined || value === null) return undefined;
        const trimmed = String(value).trim();
        return trimmed === '' ? undefined : trimmed;
      },
      z.string().max(255, 'La descripción no puede superar 255 caracteres'),
    )
    .optional(),
});

export function validateIndicatorPayload(payload) {
  return indicatorSchema.parse(payload);
}

// ✅ Versión corregida
const optionalNumber = (min, max, messageRange) =>
  z
    .preprocess((value) => {
      if (value === undefined) return undefined;
      if (value === null || value === '') return null;
      const number = Number(value);
      return Number.isNaN(number) ? undefined : number;
    }, z.union([
      z
        .number({ invalid_type_error: messageRange })
        .min(min, messageRange)
        .max(max, messageRange),
      z.null(),
    ]))
    .optional();

const mapUpdateSchema = z.object({
  latitude: optionalNumber(-90, 90, 'La latitud debe estar entre -90 y 90'),
  longitude: optionalNumber(-180, 180, 'La longitud debe estar entre -180 y 180'),
  esgScore: optionalNumber(0, 100, 'El puntaje ESG debe estar entre 0 y 100'),
});

export function validateMapUpdate(payload) {
  const parsed = mapUpdateSchema.parse(payload ?? {});
  return parsed;
}
