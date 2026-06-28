#!/usr/bin/env node
/**
 * MANTA_HEAL_EFFECT_PATCH_V4
 *
 * - 씨뿌리기(LEECH_SEED): 실제 배틀 이펙트에 회복 연출 추가
 * - 벚꽃해류(BLOSSOM_CURRENT): 실제 배틀 이펙트에 회복 연출 강화
 *
 * 프로젝트 루트에서 실행:
 *   node .\manta-heal-effect-patch-v4.cjs
 */

const fs = require('fs');
const path = require('path');

const PATCH_TAG = 'MANTA_HEAL_EFFECT_PATCH_V4';
const ROOT = process.cwd();

function normalizeSlash(p) {
  return p.replace(/\\/g, '/');
}

function filePath(rel) {
  return path.join(ROOT, rel);
}

function backupFile(abs) {
  const rel = normalizeSlash(path.relative(ROOT, abs));
  const backupDir = path.join(ROOT, '.patch-backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safe = rel.replace(/[\\/]/g, '__');
  const backup = path.join(backupDir, `${safe}.${PATCH_TAG}.${stamp}.bak`);
  fs.copyFileSync(abs, backup);
  return backup;
}

function readText(rel) {
  const abs = filePath(rel);
  if (!fs.existsSync(abs)) throw new Error(`파일을 찾을 수 없습니다: ${rel}`);
  return fs.readFileSync(abs, 'utf8');
}

function writeText(rel, text) {
  const abs = filePath(rel);
  backupFile(abs);
  fs.writeFileSync(abs, text, 'utf8');
  console.log(`✓ 수정 완료: ${rel}`);
}

function replaceRegexOnce(text, regex, replacement, label) {
  if (!regex.test(text)) {
    throw new Error(`패치 지점을 찾을 수 없습니다: ${label}`);
  }
  return text.replace(regex, replacement);
}

function insertBeforeOnce(text, marker, insertion, label) {
  if (text.includes(insertion.trim().split('\n')[0])) return text;
  const idx = text.indexOf(marker);
  if (idx < 0) throw new Error(`패치 지점을 찾을 수 없습니다: ${label}`);
  return text.slice(0, idx) + insertion + '\n' + text.slice(idx);
}

function patchBattleSkillEffect() {
  const rel = 'src/features/battle/BattleSkillEffect.jsx';
  let text = readText(rel);

  if (text.includes('MANTA_HEAL_EFFECT_PATCH_V4_APPLIED')) {
    console.log(`- 이미 적용됨: ${rel}`);
    return;
  }

  // 1) LEECH_SEED는 기존 단일 씨앗 이펙트에서 "공격 + 회복" 복합 이펙트로 전환
  text = text.replace(
    /LEECH_SEED:\s*\{\s*icon:\s*['"`]🌱['"`],\s*duration:\s*['"`][^'"`]+['"`],\s*type:\s*['"`]SEED['"`]\s*\}/,
    "LEECH_SEED: { icon: '🌱', duration: '1.45s', type: 'SEED_HEAL_MULTI' }"
  );

  // 2) BLOSSOM_CURRENT가 이미 있으면 회복 강화 타입으로 변경, 없으면 WATER_BALL 뒤에 추가
  if (/BLOSSOM_CURRENT:\s*\{/.test(text)) {
    text = text.replace(
      /BLOSSOM_CURRENT:\s*\{\s*icon:\s*['"`][^'"`]*['"`],\s*duration:\s*['"`][^'"`]+['"`],\s*type:\s*['"`][^'"`]+['"`]\s*\}/,
      "BLOSSOM_CURRENT: { icon: '🌸', duration: '1.65s', type: 'BLOSSOM_CURRENT_HEAL_MULTI' }"
    );
  } else {
    text = replaceRegexOnce(
      text,
      /(WATER_BALL:\s*\{[^\n]*\},\s*\n)/,
      `$1  BLOSSOM_CURRENT: { icon: '🌸', duration: '1.65s', type: 'BLOSSOM_CURRENT_HEAL_MULTI' },\n`,
      'SKILL_CONFIG.BLOSSOM_CURRENT'
    );
  }

  // 3) 전용 keyframes 추가
  const keyframesBlock = `
// MANTA_HEAL_EFFECT_PATCH_V4_APPLIED
// 씨뿌리기/벚꽃해류 전투 회복 이펙트
const mantaHealSeedToOpponent = keyframes\`
  0%   { left: 18%; bottom: 18%; opacity: 0; transform: scale(0.35) rotate(-20deg); }
  15%  { opacity: 1; transform: scale(1.25) rotate(8deg); filter: drop-shadow(0 0 10px #8ce99a); }
  65%  { left: 65%; bottom: 66%; opacity: 1; transform: scale(1.0) rotate(22deg); filter: brightness(1.6) drop-shadow(0 0 14px #51cf66); }
  84%  { left: 70%; bottom: 70%; opacity: 1; transform: scale(2.0) rotate(0deg); filter: brightness(2.4) drop-shadow(0 0 20px #69db7c); }
  100% { left: 73%; bottom: 73%; opacity: 0; transform: scale(0.5); }
\`;

const mantaHealSeedToMe = keyframes\`
  0%   { right: 18%; top: 18%; opacity: 0; transform: scale(0.35) rotate(20deg); }
  15%  { opacity: 1; transform: scale(1.25) rotate(-8deg); filter: drop-shadow(0 0 10px #8ce99a); }
  65%  { right: 65%; top: 66%; opacity: 1; transform: scale(1.0) rotate(-22deg); filter: brightness(1.6) drop-shadow(0 0 14px #51cf66); }
  84%  { right: 70%; top: 70%; opacity: 1; transform: scale(2.0) rotate(0deg); filter: brightness(2.4) drop-shadow(0 0 20px #69db7c); }
  100% { right: 73%; top: 73%; opacity: 0; transform: scale(0.5); }
\`;

const mantaHealBlossomToOpponent = keyframes\`
  0%   { left: 18%; bottom: 18%; opacity: 0; transform: scale(0.35) rotate(0deg); }
  12%  { opacity: 1; transform: scale(1.3) rotate(-8deg); filter: drop-shadow(0 0 12px #74c0fc); }
  45%  { left: 50%; bottom: 52%; opacity: 1; transform: scale(1.6) rotate(12deg); filter: brightness(1.7) drop-shadow(0 0 16px #f783ac); }
  78%  { left: 68%; bottom: 70%; opacity: 1; transform: scale(2.1) rotate(-10deg); filter: brightness(2.3) drop-shadow(0 0 24px #74c0fc); }
  100% { left: 74%; bottom: 74%; opacity: 0; transform: scale(0.6); }
\`;

const mantaHealBlossomToMe = keyframes\`
  0%   { right: 18%; top: 18%; opacity: 0; transform: scale(0.35) rotate(0deg); }
  12%  { opacity: 1; transform: scale(1.3) rotate(8deg); filter: drop-shadow(0 0 12px #74c0fc); }
  45%  { right: 50%; top: 52%; opacity: 1; transform: scale(1.6) rotate(-12deg); filter: brightness(1.7) drop-shadow(0 0 16px #f783ac); }
  78%  { right: 68%; top: 70%; opacity: 1; transform: scale(2.1) rotate(10deg); filter: brightness(2.3) drop-shadow(0 0 24px #74c0fc); }
  100% { right: 74%; top: 74%; opacity: 0; transform: scale(0.6); }
\`;

const mantaHealRiseMine = keyframes\`
  0%   { left: 18%; bottom: 16%; opacity: 0; transform: scale(0.35) translateY(0); }
  20%  { opacity: 1; transform: scale(1.35) translateY(-6px); filter: brightness(1.8) drop-shadow(0 0 10px #f783ac); }
  62%  { opacity: 0.95; transform: scale(1.1) translateY(-34px); filter: brightness(2.1) drop-shadow(0 0 18px #ffdeeb); }
  100% { left: 18%; bottom: 30%; opacity: 0; transform: scale(0.45) translateY(-64px); }
\`;

const mantaHealRiseOpp = keyframes\`
  0%   { right: 18%; top: 16%; opacity: 0; transform: scale(0.35) translateY(0); }
  20%  { opacity: 1; transform: scale(1.35) translateY(6px); filter: brightness(1.8) drop-shadow(0 0 10px #f783ac); }
  62%  { opacity: 0.95; transform: scale(1.1) translateY(34px); filter: brightness(2.1) drop-shadow(0 0 18px #ffdeeb); }
  100% { right: 18%; top: 30%; opacity: 0; transform: scale(0.45) translateY(64px); }
\`;

const mantaGreenHealRiseMine = keyframes\`
  0%   { left: 18%; bottom: 16%; opacity: 0; transform: scale(0.35) translateY(0); }
  20%  { opacity: 1; transform: scale(1.35) translateY(-6px); filter: brightness(1.8) drop-shadow(0 0 10px #69db7c); }
  62%  { opacity: 0.95; transform: scale(1.1) translateY(-34px); filter: brightness(2.1) drop-shadow(0 0 18px #b2f2bb); }
  100% { left: 18%; bottom: 30%; opacity: 0; transform: scale(0.45) translateY(-64px); }
\`;

const mantaGreenHealRiseOpp = keyframes\`
  0%   { right: 18%; top: 16%; opacity: 0; transform: scale(0.35) translateY(0); }
  20%  { opacity: 1; transform: scale(1.35) translateY(6px); filter: brightness(1.8) drop-shadow(0 0 10px #69db7c); }
  62%  { opacity: 0.95; transform: scale(1.1) translateY(34px); filter: brightness(2.1) drop-shadow(0 0 18px #b2f2bb); }
  100% { right: 18%; top: 30%; opacity: 0; transform: scale(0.45) translateY(64px); }
\`;
`;

  // keyframes는 SKILL_CONFIG 바로 앞에 넣는다.
  text = insertBeforeOnce(
    text,
    '// ==========================================\n// 3. 스킬 → 아이콘/타입/지속시간 매핑',
    keyframesBlock,
    'heal keyframes before SKILL_CONFIG'
  );

  // 4) glowMap에 새 타입 색상 추가
  if (!text.includes("SEED_HEAL_MULTI: '#69db7c'")) {
    text = text.replace(
      /const glowMap = \{\s*\n/,
      "const glowMap = {\n    SEED_HEAL_MULTI: '#69db7c', BLOSSOM_CURRENT_HEAL_MULTI: '#f783ac',\n"
    );
  }

  // 5) 렌더 분기 추가. 기존 BLOSSOM_CURRENT_MULTI가 있어도 새 타입을 우선 사용.
  const renderBlock = `
  // ── 🌱 씨뿌리기: 피해 후 내 쪽으로 회복 이펙트
  if (config.type === 'SEED_HEAL_MULTI') {
    return (
      <EffectContainer $icon="" $duration="1.45s" $animType="PROJECTILE" $isMine={isMine} $glowColor="#69db7c">
        <MultiIcon
          $anim={isMine ? mantaHealSeedToOpponent : mantaHealSeedToMe}
          $duration="1.05s"
          $glow="#69db7c"
          $size="3.6rem"
        >🌱</MultiIcon>
        <MultiIcon
          $anim={isMine ? mantaGreenHealRiseMine : mantaGreenHealRiseOpp}
          $duration="0.95s"
          $delay="0.45s"
          $glow="#69db7c"
          $size="2.7rem"
        >💚</MultiIcon>
        <MultiIcon
          $anim={isMine ? mantaGreenHealRiseMine : mantaGreenHealRiseOpp}
          $duration="0.95s"
          $delay="0.58s"
          $glow="#b2f2bb"
          $size="2.1rem"
        >🍃</MultiIcon>
        <MultiIcon
          $anim={isMine ? mantaGreenHealRiseMine : mantaGreenHealRiseOpp}
          $duration="0.95s"
          $delay="0.72s"
          $glow="#8ce99a"
          $size="1.8rem"
        >✨</MultiIcon>
      </EffectContainer>
    );
  }

  // ── 🌸 벚꽃해류: 물결/꽃잎 공격 후 내 쪽으로 회복 이펙트
  if (config.type === 'BLOSSOM_CURRENT_HEAL_MULTI') {
    return (
      <EffectContainer $icon="" $duration="1.65s" $animType="PROJECTILE" $isMine={isMine} $glowColor="#f783ac">
        <MultiIcon
          $anim={isMine ? mantaHealBlossomToOpponent : mantaHealBlossomToMe}
          $duration="1.15s"
          $glow="#74c0fc"
          $size="3.8rem"
        >🌊</MultiIcon>
        <MultiIcon
          $anim={isMine ? mantaHealBlossomToOpponent : mantaHealBlossomToMe}
          $duration="1.15s"
          $delay="0.10s"
          $glow="#f783ac"
          $size="3.0rem"
        >🌸</MultiIcon>
        <MultiIcon
          $anim={isMine ? mantaHealRiseMine : mantaHealRiseOpp}
          $duration="1.0s"
          $delay="0.55s"
          $glow="#f783ac"
          $size="2.8rem"
        >💗</MultiIcon>
        <MultiIcon
          $anim={isMine ? mantaHealRiseMine : mantaHealRiseOpp}
          $duration="1.0s"
          $delay="0.68s"
          $glow="#ffdeeb"
          $size="2.2rem"
        >🌸</MultiIcon>
        <MultiIcon
          $anim={isMine ? mantaHealRiseMine : mantaHealRiseOpp}
          $duration="1.0s"
          $delay="0.82s"
          $glow="#fcc2d7"
          $size="1.9rem"
        >✨</MultiIcon>
      </EffectContainer>
    );
  }
`;

  text = insertBeforeOnce(
    text,
    '  // ── 🐸 반격태세',
    renderBlock,
    'heal render branches before COUNTER_STANCE_MULTI'
  );

  writeText(rel, text);
}

function main() {
  console.log(`\n=== ${PATCH_TAG} 시작 ===\n`);
  patchBattleSkillEffect();
  console.log(`\n=== ${PATCH_TAG} 완료 ===\n`);
  console.log('다음 확인 명령을 권장합니다:');
  console.log('  npm run build');
}

try {
  main();
} catch (error) {
  console.error(`\nError: ${error.message}`);
  process.exit(1);
}
