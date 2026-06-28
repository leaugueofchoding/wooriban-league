#!/usr/bin/env node
/**
 * MANTA_HEAL_STATUS_CARD_PATCH_V5
 *
 * - 씨뿌리기/벚꽃해류가 실제로 회복했을 때, 내 펫에게 1턴짜리 회복 상태 카드 + 테두리 오라를 표시합니다.
 * - v4의 회복 이펙트와 함께 쓰면: 공격 이펙트 + 회복 이펙트 + 다음 턴 카드/테두리까지 모두 보입니다.
 *
 * 프로젝트 루트에서 실행:
 *   node .\manta-heal-status-card-patch-v5.cjs
 */

const fs = require('fs');
const path = require('path');

const PATCH_TAG = 'MANTA_HEAL_STATUS_CARD_PATCH_V5';
const ROOT = process.cwd();

const files = {
  petData: path.join('src', 'features', 'pet', 'petData.js'),
  battleStatusEffect: path.join('src', 'features', 'battle', 'BattleStatusEffect.jsx'),
  battlePage: path.join('src', 'features', 'battle', 'BattlePage.jsx'),
};

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

function writeIfChanged(rel, before, after) {
  if (before === after) {
    console.log(`- 변경 없음: ${rel}`);
    return;
  }
  const abs = filePath(rel);
  backupFile(abs);
  fs.writeFileSync(abs, after, 'utf8');
  console.log(`✓ 수정 완료: ${rel}`);
}

function replaceRequired(text, regex, replacement, label) {
  if (!regex.test(text)) throw new Error(`패치 지점을 찾을 수 없습니다: ${label}`);
  return text.replace(regex, replacement);
}

