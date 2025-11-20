import { z } from 'zod';

const coordinate = (min, max, message) =>
  z.preprocess((value) => {
    if (value === undefined || value === null) {
      return Number.NaN;
    }
    if (typeof value === 'number') {
      return value;
    }
    const trimmed = String(value).trim();
    if (trimmed === '') {
      return Number.NaN;
    }
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? Number.NaN : parsed;
  },
  z
    .number({ invalid_type_error: message })
    .min(min, { message })
    .max(max, { message })
    .refine((val) => !Number.isNaN(val) && isFinite(val), { message }));

const plantSchema = z.object({
  name: z
    .string({ required_error: 'El nombre de la planta es obligatorio' })
    .trim()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(120, 'El nombre no puede superar 120 caracteres'),
  latitude: coordinate(-90, 90, 'La latitud debe estar entre -90 y 90'),
  longitude: coordinate(-180, 180, 'La longitud debe estar entre -180 y 180'),
  location: z
    .string()
    .trim()
    .max(200, 'La ubicación no puede superar 200 caracteres')
    .optional()
    .or(z.literal('')),
  description: z
    .string()
    .trim()
    .max(255, 'La descripción no puede superar 255 caracteres')
    .optional()
    .or(z.literal('')),
});

export function validatePlantPayload(payload) {
  const parsed = plantSchema.parse(payload ?? {});
  return {
    name: parsed.name.trim(),
    latitude: parsed.latitude,
    longitude: parsed.longitude,
    location: parsed.location?.trim() ? parsed.location.trim() : undefined,
    description: parsed.description?.trim() ? parsed.description.trim() : undefined,
  };
}