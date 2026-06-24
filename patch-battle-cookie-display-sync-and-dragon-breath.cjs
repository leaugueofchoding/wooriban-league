#!/usr/bin/env node
/**
 * patch-battle-cookie-display-sync-and-dragon-breath.cjs
 *
 * 수정 1:
 * - 수락자 두뇌쿠키 사용 결과가 다음 턴에야 보이는 문제 보정
 * - battlePetUtils와 BattleTeamMiniBar에서 active pet 표시 시 participant.pet을 우선 반영
 *
 * 수정 2:
 * - 용의 숨결(FIERY_BREATH) 데미지 계수 하향
 * - 기존: basePower 55, skillMult 5.5, atkMult 1.2
 * - 변경: basePower 55, skillMult 1.45, atkMult 0.8
 *
 * 실행 위치: 프로젝트 루트
 * 실행 명령: node patch-battle-cookie-display-sync-and-dragon-breath.cjs
 */

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const battlePetUtilsPath = path.join(root, 'src', 'features', 'battle', 'battlePetUtils.js');
const miniBarPath = path.join(root, 'src', 'features', 'battle', 'BattleTeamMiniBar.jsx');
const petDataPath = path.join(root, 'src', 'features', 'pet', 'petData.js');

function fail(message) {
  console.error(`\n❌ ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`✅ ${message}`);
}

function backupFile(filePath, suffix) {
  const backupDir = path.join(root, '.patch-backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `${path.basename(filePath)}.${suffix}.${timestamp}.bak`);
  fs.writeFileSync(backupPath, fs.readFileSync(filePath, 'utf8'), 'utf8');
  return backupPath;
}

function replaceRegexRequired(source, regex, replacement, label) {
  if (!regex.test(source)) {
    fail(`${label} 위치를 찾지 못했습니다.`);
  }
  return source.replace(regex, replacement);
}

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) {
    fail(`${label} 위치를 찾지 못했습니다.`);
  }
  return source.replace(from, to);
}

for (const filePath of [battlePetUtilsPath, miniBarPath, petDataPath]) {
  if (!fs.existsSync(filePath)) {
    fail(`파일을 찾지 못했습니다: ${filePath}`);
  }
}

let utils = fs.readFileSync(battlePetUtilsPath, 'utf8');
let miniBar = fs.readFileSync(miniBarPath, 'utf8');
let petData = fs.readFileSync(petDataPath, 'utf8');

if (
  utils.includes('M4_COOKIE_DISPLAY_ACTIVE_PET_PREFER_PATCH') &&
  miniBar.includes('M4_COOKIE_DISPLAY_ACTIVE_PET_PREFER_PATCH') &&
  petData.includes('M4_DRAGON_BREATH_BALANCE_PATCH')
) {
  console.log('ℹ️ 이미 두뇌쿠키 표시 동기화 + 용의 숨결 밸런스 패치가 적용되어 있습니다.');
  process.exit(0);
}

const backupUtils = backupFile(battlePetUtilsPath, 'cookie-display-sync');
const backupMiniBar = backupFile(miniBarPath, 'cookie-display-sync');
const backupPetData = backupFile(petDataPath, 'dragon-breath-balance');
ok(`백업 생성: ${path.relative(root, backupUtils)}`);
ok(`백업 생성: ${path.relative(root, backupMiniBar)}`);
ok(`백업 생성: ${path.relative(root, backupPetData)}`);

// ============================================================================
// 1. battlePetUtils.js: active pet은 participant.pet을 우선 반영
// ============================================================================

if (!utils.includes('M4_COOKIE_DISPLAY_ACTIVE_PET_PREFER_PATCH')) {
  const newGetActiveBattlePet = `export const getActiveBattlePet = (participant) => {
    // M4_COOKIE_DISPLAY_ACTIVE_PET_PREFER_PATCH
    // 전투 중 즉시 갱신되는 현재 펫 스냅샷은 participant.pet입니다.
    // team[activePetIndex]가 한 박자 늦게 갱신되는 경우에도 화면은 최신 pet을 우선 표시해야 합니다.
    const team = getBattleTeam(participant);
    if (team.length === 0 && !participant?.pet) return null;

    const activeIndex = getActiveBattlePetIndex(participant);
    const activeFromTeam = team[activeIndex] || team[0] || null;
    const activeId = participant?.activePetId || activeFromTeam?.id || null;

    if (participant?.pet) {
        const currentPet = {
            ...participant.pet,
            status: { ...(participant.pet.status || {}) },
        };

        if (!activeId || currentPet.id === activeId || currentPet.id === activeFromTeam?.id) {
            return currentPet;
        }
    }

    return activeFromTeam || participant?.pet || null;
};`;

  utils = replaceRegexRequired(
    utils,
    /export\s+const\s+getActiveBattlePet\s*=\s*\(participant\)\s*=>\s*\{[\s\S]*?\n\};/,
    newGetActiveBattlePet,
    'battlePetUtils getActiveBattlePet'
  );

  const newNormalize = `export const normalizeBattleParticipantForBattle = (participant) => {
    // M4_COOKIE_DISPLAY_ACTIVE_PET_PREFER_PATCH
    // pet과 team의 active slot을 표시 단계에서도 한 번 더 맞춰줍니다.
    if (!participant) return participant;

    const team = getBattleTeam(participant);
    const activePetIndex = getActiveBattlePetIndex(participant);
    const activePet = getActiveBattlePet(participant);

    if (!activePet) return participant;

    const syncedTeam = team.length > 0
        ? team.map((pet, index) => (
            index === activePetIndex
                ? { ...activePet, status: { ...(activePet.status || {}) } }
                : { ...pet, status: { ...(pet?.status || {}) } }
        ))
        : [{ ...activePet, status: { ...(activePet.status || {}) } }];

    return {
        ...participant,
        pet: { ...activePet, status: { ...(activePet.status || {}) } },
        team: syncedTeam,
        activePetIndex,
        activePetId: activePet.id || participant.activePetId || null,
    };
};`;

  utils = replaceRegexRequired(
    utils,
    /export\s+const\s+normalizeBattleParticipantForBattle\s*=\s*\(participant\)\s*=>\s*\{[\s\S]*?\n\};/,
    newNormalize,
    'battlePetUtils normalizeBattleParticipantForBattle'
  );

  fs.writeFileSync(battlePetUtilsPath, utils, 'utf8');
  ok('battlePetUtils active pet 표시 우선순위 보정');
} else {
  ok('battlePetUtils는 이미 보정됨');
}

// ============================================================================
// 2. BattleTeamMiniBar.jsx: 미니바도 info.pet을 active slot에 즉시 반영
// ============================================================================

if (!miniBar.includes('M4_COOKIE_DISPLAY_ACTIVE_PET_PREFER_PATCH')) {
  const newMiniGetBattleTeam = `const getBattleTeam = (info) => {
    // M4_COOKIE_DISPLAY_ACTIVE_PET_PREFER_PATCH
    // 미니바도 active slot에는 최신 info.pet 값을 덮어씌워 표시합니다.
    const rawTeam = Array.isArray(info?.team) && info.team.length > 0
        ? info.team
        : Array.isArray(info?.pets) && info.pets.length > 0
            ? info.pets
            : info?.pet
                ? [info.pet]
                : [];

    if (!info?.pet || rawTeam.length === 0) return rawTeam;

    const activeIndex = getActiveIndex(info, rawTeam);
    const activeId = info.activePetId || rawTeam[activeIndex]?.id || null;

    return rawTeam.map((pet, index) => {
        const isActiveSlot = index === activeIndex || (activeId && pet?.id === activeId);
        if (!isActiveSlot) return pet;

        return {
            ...pet,
            ...info.pet,
            status: { ...(info.pet.status || pet?.status || {}) },
        };
    });
};`;

  miniBar = replaceRegexRequired(
    miniBar,
    /const\s+getBattleTeam\s*=\s*\(info\)\s*=>\s*\{[\s\S]*?\n\};/,
    newMiniGetBattleTeam,
    'BattleTeamMiniBar getBattleTeam'
  );

  fs.writeFileSync(miniBarPath, miniBar, 'utf8');
  ok('BattleTeamMiniBar active slot 표시 동기화 보정');
} else {
  ok('BattleTeamMiniBar는 이미 보정됨');
}

// ============================================================================
// 3. petData.js: 용의 숨결 데미지 계수 하향
// ============================================================================

if (!petData.includes('M4_DRAGON_BREATH_BALANCE_PATCH')) {
  // 주석을 먼저 넣어 중복 적용 방지
  petData = replaceRequired(
    petData,
    `    FIERY_BREATH: {
        id: 'fiery_breath',`,
    `    // M4_DRAGON_BREATH_BALANCE_PATCH
    FIERY_BREATH: {
        id: 'fiery_breath',`,
    'FIERY_BREATH marker'
  );

  petData = replaceRequired(
    petData,
    `                SKILLS.FIERY_BREATH.element,
                5.5,
                1.2
            );`,
    `                SKILLS.FIERY_BREATH.element,
                1.45,
                0.8
            );`,
    'FIERY_BREATH damage multipliers'
  );

  petData = petData.replace(
    `description: '맹렬한 화염을 뿜어 엄청난 피해를 주지만, 반동으로 다음 턴 행동 불가 상태가 됩니다.',`,
    `description: '맹렬한 화염을 뿜어 강한 피해를 주지만, 반동으로 다음 턴 행동 불가 상태가 됩니다.',`
  );

  fs.writeFileSync(petDataPath, petData, 'utf8');
  ok('용의 숨결 데미지 계수 하향');
} else {
  ok('용의 숨결 밸런스는 이미 보정됨');
}

console.log('\n🎉 두뇌쿠키 표시 동기화 + 용의 숨결 밸런스 패치 완료');
console.log('\n다음 명령으로 확인하세요:\n');
console.log('  npm run dev\n');
console.log('확인할 것:');
console.log('  1. 수락자가 두뇌쿠키 사용 직후 HP/SP가 바로 보이는지');
console.log('  2. 신청자도 기존처럼 바로 반영되는지');
console.log('  3. 미니바의 active 펫 HP/SP도 즉시 바뀌는지');
console.log('  4. 다음 공격 때 SP가 뒤늦게 차는 현상이 사라졌는지');
console.log('  5. 1레벨 용의 숨결 데미지가 과도하게 높지 않은지');
console.log('  6. 용의 숨결은 여전히 반동(recharging)이 걸리는지\n');
console.log('되돌리고 싶으면 백업 파일을 복사해서 복원하세요:');
console.log(`  ${path.relative(root, backupUtils)}`);
console.log(`  ${path.relative(root, backupMiniBar)}`);
console.log(`  ${path.relative(root, backupPetData)}\n`);
