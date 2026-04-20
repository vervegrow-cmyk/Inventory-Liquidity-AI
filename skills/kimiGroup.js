import { kimiChat } from './kimiClient.js';
import { parseJson } from '../lib/utils.js';

/**
 * Given an array of identified products, ask Kimi to group them
 * by whether they represent the same physical item.
 */
export async function kimiGroupProducts(products) {
  const list = products
    .map((p, i) => `[${i}] 名称：${p.name}，类别：${p.category}，品牌：${p.brand}`)
    .join('\n');

  const text = await kimiChat({
    messages: [
      { role: 'system', content: '你是商品分类专家。只输出合法 JSON，不要任何解释文字。' },
      {
        role: 'user',
        content: `以下是对多张图片的商品识别结果。请判断哪些图片是同一件商品（同款产品的不同拍摄角度），将其归为同一组。

${list}

规则：
1. 名称高度相似 + 相同品牌/类别 → 同一组
2. 名称存在包含关系（如"粉色短发"和"粉色假发"）+ 相同类别 → 同一组
3. 明显不同商品 → 不同组
4. 每组取最准确、最完整的名称作为代表名

只输出 JSON，格式：
{"groups":[{"indices":[0,1],"name":"代表名","category":"类别","brand":"品牌"}]}`,
      },
    ],
  });

  const parsed = parseJson(text);
  if (!Array.isArray(parsed?.groups)) throw new Error('Invalid grouping response');
  return parsed.groups;
}
