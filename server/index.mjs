import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { AppError } from './contracts.mjs';
import { seeds, agentDefinitions } from './data.mjs';
import { createProvider } from './providers.mjs';
import { createProject, runWorkflow, approveProject, exportProject, recordCorrection, recordObservation, DEFAULT_STEP_DELAY_MS } from './workflow.mjs';
import { createStore } from './storage.mjs';
import { createChallenge, verifyChallenge, assessDeclaration } from './presence.mjs';
import { ensureBusiness, businessView, mutateBusiness, businessRoutes, knowledgeCards, demoRoles, rightsValid } from './business.mjs';

const publicDir = new URL('../public/', import.meta.url);
const allowedFiles = new Map([['/', ['index.html', 'text/html']], ['/index.html', ['index.html', 'text/html']], ['/app.js', ['app.js', 'text/javascript']], ['/work.js', ['work.js', 'text/javascript']], ['/styles.css', ['styles.css', 'text/css']], ['/work.css', ['work.css', 'text/css']]]);
for (const name of ['mediterranean', 'north-africa', 'latin-america']) allowedFiles.set(`/images/${name}.jpg`, [`images/${name}.jpg`, 'image/jpeg']);
allowedFiles.set('/images/mediterranean-blue.png', ['images/mediterranean-blue.png', 'image/png']);
const projectResponse = p => ({ ...p, business: businessView(p) });

async function readJson(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new AppError('CONTENT_TYPE', '請使用 application/json', 415);
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16384) throw new AppError('BODY_TOO_LARGE', '請求不可超過 16 KB', 413);
    chunks.push(chunk);
  }
  let input;
  try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new AppError('INVALID_JSON', 'JSON 格式錯誤'); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AppError('INVALID_INPUT', '請提供 JSON 物件');
  return input;
}

