import { italianProducts } from './italia-data.mjs';
export const seeds = italianProducts;
export const legacySeeds = [
  { id: 'italy', country: '義大利', creator: 'Lucia', region: '地中海 × 嶺南', title: '把家鄉的藍，帶到早晨的茶裡', story: '我來自義大利，祖母家的餐桌上有藍色手繪陶器。那些像海浪的線條，總讓我想起一家人一起吃飯。我想把這份日常記憶，和嶺南飲茶的生活方式結合。', craft: '佛山陶瓷與嶺南飲茶場景', productType: '陶瓷杯', audience: '喜歡設計與文化故事的城市青年', budget: 129, color: '#315C9B', art: 'cup', subtitle: '手繪陶器的個人記憶 × 日常茶器' },
  { id: 'morocco', country: '摩洛哥', creator: 'Amina', region: '北非 × 嶺南', title: '把街角的幾何，背進城市', story: '我記憶中的摩洛哥街角有明亮的幾何裝飾。我想用自己畫的幾何圖形，和廣東帆布工藝一起做一個耐用的日常包。圖案只是我的原創靈感，不代表任何認證傳統紋樣。', craft: '廣東帆布縫製與原創幾何印花', productType: '帆布袋', audience: '校園創作者與城市通勤者', budget: 99, color: '#B65A38', art: 'bag', subtitle: '街角幾何的原創演繹 × 隨身織物' },
  { id: 'mexico', country: '墨西哥', creator: 'Diego', region: '拉美 × 華南', title: '讓節日的剪影，照亮房間', story: '在我的成長記憶裡，彩色紙飾讓朋友相聚的日子更有氣氛。我希望用自己的植物剪影，搭配華南紙藝做一盞裝飾燈，讓小房間也有聚會的溫度。', craft: '華南紙藝與可替換燈罩', productType: '裝飾燈', audience: '喜歡裝飾宿舍與小家的年輕人', budget: 159, color: '#496448', art: 'lamp', subtitle: '相聚的紙藝記憶 × 溫暖光影' }
].map(seed => ({ ...seed, owner: '共创者', photo: ({ italy: '/images/mediterranean.jpg', morocco: '/images/north-africa.jpg', mexico: '/images/latin-america.jpg' })[seed.id], photoAlt: ({ italy: '地中海灵感参考：蓝白色杯器', morocco: '北非灵感参考：图案帆布袋陈列', mexico: '拉美灵感参考：蓝白色装饰杯器' })[seed.id] }));

export const agentDefinitions = [
  { id: 'culture', name: '文化整理', role: 'Culture Curator', description: '從個人故事整理元素，區分個人經驗與待考證的文化主張。', usesModel: true },
  { id: 'design', name: '展示策划', role: 'Presentation Planner', description: '保持原商品，准备中文展示结构和消费者访谈问题。', usesModel: true },
  { id: 'supply', name: '商品资料核对', role: 'Product Facts', description: '标出原产地、规格、配料或成分、标签和供应资料的缺项；未知项不填造价格或认证。', usesModel: false },
  { id: 'host', name: '真人敘事', role: 'Live Director', description: '準備中英開場與互動點子，將即興表達留給真人主播。', usesModel: true },
  { id: 'review', name: '發布前檢查', role: 'Review Gate', description: '標記來源、權利與成本狀態，要求創作者確認後才進入演示舞台。', usesModel: false }
];

export const pricing = {
  '陶瓷杯': { min: 32, max: 52, moq: 100, days: '14–21', materials: ['陶瓷坯體', '無鉛釉料（規格待檢測）', '紙質故事卡'] },
  '帆布袋': { min: 22, max: 38, moq: 100, days: '10–18', materials: ['棉帆布', '水性印花（規格待確認）', '可回收紙吊牌'] },
  '裝飾燈': { min: 48, max: 78, moq: 100, days: '21–30', materials: ['原創紙藝燈罩', '成品 LED 光源（規格待驗證）', '紙質故事卡'] }
};
