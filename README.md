# 來物 LAIWU · 文化共創與真人測款

為海外文化品牌與中國共創者，把一段故事變成可講述、可試講、可復盤的測款提案。

本專案是牛客松 Wild Creation 的本機演示工程，当前版本 0.2.0。保留「文化共創＋真人直播」主线，按分角色业务流程 v1.1 增加品牌、文化方、供应商、主播和观众的合作工作台。

## 立即運行

需要 Node.js 22.9 以上；沒有第三方運行依賴，不需要 npm install 或模型密鑰。

```powershell
node server/index.mjs
```

瀏覽器打開 [本機演示](http://127.0.0.1:3100)。預設 `mock` 模式，只使用本地模板。停服按 Ctrl+C。

```powershell
# 自動讀取可選的 .env
node --env-file-if-exists=.env server/index.mjs

# 運行後端驗證
node --test tests/*.test.mjs
```

## 文件入口

- [本次分角色业务交付说明](docs/07-role-based-delivery.md)：附件映射、验收步骤、业务流程、版本、接口与后续范围。**团队验收先读这份。**

- [方向校正與商業驗證](docs/01-direction-and-business.md)：三把尺子、原文逐項處置、付費者、實驗與停損條件。
- [產品與交互設計](docs/02-product-and-interaction.md)：五個頁面、完整體驗、狀態與 3 小時分工。
- [架構、Agent 與模型接口](docs/03-architecture-and-api.md)：系統圖、模型作用圖、工作流、資料結構與接口契約。
- [原技術文檔審查與工程交接](docs/04-handoff-review.md)：已發現的 Schema 問題、實現邊界、測試與上線前增量。
- [三分鐘演示講稿](docs/05-demo-script.md)：可直接跟著操作的路演流程。
- [驗證記錄](docs/06-validation-results.md)：測試結果、瀏覽器走查與未驗證範圍。

## 已實現

1. 三個文化故事示例，原創 SVG 商品概念圖。
   首页地中海、北非、拉美灵感卡片使用团队提供的三张参考照片；生成提案保留概念插画。
2. 創作需求 → 五步協調工作流 → 文化/品牌/主播分范围签收 → 场次快照 → 本地真人舞台。
3. 中英文主播提詞卡、真人觸發的 3D 風格角色互動、可選本機鏡頭預覽。
4. 修訂前後對照、修改原因、負責人、版本重新確認、測款觀察與 Markdown 匯出。
5. 本機 JSON 持久化、可切換模型適配器、輸入與輸出驗證、錯誤停止。
6. 五角色工作台、动态待办、R0–R5 路径说明、随步骤出现的业务知识卡。
7. 询价规格版本、报价缺项检查、样品送验与返工演练。
8. 场次反馈窗口、旧版本反馈绑定、品牌下一轮决定与交接包导出。
9. 不依赖模型或网络的本机停止画面与特效按钮。

資料寫入 `.local/projects.json`，已加入 Git 忽略規則。浏览器保存最近项目 ID，标签页会话保存演示角色与工作视角。每個項目最多 100 次文字修訂、200 條觀察、500 次业务操作，全店最多 50 個項目；達到上限會停止新增，不會默默刪除既有反饋。

## 明確邊界

角色切换是本机流程演示，没有真实登录、组织权限或账号数据隔离。R0/R1 支持流程演练；R2–R5 仅资料准备。范围确认、报价和样品记录均不产生真实授权、采购或付款。

人物、文化故事、商品、成本、MOQ 與交期是演示資料。生成的「非遺」主張尚未查證。示意圖是程式繪製，並非 AI 生圖或打樣實拍。舞台沒有對外直播、支付、訂單、真人認證或數字人識別能力。文字挑戰只演示一次性驗證流程，不證明有人在場。測款觀察是手動輸入，不是自動採集的觀眾行為。

保存修訂是項目級記憶；沒有跨項目自動學習或微調。沒有接入真實模型密鑰，因此真實供應商網路連通性未驗證。

## 可選模型接入

複製 `.env.example` 為 `.env`，在本機編輯：

```dotenv
AI_PROVIDER=openai-compatible
AI_BASE_URL=https://你的服務商/相容接口根路徑
AI_MODEL=帳號可用且支援該接口的模型名
AI_API_KEY=只填在本機檔案
AI_RESPONSE_FORMAT=json_schema
AI_TOKEN_PARAMETER=max_completion_tokens
```

服務實際向 `AI_BASE_URL + /chat/completions` 發送請求。`AI_BASE_URL` 不應包含 `/chat/completions`。不同服務商對地區、模型名、JSON Schema、token 參數支援不同，參見架構文件。未配置完整會拒絕啟動；執行失敗會顯示錯誤，不會暗中降級成假模型結果。預設每次生成有三次模型呼叫，不發送鏡頭資料或觀眾身份。

## 目錄

```text
public/                 前台、五角色工作台、程式插画、舞台与复盘
public/work.js          角色任务、询价样品、签收场次、观众体验
server/business.mjs     业务状态、范围、版本、报价与场次规则
server/contracts.mjs    輸入驗證與模型輸出 Schema
server/data.mjs         清楚標記的虛構種子與估算規則
server/providers.mjs    Mock / OpenAI-compatible 適配器
server/workflow.mjs     Meta Agent 狀態機、修訂與觀察
server/presence.mjs     演示挑戰與主持模式聲明規則
server/storage.mjs      本機 JSON 持久化
server/index.mjs        本機 HTTP API 與靜態資源
tests/                  業務邊界、模型適配與 HTTP 整合驗證
docs/                   商業、產品、架構與路演交接
```

本機原型綁定 `127.0.0.1`。公開部署之前需要帳號與租戶授權、資料庫及備份、速率與費用控制、正式內容和商業流程審核。附帶商業建議均為待實地驗證的產品假設。