export function createApp({ provider = createProvider(), delayMs = DEFAULT_STEP_DELAY_MS, dataPath } = {}) {
  const store = createStore(dataPath);
  const { projects } = store;
  const challenges = new Map();
  let active = 0;
  const server = http.createServer(async (req, res) => {
    const requestId = randomUUID();
    const headers = {
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store',
      'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
    };
    function send(status, value, type = 'application/json') {
      res.writeHead(status, { ...headers, 'Content-Type': type.startsWith('image/') ? type : `${type}; charset=utf-8`, 'X-Request-Id': requestId });
      res.end(type === 'application/json' ? JSON.stringify(value) : value);
    }
    try {
      // Local-only demo: Host/Origin checking also prevents a third-party webpage spending a configured API key.
      const expectedHost = `127.0.0.1:${server.address()?.port}`;
      const localhost = `localhost:${server.address()?.port}`;
      if (![expectedHost, localhost].includes(req.headers.host)) throw new AppError('HOST_REJECTED', '本版本僅支援本機使用', 403);
      if (req.headers.origin && ![`http://${expectedHost}`, `http://${localhost}`].includes(req.headers.origin)) throw new AppError('ORIGIN_REJECTED', '來源不受允許', 403);
      const path = new URL(req.url, `http://${expectedHost}`).pathname;
      if (req.method === 'GET' && allowedFiles.has(path)) {
        const [name, type] = allowedFiles.get(path);
        return send(200, await readFile(new URL(name, publicDir)), type);
      }
      if (req.method === 'GET' && path === '/api/health') return send(200, { ok: true, mode: provider.mode, model: provider.model, persistence: dataPath ? 'local-json' : 'memory', version: '0.2.0' });
      if (req.method === 'GET' && path === '/api/catalog') return send(200, { seeds, agents: agentDefinitions, routes: businessRoutes, knowledge: knowledgeCards, roles: demoRoles, notice: '人物、故事、商品概念與供應數字為演示資料。靈感卡片照片由使用者提供，僅作視覺參考。' });
      if (req.method === 'POST' && path === '/api/projects') {
        if (active >= 3) throw new AppError('BUSY', '工作流忙碌中，請稍後重試', 429);
        const project = createProject(await readJson(req), provider.mode);
        ensureBusiness(project);
        if (projects.size >= 50) throw new AppError('LIMIT', '演示版最多保存 50 個項目；請先匯出並由開發者整理本機資料', 409);
        projects.set(project.id, project);
        store.save();
        active++;
        runWorkflow(project, provider, { delayMs, onProgress: () => store.save() }).then(() => store.save()).catch(() => {
          project.status = 'failed';
          project.error = { code: 'PERSIST_FAILED', message: '本機儲存失敗，請檢查工作目錄權限與磁碟空間' };
        }).finally(() => { active--; });
        return send(202, projectResponse(project));
      }
      if (req.method === 'POST' && path === '/api/presence/policy') return send(200, assessDeclaration(await readJson(req)));
      const match = path.match(/^\/api\/projects\/([a-f0-9-]{36})(?:\/(approve|export|challenge|verify|feedback|observations|business))?$/);
      if (match) {
        const project = projects.get(match[1]);
        if (!project) throw new AppError('NOT_FOUND', '草稿不存在或服務已重啟，請重新共創', 404);
        const action = match[2];
        if (req.method === 'GET' && !action) return send(200, projectResponse(project));
        if (req.method === 'POST' && action === 'business') {
          const input = await readJson(req);
          // Validate and persist a copy so a rejected write or disk failure cannot partly change live state.
          const updated = structuredClone(project);
          mutateBusiness(updated, input.action, input);
          projects.set(updated.id, updated);
          try { store.save(); } catch (error) { projects.set(project.id, project); throw error; }
          return send(200, projectResponse(updated));
        }
        if (req.method === 'GET' && action === 'export') {
          res.setHeader('Content-Disposition', 'attachment; filename="laiwu-concept.md"');
          return send(200, exportProject(project), 'text/markdown');
        }
        if (req.method === 'POST' && ['approve', 'feedback', 'observations'].includes(action)) {
          const input = await readJson(req);
          const update = { approve: approveProject, feedback: recordCorrection, observations: recordObservation }[action];
          const updated = structuredClone(project);
          if (action === 'feedback' && (input.expectedVersion !== ensureBusiness(updated).version || input.contentRevision !== updated.revision)) throw new AppError('VERSION_CONFLICT', '页面版本已变化，请刷新后修改', 409);
          update(updated, input);
          if (action === 'feedback') updated.business.version++;
          projects.set(updated.id, updated);
          try { store.save(); } catch (error) { projects.set(project.id, project); throw error; }
          if (action === 'feedback') for (const [id, c] of challenges) if (c.projectId === project.id) challenges.delete(id);
          return send(200, projectResponse(updated));
        }
        if (req.method === 'POST' && ['challenge', 'verify'].includes(action)) {
          const input = await readJson(req);
          if (project.status !== 'demo_ready' || !rightsValid(ensureBusiness(project))) throw new AppError('REVIEW_REQUIRED', '请先完成分角色确认并建立场次', 409);
          if (action === 'challenge') {
            for (const [id, c] of challenges) if (c.expiresAt <= Date.now() || c.projectId === project.id) challenges.delete(id);
            const challenge = createChallenge(project.id);
            challenges.set(challenge.id, challenge);
            return send(201, { id: challenge.id, phrase: challenge.phrase, expiresAt: challenge.expiresAt, assurance: 'demo-only' });
          }
          return send(200, verifyChallenge(challenges.get(input.challengeId), project.id, input.answer));
        }
      }
      throw new AppError('NOT_FOUND', '找不到此頁面或接口', 404);
    } catch (error) {
      const known = error instanceof AppError;
      send(known ? error.status : 500, { error: { code: known ? error.code : 'INTERNAL', message: known ? error.message : '服務暫時無法處理請求', requestId } });
    }
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.env.HOST && process.env.HOST !== '127.0.0.1') throw new AppError('CONFIG', '演示版 HOST 必須為 127.0.0.1；公開部署需先補齊鑑權與持久化', 500);
    const server = createApp({ dataPath: fileURLToPath(new URL('../.local/projects.json', import.meta.url)) });
    const port = Number(process.env.PORT || 3100);
    server.on('error', error => { console.error(`無法啟動：${error.code}`); process.exitCode = 1; });
    server.listen(port, '127.0.0.1', () => console.log(`來物 LAIWU → http://127.0.0.1:${server.address().port}  [${process.env.AI_PROVIDER || 'mock'}]`));
  } catch (error) {
    console.error(error instanceof AppError ? error.message : '啟動失敗');
    process.exitCode = 1;
  }
}
