import { listCustomIndicators } from '../repositories/customIndicatorRepository.js';
import { updateMapScore } from '../repositories/mapRepository.js';

export async function recalculateCompanyScore(companyId) {
  const indicators = await listCustomIndicators(companyId);
  const numericValues = indicators
    .map((indicator) => (typeof indicator.value === 'number' ? indicator.value : null))
    .filter((value) => value != null);

  if (numericValues.length === 0) {
    await updateMapScore(companyId, null);
    return null;
  }

  const sum = numericValues.reduce((acc, curr) => acc + curr, 0);
  const average = Number((sum / numericValues.length).toFixed(2));
  await updateMapScore(companyId, average);
  return average;
}