function findObjectBlockEnd(content, objectStartIndex) {
  const openIndex = content.indexOf('{', objectStartIndex);
  if (openIndex < 0) throw new Error('객체 시작 중괄호를 찾을 수 없습니다.');

  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  let templateExprDepth = 0;

  for (let i = openIndex; i < content.length; i += 1) {
    const ch = content[i];
    const next = content[i + 1];

    if (lineComment) {
      if (ch === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === '*' && next === '/') {
        blockComment = false;
        i += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (quote === '`' && ch === '$' && next === '{') {
        templateExprDepth += 1;
        i += 1;
        continue;
      }
      if (quote === '`' && templateExprDepth > 0) {
        if (ch === '{') templateExprDepth += 1;
        if (ch === '}') templateExprDepth -= 1;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === '/' && next === '/') {
      lineComment = true;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      blockComment = true;
      i += 1;
      continue;
    }
    if (ch === '\'' || ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  throw new Error('객체 끝 중괄호를 찾을 수 없습니다.');
}

function getSkillBlockById(content, idValue, label) {
  const idIndex = content.indexOf(`id: '${idValue}'`);
  if (idIndex < 0) throw new Error(`스킬 id를 찾을 수 없습니다: ${label}`);

  const objectStartCandidates = [
    content.lastIndexOf('    ', idIndex),
    content.lastIndexOf('\n', idIndex) + 1,
  ];

  // 가장 가까운 "    KEY: {" 라인을 뒤에서 찾는다.
  const before = content.slice(0, idIndex);
  const match = /\n\s{4}[A-Z0-9_]+:\s*\{\s*$/m.exec(before.slice(Math.max(0, before.length - 400)));
  let start;
  if (match) {
    start = Math.max(0, before.length - 400) + match.index + 1;
  } else {
    // fallback: id 앞쪽에서 마지막 4칸 들여쓰기 객체 시작 탐색
    const fallbackMatch = [...before.matchAll(/\n\s{4}[A-Z0-9_]+:\s*\{/g)].pop();
    if (!fallbackMatch) throw new Error(`스킬 블록 시작을 찾을 수 없습니다: ${label}`);
    start = fallbackMatch.index + 1;
  }

  const end = findObjectBlockEnd(content, start);
  return { start, end, block: content.slice(start, end + 1) };
}

function replaceSkillBlock(content, idValue, patchFn, label) {
  const found = getSkillBlockById(content, idValue, label);
  const nextBlock = patchFn(found.block);
  return content.slice(0, found.start) + nextBlock + content.slice(found.end + 1);
}

function patchPetData() {
  const rel = files.petData;
  let text = readText(rel);
  const before = text;

  if (!text.includes('const markHealPulse =')) {
    const helper = `
const markHealPulse = (pet, kind = 'heal') => {
    if (!pet) return;
    if (!pet.status) pet.status = {};
    pet.status.healPulse = true;
    pet.status.healPulseKind = kind;
    pet.status.healPulseTurns = 1;
};
`;
    text = replaceRequired(
      text,
      /(const checkBlindMiss = \(attacker\) => \{[\s\S]*?\n\};\s*)/,
      `$1${helper}`,
      'markHealPulse helper after checkBlindMiss'
    );
  }

  text = replaceSkillBlock(text, 'leech_seed', (block) => {
    if (block.includes("markHealPulse(attacker, 'seed')")) return block;
    if (!block.includes('const attacker = attackerPlayer.pet')) {
      throw new Error('씨뿌리기 블록에서 attacker 선언을 찾을 수 없습니다.');
    }

    // 씨뿌리기는 실제 HP가 증가했을 때만 회복 카드/오라를 띄웁니다.
    return replaceRequired(
      block,
      /(attacker\.hp\s*=\s*Math\.min\(attacker\.maxHp,\s*attacker\.hp\s*\+\s*heal\);)/,
      `const beforeHealHp = Number(attacker.hp ?? 0);\n            $1\n            if (Number(attacker.hp ?? 0) > beforeHealHp) {\n                markHealPulse(attacker, 'seed');\n            }`,
      'LEECH_SEED heal pulse insertion'
    );
  }, 'LEECH_SEED');

  // 벚꽃해류는 v2/v3.2 형태 모두 처리합니다.
  if (text.includes("id: 'blossom_current'")) {
    text = replaceSkillBlock(text, 'blossom_current', (block) => {
      if (block.includes("markHealPulse(attacker, 'blossom')")) return block;

      const directHealRegex = /(attacker\.hp\s*=\s*Math\.min\(attacker\.maxHp,\s*Number\(attacker\.hp \?\? 0\)\s*\+\s*heal\);)/;
      const simpleHealRegex = /(attacker\.hp\s*=\s*Math\.min\(attacker\.maxHp,\s*attacker\.hp\s*\+\s*heal\);)/;
      const anyHealRegex = /(attacker\.hp\s*=\s*Math\.min\([^;]+\);)/;

      if (directHealRegex.test(block)) {
        return block.replace(directHealRegex, `const beforeHealHp = Number(attacker.hp ?? 0);\n                $1\n                if (Number(attacker.hp ?? 0) > beforeHealHp) {\n                    markHealPulse(attacker, 'blossom');\n                }`);
      }
      if (simpleHealRegex.test(block)) {
        return block.replace(simpleHealRegex, `const beforeHealHp = Number(attacker.hp ?? 0);\n                $1\n                if (Number(attacker.hp ?? 0) > beforeHealHp) {\n                    markHealPulse(attacker, 'blossom');\n                }`);
      }
      if (anyHealRegex.test(block)) {
        return block.replace(anyHealRegex, `const beforeHealHp = Number(attacker.hp ?? 0);\n                $1\n                if (Number(attacker.hp ?? 0) > beforeHealHp) {\n                    markHealPulse(attacker, 'blossom');\n                }`);
      }

      throw new Error('벚꽃해류 블록에서 회복 처리 구문을 찾을 수 없습니다.');
    }, 'BLOSSOM_CURRENT');
  } else {
    console.log('- BLOSSOM_CURRENT 없음: 벚꽃해류 회복 카드 패치는 건너뜀');
  }

  writeIfChanged(rel, before, text);
}

function patchBattleStatusEffect() {
  const rel = files.battleStatusEffect;
  let text = readText(rel);
  const before = text;

  if (!text.includes("kind: 'healPulse'")) {
    const healStatusBlock = `
    if (petStatus.healPulse) {
        const healKind = petStatus.healPulseKind || 'heal';
        const isSeedHeal = healKind === 'seed';
        const isBlossomHeal = healKind === 'blossom';
        statuses.push({
            kind: 'healPulse',
            icon: isSeedHeal ? '💚' : isBlossomHeal ? '🌸' : '💖',
            label: isSeedHeal ? '체력 흡수' : isBlossomHeal ? '표식 회복' : '회복',
            detail: isSeedHeal ? '준 피해 일부 회복' : isBlossomHeal ? '표식 +1 · 체력 회복' : '체력 회복',
            tone: isSeedHeal ? '#2f9e44' : isBlossomHeal ? '#f06595' : '#e64980',
        });
    }
`;
    text = replaceRequired(
      text,
      /(    if \(petStatus\.stunned\) \{[\s\S]*?\n    \}\n)/,
      `$1${healStatusBlock}`,
      'healPulse status list insertion'
    );
  }

  if (!text.includes('@keyframes battleHealPulseFloat')) {
    const keyframes = `
          @keyframes battleHealPulseFloat {
            0%, 100% { transform: translateY(0) scale(1); filter: brightness(1); }
            45% { transform: translateY(-5px) scale(1.16); filter: brightness(1.35); }
          }

          @keyframes battleHealPulseGlow {
            0%, 100% { box-shadow: 0 0 22px color-mix(in srgb, var(--status-tone) 42%, transparent), inset 0 0 18px color-mix(in srgb, var(--status-tone) 22%, transparent); }
            50% { box-shadow: 0 0 34px color-mix(in srgb, var(--status-tone) 66%, transparent), inset 0 0 26px color-mix(in srgb, var(--status-tone) 36%, transparent); }
          }
`;
    text = replaceRequired(
      text,
      /(          @keyframes battleWaveMarkBubble \{)/,
      `${keyframes}\n$1`,
      'healPulse keyframes insertion'
    );
  }

  if (!text.includes('.battleStatusAura--healPulse')) {
    const cssBlock = `
          .battleStatusAura--healPulse {
            background:
              radial-gradient(circle, color-mix(in srgb, var(--status-tone) 30%, transparent) 0%, color-mix(in srgb, var(--status-tone) 14%, transparent) 45%, transparent 74%);
            box-shadow:
              0 0 24px color-mix(in srgb, var(--status-tone) 48%, transparent),
              inset 0 0 22px color-mix(in srgb, var(--status-tone) 28%, transparent);
            animation:
              battleAuraPulse 0.45s ease-out forwards,
              battleHealPulseGlow 1.05s ease-in-out infinite;
          }

          .battleStatusAura--healPulse .battleStatusRing {
            animation: battleRingSpin 4.2s linear infinite;
          }

          .battleStatusAura--healPulse span {
            animation: battleHealPulseFloat 0.95s ease-in-out infinite;
            filter:
              drop-shadow(0 0 8px rgba(255,255,255,0.95))
              drop-shadow(0 0 12px color-mix(in srgb, var(--status-tone) 82%, transparent));
          }
`;
    text = replaceRequired(
      text,
      /(          \.battleStatusAura--waveMark \{)/,
      `${cssBlock}\n$1`,
      'healPulse aura css insertion'
    );
  }

  writeIfChanged(rel, before, text);
}

function patchBattlePage() {
  const rel = files.battlePage;
  let text = readText(rel);
  const before = text;

  if (!text.includes('healPulse: 1')) {
    text = replaceRequired(
      text,
      /(const BATTLE_STATUS_TURN_DEFAULTS = \{[\s\S]*?aching:\s*2,?)/,
      `$1\n        healPulse: 1,`,
      'BATTLE_STATUS_TURN_DEFAULTS.healPulse'
    );
  }

  if (!text.includes("healPulse: 'healPulseTurns'")) {
    text = replaceRequired(
      text,
      /(const BATTLE_STATUS_TURN_FIELDS = \{[\s\S]*?aching:\s*'achingTurns',?)/,
      `$1\n        healPulse: 'healPulseTurns',`,
      'BATTLE_STATUS_TURN_FIELDS.healPulse'
    );
  }

  if (!text.includes("delete pet.status.healPulseKind")) {
    text = replaceRequired(
      text,
      /(\s*delete pet\.status\[key\];\s*)/,
      `$1\n        if (key === 'healPulse') {\n            delete pet.status.healPulseKind;\n        }\n`,
      'clearBattleStatus.healPulseKind'
    );
  }

  text = text.replace(
    /\['burned', 'poisoned', 'bound', 'stunned', 'blind', 'dazzled', 'aching'\]/g,
    "['burned', 'poisoned', 'bound', 'stunned', 'blind', 'dazzled', 'aching', 'healPulse']"
  );

  writeIfChanged(rel, before, text);
}

function main() {
  console.log(`\n=== ${PATCH_TAG} 시작 ===\n`);
  patchPetData();
  patchBattleStatusEffect();
  patchBattlePage();
  console.log(`\n=== ${PATCH_TAG} 완료 ===\n`);
  console.log('다음 확인 명령을 권장합니다:');
  console.log('  npm run build');
  console.log('');
  console.log('적용 후 확인: 씨뿌리기/벚꽃해류 사용 뒤, 회복한 내 펫에게 1턴 동안 회복 카드와 테두리 오라가 표시됩니다.');
}

try {
  main();
} catch (error) {
  console.error(`\nError: ${error.message}`);
  process.exit(1);
}
