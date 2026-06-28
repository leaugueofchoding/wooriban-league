#!/usr/bin/env node
/**
 * MANTA_HEAL_AND_ARA_SUPPORT_PATCH_V6
 *
 * 목적
 * 1) 씨뿌리기/벚꽃해류/회복의 기도 사용 시 실제 회복량이 0이어도 회복 카드+테두리 표시
 * 2) 씨뿌리기/벚꽃해류 전투 이펙트에 자기 회복 연출 추가
 * 3) 아라만개 3스택 폭딜 배율 하향: 0/1/2/3스택 = 1 / 1.6 / 4.5 / 10
 *
 * 실행 위치: 프로젝트 루트(C:\Users\Zell-yeah\우리반리그)
 */
const fs = require('fs');
const path = require('path');

const PATCH_TAG = 'MANTA_HEAL_AND_ARA_SUPPORT_PATCH_V6';
const ROOT = process.cwd();
const BACKUP_DIR = path.join(ROOT, '.patch-backups');

const files = {
  petData: path.join(ROOT, 'src', 'features', 'pet', 'petData.js'),
  battleStatus: path.join(ROOT, 'src', 'features', 'battle', 'BattleStatusEffect.jsx'),
  battleSkillEffect: path.join(ROOT, 'src', 'features', 'battle', 'BattleSkillEffect.jsx'),
  battlePage: path.join(ROOT, 'src', 'features', 'battle', 'BattlePage.jsx'),
};

function assertFile(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`파일을 찾을 수 없습니다: ${path.relative(ROOT, file)}`);
  }
}

function read(file) {
  assertFile(file);
  return fs.readFileSync(file, 'utf8');
}

function backup(file) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const rel = path.relative(ROOT, file).replace(/[\\/]/g, '__');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `${rel}.${PATCH_TAG}.${stamp}.bak`);
  fs.copyFileSync(file, dest);
}

function writeIfChanged(file, before, after) {
  if (before === after) {
    console.log(`- 변경 없음: ${path.relative(ROOT, file)}`);
    return false;
  }
  backup(file);
  fs.writeFileSync(file, after, 'utf8');
  console.log(`✓ 수정 완료: ${path.relative(ROOT, file)}`);
  return true;
}

function findObjectBlock(src, key) {
  const keyIndex = src.indexOf(key);
  if (keyIndex < 0) return null;
  const braceStart = src.indexOf('{', keyIndex);
  if (braceStart < 0) return null;
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = braceStart; i < src.length; i += 1) {
    const ch = src[i];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return { start: keyIndex, bodyStart: braceStart, end: i + 1, block: src.slice(keyIndex, i + 1) };
      }
    }
  }
  return null;
}

function replaceSkillBlock(src, skillKey, transform) {
  const blockInfo = findObjectBlock(src, `${skillKey}:`);
  if (!blockInfo) {
    console.warn(`! ${skillKey} 블록을 찾지 못했습니다. 건너뜁니다.`);
    return src;
  }
  const nextBlock = transform(blockInfo.block);
  if (nextBlock === blockInfo.block) return src;
  return src.slice(0, blockInfo.start) + nextBlock + src.slice(blockInfo.end);
}

function insertBeforeLastReturnInSkillBlock(block, snippet, marker) {
  if (block.includes(marker)) return block;
  const lastReturn = block.lastIndexOf('return ');
  if (lastReturn < 0) return block;
  return block.slice(0, lastReturn) + snippet + '\n\n' + block.slice(lastReturn);
}

