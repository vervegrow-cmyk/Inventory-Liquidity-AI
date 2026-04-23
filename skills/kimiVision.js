import { openaiChat } from './openaiClient.js';
import { parseJson } from '../lib/utils.js';

/** Identify a product from a base64 image using vision model. */
export async function kimiVisionIdentify(imageBase64) {
  const text = await openaiChat({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: '你是商品识别专家。只返回合法 JSON，不要任何解释文字。' },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
          { type: 'text', text: '识别图片中的商品，返回 JSON 格式：{"name":"商品名称","category":"商品类别","brand":"品牌，不确定则填未知"}' },
        ],
      },
    ],
  });
  return normalizeResult(parseJson(text));
}

/** Identify a product from spreadsheet row text. */
export async function kimiTextIdentify(rowText) {
  const text = await openaiChat({
    messages: [
      { role: 'system', content: '你是商品识别专家。只返回合法 JSON，不要任何解释文字。' },
      { role: 'user', content: `以下是商品表格数据，识别商品信息，返回 JSON：{"name":"商品名称","category":"类别","brand":"品牌"}\n\n${rowText}` },
    ],
  });
  return normalizeResult(parseJson(text));
}

function normalizeResult(parsed) {
  return {
    name: parsed?.name || '未知商品',
    category: parsed?.category || '其他',
    brand: parsed?.brand || '未知',
  };
}
