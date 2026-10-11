import { randomInt, randomUUID } from 'node:crypto';
import { AppError } from './contracts.mjs';

export function createChallenge(projectId, now = Date.now()) {
  return { id: randomUUID(), projectId, phrase: `來物靈感 ${randomInt(1000, 10000)}`, expiresAt: now + 60000, used: false, attempts: 0 };
}

export function verifyChallenge(challenge, projectId, answer, now = Date.now()) {
  if (!challenge || challenge.projectId !== projectId) throw new AppError('CHALLENGE_NOT_FOUND', '請先領取互動挑戰', 404);
  if (challenge.used) throw new AppError('CHALLENGE_USED', '挑戰已使用，請重新領取', 409);
  if (now >= challenge.expiresAt) throw new AppError('CHALLENGE_EXPIRED', '挑戰已過期，請重新領取', 410);
  challenge.attempts += 1;
  if (challenge.attempts >= 3) challenge.used = true;
  if (typeof answer !== 'string' || answer.trim() !== challenge.phrase) throw new AppError('CHALLENGE_MISMATCH', '內容不匹配，最多可嘗試三次', 422);
  challenge.used = true;
  return { status: 'demo_interaction_completed', assurance: 'demo-only', message: '演示互動已完成；文字挑戰不能證明真人身分，也不能偵測數字人。', checkedAt: new Date(now).toISOString() };
}

export function assessDeclaration(input) {
  if (!['human', 'human_with_ai', 'unattended'].includes(input?.mode)) throw new AppError('INVALID_INPUT', '未知主持模式');
  return input.mode === 'unattended'
    ? { decision: 'not_eligible', label: '不符合真人專區入駐規則（聲明演示）', nextAction: '安排真人參與或申請人工覆核', evidence: '使用者選擇的主持模式，未分析音影片' }
    : { decision: 'review_required', label: '可申請真人專區，待人工確認', nextAction: input.mode === 'human_with_ai' ? '公開標示 AI 特效並完成真人參與覆核' : '完成真人參與覆核', evidence: '使用者選擇的主持模式，未分析音影片' };
}