function patchPetData() {
  const file = files.petData;
  const before = read(file);
  let src = before;

  // 아라만개 배율 하향: 12배 → 10배, 중간 스택도 함께 조정
  if (/ARA_BLOOM_DAMAGE_MULTIPLIER_BY_MARK/.test(src)) {
    src = src.replace(
      /const\s+ARA_BLOOM_DAMAGE_MULTIPLIER_BY_MARK\s*=\s*\[[^\]]*\];/s,
      `const ARA_BLOOM_DAMAGE_MULTIPLIER_BY_MARK = [1.0, 1.6, 4.5, 10.0];`
    );
  } else {
    console.warn('! ARA_BLOOM_DAMAGE_MULTIPLIER_BY_MARK 상수를 찾지 못했습니다. 아라만개 배율은 건너뜁니다.');
  }

  // 회복 카드 상태를 스킬 사용 성공 경로에 강제 부여한다. 실제 HP가 가득 차서 0 회복이어도 표시한다.
  const makeHealStatusSnippet = (kind, labelComment) => `            // ${PATCH_TAG}: ${labelComment} 사용 시 실제 회복량이 0이어도 회복 카드/테두리를 1턴 표시\n            if (!attacker.status) attacker.status = {};\n            attacker.status.recentHeal = true;\n            attacker.status.recentHealTurns = 1;\n            attacker.status.recentHealKind = '${kind}';`;

  src = replaceSkillBlock(src, 'LEECH_SEED', (block) => {
    return insertBeforeLastReturnInSkillBlock(
      block,
      makeHealStatusSnippet('leechSeed', '씨뿌리기'),
      `recentHealKind = 'leechSeed'`
    );
  });

  src = replaceSkillBlock(src, 'BLOSSOM_CURRENT', (block) => {
    return insertBeforeLastReturnInSkillBlock(
      block,
      makeHealStatusSnippet('blossomCurrent', '벚꽃해류'),
      `recentHealKind = 'blossomCurrent'`
    );
  });

  // 공용 회복기도도 같은 카드 체계를 쓰게 해두면 회복류 UX가 일관된다.
  src = replaceSkillBlock(src, 'HEALING_PRAYER', (block) => {
    return insertBeforeLastReturnInSkillBlock(
      block,
      makeHealStatusSnippet('healingPrayer', '회복의 기도'),
      `recentHealKind = 'healingPrayer'`
    );
  });

  // 아라만개 설명 문구가 있으면 새 배율에 맞춰 느슨하게 교체
  src = replaceSkillBlock(src, 'ARA_BLOOM', (block) => {
    let next = block;
    next = next.replace(
      /description:\s*'[^']*'/,
      `description: '쌓인 물결표식을 터뜨려 큰 피해를 줍니다. 표식 1/2/3개일 때 피해가 각각 1.6배/4.5배/10배가 되며, 명중하면 표식이 사라집니다.'`
    );
    return next;
  });

  writeIfChanged(file, before, src);
}

function patchBattleStatusEffect() {
  const file = files.battleStatus;
  const before = read(file);
  let src = before;

  if (!src.includes('petStatus.recentHeal')) {
    const anchor = `    const waveMarkCount = Number(petStatus.waveMark ?? 0);`;
    const snippet = `    if (petStatus.recentHeal) {\n        const healKind = petStatus.recentHealKind || 'heal';\n        const healMeta = healKind === 'leechSeed'\n            ? { icon: '💚', label: '체력 흡수', detail: '회복 스킬 사용', tone: '#2f9e44' }\n            : healKind === 'blossomCurrent'\n                ? { icon: '🌸', label: '표식 회복', detail: '회복 해류 사용', tone: '#e64980' }\n                : { icon: '💖', label: '체력 회복', detail: '회복 스킬 사용', tone: '#e64980' };\n\n        statuses.push({\n            kind: 'recentHeal',\n            ...healMeta,\n        });\n    }\n\n`;
    if (src.includes(anchor)) {
      src = src.replace(anchor, snippet + anchor);
    } else {
      console.warn('! getBattleStatusList 삽입 위치를 찾지 못했습니다. recentHeal 카드는 건너뜁니다.');
    }
  }

  if (!src.includes('battleRecentHealPulse')) {
    const anchor = `          @keyframes battleAuraPulse {`;
    const snippet = `          @keyframes battleRecentHealPulse {\n            0%, 100% { transform: translate(-50%, -50%) scale(1); filter: brightness(1); }\n            45% { transform: translate(-50%, -53%) scale(1.08); filter: brightness(1.35); }\n          }\n\n`;
    if (src.includes(anchor)) {
      src = src.replace(anchor, snippet + anchor);
    }
  }

  if (!src.includes('.battleStatusAura--recentHeal')) {
    const anchor = `          .battleStatusAura--heal {`;
    const snippet = `          .battleStatusAura--recentHeal {\n            background:\n              radial-gradient(circle, rgba(255, 222, 235, 0.48) 0%, rgba(240, 101, 149, 0.18) 45%, rgba(230,73,128,0.03) 74%);\n            box-shadow:\n              0 0 26px rgba(240,101,149,0.48),\n              inset 0 0 24px rgba(255,222,235,0.38);\n            animation:\n              battleAuraPulse 0.45s ease-out forwards,\n              battleRecentHealPulse 0.8s ease-in-out infinite;\n          }\n\n          .battleStatusAura--recentHeal .battleStatusRing {\n            animation: battleRingSpin 4.6s linear infinite;\n          }\n\n          .battleStatusAura--recentHeal span {\n            filter:\n              drop-shadow(0 0 8px rgba(255,255,255,0.95))\n              drop-shadow(0 0 14px rgba(240,101,149,0.72));\n          }\n\n`;
    if (src.includes(anchor)) {
      src = src.replace(anchor, snippet + anchor);
    } else {
      src = src.replace(/\s*`\}\s*\n\s*<\/style>/, `\n${snippet}        ` + '`}\n' + `            </style>`);
    }
  }

  writeIfChanged(file, before, src);
}

