export const ITALIA_EDITION = 'italia-originals';
export const italianProducts = [
  { id: 'pistachio', productType: '开心果酱', en: 'Pistachio pesto', original: 'Pesto con Pistacchio del Mediterraneo', image: 'italia-pistachio.jpg', color: '#858B49', title: '一抹开心果绿，打开餐桌的新话题', subtitle: '从包装与食用场景开始，听听深圳的第一印象', question: '你想怎样搭配它？你还需要知道哪些配料信息？', budget: 89 },
  { id: 'chocolate', productType: '意大利巧克力', en: 'Italian chocolate', original: 'Cioccolato', image: 'italia-chocolate.jpg', color: '#A84339', title: '把一颗巧克力，讲成一份心意', subtitle: '礼赠、分享或留给自己，先找到真实的选择理由', question: '哪种包装打动你？口味与过敏原信息是否清楚？', budget: 129 },
  { id: 'perfume', productType: '意大利香水', en: 'Italian perfume', original: 'Profumo', image: 'italia-perfume.jpg', color: '#BD9459', title: '香气还没抵达，故事先来相遇', subtitle: '先看瓶身与品牌叙事，闻香感受留给实际体验', question: '你从展示里读到什么气质？有机会闻香时想确认什么？', budget: 399 },
  { id: 'coffee', productType: '意大利咖啡', en: 'Italian coffee', original: 'La Regina dei Caffè', image: 'italia-coffee.jpg', color: '#983D35', title: '从一杯咖啡，聊到你的日常', subtitle: '早餐、通勤与朋友相聚，寻找适合的生活场景', question: '你会在什么场景喝它？希望了解哪种冲煮与风味信息？', budget: 99 }
].map(p => ({ ...p, edition: ITALIA_EDITION, productId: p.id, country: '意大利', creator: '来物 Italia', region: '意大利原产商品 · 资料待核对', craft: '保持原商品，准备中文展示与深圳消费者访谈', audience: '深圳成年消费者', story: `以${p.productType}的用户提供实拍为起点，测试包装吸引力、故事理解、实际体验与价格接受度。${p.question} 品牌合作、实际原产地与商品资料仍待确认。`, owner: '共创者', photo: `/images/${p.image}`, photoAlt: `${p.productType}参考实拍；不代表已建立品牌合作` }));

export const isItalia = p => p?.brief?.edition === ITALIA_EDITION;
export const feedbackDimensions = { packaging: '包装与设计', story: '故事理解', sensory: '感官与使用体验', price: '价格接受度' };
export const dossierFields = {
  brand: ['Brand / 品牌名称', 120], region: ['Specific region / 具体地区', 120], origin: ['Country of manufacture / 实际制造地', 120],
  specification: ['Variant & size / 规格与型号', 500], ingredients: ['Ingredients & relevant notes / 配料或成分与注意事项', 1000],
  evidence: ['Product evidence / 标签、品牌资料及来源依据', 1500], assetAuthor: ['Photo / story credit / 图片与故事作者', 120],
  italianOriginal: ['Italian original / 意大利语原文', 1500], englishSummary: ['English summary / 英文说明', 1500], chineseStory: ['Chinese presentation / 中文展示表述', 1500]
};
