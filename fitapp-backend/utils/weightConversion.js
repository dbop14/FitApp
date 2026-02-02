/**
 * Shared weight conversion for Google Fit and Fitbit.
 * Google Fit returns weight in kg; we convert to lbs with 2 decimal precision.
 * Fitbit: request Accept-Language en_US to get lbs directly (no conversion).
 */
const KG_TO_LBS = 2.20462;

/**
 * Convert kg to lbs with 2 decimal places (precise, no whole-number rounding).
 * @param {number} kg - Weight in kilograms
 * @returns {number|null} - Weight in lbs (2 decimals), or null if invalid
 */
function kgToLbs(kg) {
  if (kg == null || typeof kg !== 'number' || isNaN(kg) || kg <= 0) return null;
  return Math.round(kg * KG_TO_LBS * 100) / 100;
}

module.exports = { kgToLbs, KG_TO_LBS };