function patchBattlePage() {
  const file = files.battlePage;
  const before = read(file);
  let src = before;

  if (!/recentHeal:\s*1/.test(src)) {
    src = src.replace(
      /(\s*aching:\s*2,\s*\n\s*};)/,
      `        aching: 2,\n        recentHeal: 1,\n    };`
    );
  }

  if (!/recentHeal:\s*'recentHealTurns'/.test(src)) {
    src = src.replace(
      /(\s*aching:\s*'achingTurns',\s*\n\s*};)/,
      `        aching: 'achingTurns',\n        recentHeal: 'recentHealTurns',\n    };`
    );
  }

  if (!src.includes("if (key === 'recentHeal')")) {
    const anchor = `        if (turnField) {\n            delete pet.status[turnField];\n        }`;
    const snippet = `        if (turnField) {\n            delete pet.status[turnField];\n        }\n\n        if (key === 'recentHeal') {\n            delete pet.status.recentHealKind;\n        }`;
    if (src.includes(anchor)) {
      src = src.replace(anchor, snippet);
    } else {
      console.warn('! clearBattleStatus에 recentHealKind 정리 코드를 넣지 못했습니다.');
    }
  }

  const oldListRegex = /\['burned',\s*'poisoned',\s*'bound',\s*'stunned',\s*'blind',\s*'dazzled',\s*'aching'\]/g;
  src = src.replace(oldListRegex, `['burned', 'poisoned', 'bound', 'stunned', 'blind', 'dazzled', 'aching', 'recentHeal']`);

  writeIfChanged(file, before, src);
}

function replaceSkillConfigLine(src, skillName, newLine) {
  const re = new RegExp(`\\n\\s*${skillName}:\\s*\\{[^\\n]*\\},`);
  if (re.test(src)) {
    return src.replace(re, `\n  ${newLine}`);
  }
  return src;
}

