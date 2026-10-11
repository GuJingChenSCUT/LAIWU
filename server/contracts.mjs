import { ITALIA_EDITION, italianProducts } from './italia-data.mjs';

export class AppError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const text = { type: 'string', minLength: 1, maxLength: 1800 };
const texts = { type: 'array', items: text, minItems: 1, maxItems: 6 };
const object = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });

export const schemas = {
  culture: object({ origin: text, elements: texts, interpretation: text, cautions: texts }),
  design: object({ title: text, tagline: text, concept: text, materials: texts, palette: { type: 'array', items: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' }, minItems: 3, maxItems: 3 } }),
  host: object({ openingZh: text, openingEn: text, questions: texts, interaction: text })
};

// This validator deliberately supports only the JSON Schema subset used above.
export function validateSchema(value, schema, path = 'result') {
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AppError('MODEL_SCHEMA', `${path} 必須是物件`, 502);
    for (const key of schema.required) if (!(key in value)) throw new AppError('MODEL_SCHEMA', `${path}.${key} 缺失`, 502);
    for (const key of Object.keys(value)) if (!(key in schema.properties)) throw new AppError('MODEL_SCHEMA', `${path}.${key} 不是已定義字段`, 502);
    for (const [key, definition] of Object.entries(schema.properties)) validateSchema(value[key], definition, `${path}.${key}`);
  } else if (schema.type === 'array') {
    if (!Array.isArray(value) || value.length < schema.minItems || value.length > schema.maxItems) throw new AppError('MODEL_SCHEMA', `${path} 陣列長度不符`, 502);
    value.forEach((v, i) => validateSchema(v, schema.items, `${path}[${i}]`));
  } else if (schema.type === 'string') {
    if (typeof value !== 'string' || value.length < (schema.minLength ?? 0) || value.length > (schema.maxLength ?? 1800) || (schema.pattern && !new RegExp(schema.pattern).test(value))) throw new AppError('MODEL_SCHEMA', `${path} 文字格式不符`, 502);
  }
  return value;
}

export function validateBrief(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AppError('INVALID_INPUT', '請提供創作需求');
  const result = {};
  for (const [key, max] of Object.entries({ country: 40, story: 1500, craft: 80, audience: 100, productType: 20 })) {
    if (typeof input[key] !== 'string' || !input[key].trim() || input[key].length > max) throw new AppError('INVALID_INPUT', `${key} 必須有內容，且不超過 ${max} 字`);
    result[key] = input[key].trim();
  }
  // Preserve compatibility with earlier drafts without requiring personal ownership details.
  if (input.owner !== undefined && (typeof input.owner !== 'string' || input.owner.length > 60)) throw new AppError('INVALID_INPUT', '创作署名需为不超过 60 字的文字');
  result.owner = input.owner?.trim() || '共创者';
  if (input.edition === ITALIA_EDITION) {
    const product = italianProducts.find(p => p.id === input.productId && p.productType === result.productType);
    if (!product) throw new AppError('INVALID_INPUT', '请选择本轮四类意大利商品之一');
    result.edition = ITALIA_EDITION; result.productId = product.id; result.country = '意大利';
  } else if (!['陶瓷杯', '帆布袋', '裝飾燈'].includes(result.productType)) throw new AppError('INVALID_INPUT', '請選擇支援的商品類型');
  const price = input.targetRetailPrice ?? input.budget;
  const minPrice = result.edition ? 1 : 50, maxPrice = result.edition ? 5000 : 500;
  if (typeof price !== 'number' || !Number.isFinite(price) || price < minPrice || price > maxPrice) throw new AppError('INVALID_INPUT', `單件測試售價需為 ${minPrice}–${maxPrice} 元`);
  result.targetRetailPrice = price;
  result.budget = price; // Legacy adapter alias; this is not a project budget.
  return result;
}