function patchBattleSkillEffect() {
  const file = files.battleSkillEffect;
  const before = read(file);
  let src = before;

  // 스킬 매핑: 실제 배틀에서도 공격+자기 회복 이펙트가 나오게 함
  src = replaceSkillConfigLine(
    src,
    'LEECH_SEED',
    `LEECH_SEED: { icon: '🌱', duration: '1.35s', type: 'LEECH_SEED_HEAL_MULTI' },`
  );

  if (/\n\s*BLOSSOM_CURRENT:\s*\{/.test(src)) {
    src = replaceSkillConfigLine(
      src,
      'BLOSSOM_CURRENT',
      `BLOSSOM_CURRENT: { icon: '🌸', duration: '1.45s', type: 'BLOSSOM_CURRENT_HEAL_MULTI' },`
    );
  } else {
    const waterAnchor = `  WATER_BALL: { icon: '💧', duration: '1.2s', type: 'PROJECTILE' },`;
    if (src.includes(waterAnchor)) {
      src = src.replace(
        waterAnchor,
        `${waterAnchor}\n  BLOSSOM_CURRENT: { icon: '🌸', duration: '1.45s', type: 'BLOSSOM_CURRENT_HEAL_MULTI' },`
      );
    }
  }

  if (!src.includes("config.type === 'LEECH_SEED_HEAL_MULTI'")) {
    const anchor = `  // ── 🐸 반격태세: 돌격 → X자 검기 교차 + 반격 오라`;
    const snippet = `  // ── 🌱 씨뿌리기: 씨앗 공격 후 자기 회복 연출\n  if (config.type === 'LEECH_SEED_HEAL_MULTI') {\n    return (\n      <EffectContainer $icon="" $duration="1.35s" $animType="PROJECTILE" $isMine={isMine} $glowColor="#40c057">\n        <MultiIcon $anim={isMine ? seedFly : seedFlyToMe} $duration="0.95s" $glow="#40c057" $size="3.8rem">🌱</MultiIcon>\n        <MultiIcon $anim={isMine ? seedFly : seedFlyToMe} $duration="0.9s" $glow="#69db7c" $size="2.8rem" $delay="0.08s">🍃</MultiIcon>\n        <MultiIcon $anim={buffSelf(isMine)} $duration="0.85s" $glow="#2f9e44" $size="3.4rem" $delay="0.48s">💚</MultiIcon>\n        <MultiIcon $anim={buffSelf(isMine)} $duration="0.75s" $glow="#b2f2bb" $size="2.5rem" $delay="0.62s">✨</MultiIcon>\n      </EffectContainer>\n    );\n  }\n\n  // ── 🌸 벚꽃해류: 해류 공격 후 자기 회복 연출\n  if (config.type === 'BLOSSOM_CURRENT_HEAL_MULTI') {\n    return (\n      <EffectContainer $icon="" $duration="1.45s" $animType="PROJECTILE" $isMine={isMine} $glowColor="#f783ac">\n        <MultiIcon $anim={isMine ? flyToOpponent : flyToMe} $duration="0.95s" $glow="#74c0fc" $size="3.7rem">🌊</MultiIcon>\n        <MultiIcon $anim={isMine ? flyToOpponent : flyToMe} $duration="0.9s" $glow="#f783ac" $size="3.0rem" $delay="0.12s">🌸</MultiIcon>\n        <MultiIcon $anim={buffSelf(isMine)} $duration="0.85s" $glow="#f783ac" $size="3.5rem" $delay="0.52s">💗</MultiIcon>\n        <MultiIcon $anim={buffSelf(isMine)} $duration="0.75s" $glow="#fcc2d7" $size="2.5rem" $delay="0.66s">🌸</MultiIcon>\n      </EffectContainer>\n    );\n  }\n\n`;

    if (src.includes(anchor)) {
      src = src.replace(anchor, snippet + anchor);
    } else {
      console.warn('! BattleSkillEffect 렌더 블록 삽입 위치를 찾지 못했습니다.');
    }
  }

  // glowMap에 새 타입 색상 추가
  if (!src.includes('LEECH_SEED_HEAL_MULTI')) {
    // 위쪽에서 이미 들어가야 하므로 일반적으로 도달하지 않음
  }
  if (!src.includes("LEECH_SEED_HEAL_MULTI: '#40c057'")) {
    const anchor = `    POISON: '#69db7c', SEED: '#69db7c', VINE: '#40c057', VINE_WHIP_MULTI: '#40c057', ARROW: '#69db7c',`;
    const replacement = `    POISON: '#69db7c', SEED: '#69db7c', LEECH_SEED_HEAL_MULTI: '#40c057', VINE: '#40c057', VINE_WHIP_MULTI: '#40c057', ARROW: '#69db7c',`;
    if (src.includes(anchor)) src = src.replace(anchor, replacement);
  }
  if (!src.includes("BLOSSOM_CURRENT_HEAL_MULTI: '#f783ac'")) {
    const anchor = `    WATER_BALL: '#4dabf7',`;
    const replacement = `    WATER_BALL: '#4dabf7',\n    BLOSSOM_CURRENT_HEAL_MULTI: '#f783ac',`;
    if (src.includes(anchor)) src = src.replace(anchor, replacement);
  }

  writeIfChanged(file, before, src);
}

function main() {
  console.log(`\n=== ${PATCH_TAG} 시작 ===\n`);
  Object.values(files).forEach(assertFile);

  patchPetData();
  patchBattleStatusEffect();
  patchBattlePage();
  patchBattleSkillEffect();

  console.log(`\n=== ${PATCH_TAG} 완료 ===\n`);
  console.log('다음 명령을 실행해 확인하세요:');
  console.log('  npm run build');
}

try {
  main();
} catch (error) {
  console.error('\nError:', error.message);
  process.exit(1);
}
