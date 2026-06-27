// patch-m20-title-effects-team-battle-fix.cjs
// M20: 다중 펫 배틀 칭호 효과 점검/보정
//
// 수정 내용:
// 1) createBattleParticipantSnapshot에서 battlePet에 적용된 시작 버프를 team active slot에도 반영
//    - 숨은 영웅(god_of_tidiness): HP 5% 실드
//    - 인기스타(popular_star): SP 20% 오버차지
// 2) 성실한 나무(diligent_tree) 회복이 숨은 영웅 실드 HP를 깎지 않도록 보정
//
// 변경 파일:
// - src/api/firebase.js
// - src/features/battle/BattlePage.jsx
//
// 실행 위치:
//   C:\Users\Zell-yeah\우리반리그
// 실행:
//   node .\patch-m20-title-effects-team-battle-fix.cjs

const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const firebasePath = path.join(projectRoot, 'src', 'api', 'firebase.js');
const battlePath = path.join(projectRoot, 'src', 'features', 'battle', 'BattlePage.jsx');

for (const filePath of [firebasePath, battlePath]) {
  if (!fs.existsSync(filePath)) {
    console.error('[실패] 파일을 찾을 수 없습니다:', filePath);
    console.error('현재 위치:', projectRoot);
    process.exit(1);
  }
}

const backupDir = path.join(projectRoot, '.patch-backups');
fs.mkdirSync(backupDir, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

const firebaseOriginal = fs.readFileSync(firebasePath, 'utf8');
const battleOriginal = fs.readFileSync(battlePath, 'utf8');
const firebaseEol = firebaseOriginal.includes('\r\n') ? '\r\n' : '\n';
const battleEol = battleOriginal.includes('\r\n') ? '\r\n' : '\n';

const firebaseBackup = path.join(backupDir, `firebase.before-m20-title-effects-team-battle.${timestamp}.js`);
const battleBackup = path.join(backupDir, `BattlePage.before-m20-title-effects-team-battle.${timestamp}.jsx`);
fs.writeFileSync(firebaseBackup, firebaseOriginal, 'utf8');
fs.writeFileSync(battleBackup, battleOriginal, 'utf8');

let firebase = firebaseOriginal.replace(/\r\n/g, '\n');
let battle = battleOriginal.replace(/\r\n/g, '\n');

function restoreAndFail(error) {
  fs.writeFileSync(firebasePath, firebaseOriginal, 'utf8');
  fs.writeFileSync(battlePath, battleOriginal, 'utf8');
  console.error(error.message || error);
  console.error('[복구] 패치 실패로 원본을 다시 복원했습니다.');
  console.error('firebase 백업:', firebaseBackup);
  console.error('BattlePage 백업:', battleBackup);
  process.exit(1);
}

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`[패치 실패] ${label} 위치를 찾지 못했습니다.`);
  }
  return source.replace(search, replacement);
}

try {
  if (firebase.includes('M20_TITLE_EFFECTS_TEAM_BATTLE_FIX') || battle.includes('M20_TITLE_EFFECTS_TEAM_BATTLE_FIX')) {
    console.log('[안내] 이미 M20 칭호 효과 다중 배틀 보정 패치가 적용되어 있습니다.');
    process.exit(0);
  }

  // 1) createBattleParticipantSnapshot 보정
  const oldSnapshot = `  const safeTeam = rawTeam
    .filter(Boolean)
    .map(pet => ({
      ...pet,
      status: { ...(pet?.status || {}) },
    }));

  const activeIndexById = safeTeam.findIndex(pet => pet?.id === battlePet?.id);
  const activePetIndex = activeIndexById >= 0 ? activeIndexById : 0;
  const safePet = safeTeam[activePetIndex] || {
    ...battlePet,
    status: { ...(battlePet?.status || {}) },
  };

  return {
    id: player.id,
    name: player.name,
    pet: safePet,
    team: safeTeam.length > 0 ? safeTeam : [safePet],
    activePetIndex,
    activePetId: safePet.id || null,
    participatedPetIds: safePet.id ? [safePet.id] : [],
    equippedTitle: player.equippedTitle || null,
    avatarSnapshotUrl: player.avatarSnapshotUrl || null,
    photoURL: player.photoURL || null,
    ...extra,
  };`;

  const newSnapshot = `  let safeTeam = rawTeam
    .filter(Boolean)
    .map(pet => ({
      ...pet,
      status: { ...(pet?.status || {}) },
    }));

  const activeIndexById = safeTeam.findIndex(pet => pet?.id === battlePet?.id);
  const activePetIndex = activeIndexById >= 0 ? activeIndexById : 0;

  // M20_TITLE_EFFECTS_TEAM_BATTLE_FIX
  // 숨은 영웅 HP 실드 / 인기스타 SP 오버차지처럼 battlePet에 적용된 시작 버프가
  // 다중 배틀 team[activePetIndex] 원본으로 덮여 사라지지 않도록 active slot에 다시 반영합니다.
  const activeTeamPet = safeTeam[activePetIndex] || {};
  const safePet = battlePet?.id
    ? {
        ...activeTeamPet,
        ...battlePet,
        status: {
          ...(activeTeamPet.status || {}),
          ...(battlePet.status || {}),
        },
      }
    : {
        ...activeTeamPet,
        status: { ...(activeTeamPet.status || {}) },
      };

  if (safePet?.id) {
    safeTeam = safeTeam.length > 0
      ? safeTeam.map((pet, index) => (
          index === activePetIndex
            ? safePet
            : { ...pet, status: { ...(pet?.status || {}) } }
        ))
      : [safePet];
  }

  return {
    id: player.id,
    name: player.name,
    pet: safePet,
    team: safeTeam.length > 0 ? safeTeam : [safePet],
    activePetIndex,
    activePetId: safePet.id || null,
    participatedPetIds: safePet.id ? [safePet.id] : [],
    equippedTitle: player.equippedTitle || null,
    avatarSnapshotUrl: player.avatarSnapshotUrl || null,
    photoURL: player.photoURL || null,
    ...extra,
  };`;

  firebase = replaceOnce(firebase, oldSnapshot, newSnapshot, 'createBattleParticipantSnapshot active slot 보정');

  // 2) 시작 버프 주석/방어적 숫자 처리 개선
  const oldStartBuff = `  // [버프 적용] 숨은 영웅(god_of_tidiness): 배틀 스탯 생성 시 최대 HP 5% 쉴드 보너스 부여
  if (challenger.equippedTitle === 'god_of_tidiness') {
    const shield = Math.floor(challengerPet.maxHp * 0.05);
    challengerPet.hp += shield;
  }
  if (opponent.equippedTitle === 'god_of_tidiness') {
    const shield = Math.floor(opponentPet.maxHp * 0.05);
    opponentPet.hp += shield;
  }

  // ▼▼▼ [추가] 인기스타(popular_star): 배틀 스탯 생성 시 SP 20% 오버차지 부여 ▼▼▼
  if (challenger.equippedTitle === 'popular_star') {
    const bonusSp = Math.floor(challengerPet.maxSp * 0.2);
    challengerPet.sp = challengerPet.maxSp + bonusSp; // 최대치를 뚫고 저장
  }
  if (opponent.equippedTitle === 'popular_star') {
    const bonusSp = Math.floor(opponentPet.maxSp * 0.2);
    opponentPet.sp = opponentPet.maxSp + bonusSp;
  }
  // ▲▲▲ [버프 적용 완료] ▲▲▲`;

  const newStartBuff = `  // M20_TITLE_EFFECTS_TEAM_BATTLE_FIX
  // [시작 버프] 숨은 영웅(god_of_tidiness): 배틀 시작 시 최대 HP 5% 실드 부여
  // hp가 maxHp를 넘으면 BattleHpBar에서 보라색 실드 구간으로 표시됩니다.
  if (challenger.equippedTitle === 'god_of_tidiness') {
    const shield = Math.floor(Number(challengerPet.maxHp ?? 0) * 0.05);
    challengerPet.hp = Number(challengerPet.hp ?? 0) + shield;
  }
  if (opponent.equippedTitle === 'god_of_tidiness') {
    const shield = Math.floor(Number(opponentPet.maxHp ?? 0) * 0.05);
    opponentPet.hp = Number(opponentPet.hp ?? 0) + shield;
  }

  // [시작 버프] 인기스타(popular_star): 배틀 시작 시 SP 20% 오버차지
  // sp가 maxSp를 넘으면 BattleSpBar에서 노란색 오버차지 구간으로 표시됩니다.
  if (challenger.equippedTitle === 'popular_star') {
    const bonusSp = Math.floor(Number(challengerPet.maxSp ?? 0) * 0.2);
    challengerPet.sp = Number(challengerPet.maxSp ?? challengerPet.sp ?? 0) + bonusSp;
  }
  if (opponent.equippedTitle === 'popular_star') {
    const bonusSp = Math.floor(Number(opponentPet.maxSp ?? 0) * 0.2);
    opponentPet.sp = Number(opponentPet.maxSp ?? opponentPet.sp ?? 0) + bonusSp;
  }
  // ▲▲▲ [버프 적용 완료] ▲▲▲`;

  firebase = replaceOnce(firebase, oldStartBuff, newStartBuff, '시작 칭호 버프 보정');

  // 3) 성실한 나무 회복이 실드 HP를 깎지 않도록 보정
  const oldTreeHeal = `                if (attacker.equippedTitle === 'diligent_tree') {
                    const heal = Math.floor(attacker.pet.maxHp * 0.05);
                    attacker.pet.hp = Math.min(attacker.pet.maxHp, attacker.pet.hp + heal);
                    log += \` 🌳 [성실한 나무 효과로 HP +\${heal} 회복]\`;
                }`;

  const newTreeHeal = `                if (attacker.equippedTitle === 'diligent_tree') {
                    // M20_TITLE_EFFECTS_TEAM_BATTLE_FIX
                    // 숨은 영웅 실드 등으로 hp가 maxHp를 넘은 상태라면 회복 처리로 실드를 깎지 않습니다.
                    const heal = Math.floor(Number(attacker.pet.maxHp ?? 0) * 0.05);
                    const currentHp = Number(attacker.pet.hp ?? 0);
                    const maxHp = Number(attacker.pet.maxHp ?? currentHp);
                    if (currentHp < maxHp) {
                        attacker.pet.hp = Math.min(maxHp, currentHp + heal);
                        log += \` 🌳 [성실한 나무 효과로 HP +\${heal} 회복]\`;
                    }
                }`;

  battle = replaceOnce(battle, oldTreeHeal, newTreeHeal, '성실한 나무 실드 보존 회복');

  fs.writeFileSync(firebasePath, firebase.replace(/\n/g, firebaseEol), 'utf8');
  fs.writeFileSync(battlePath, battle.replace(/\n/g, battleEol), 'utf8');

  console.log('[완료] M20 칭호 효과 다중 배틀 보정 패치가 적용되었습니다.');
  console.log('수정 파일:');
  console.log('  -', firebasePath);
  console.log('  -', battlePath);
  console.log('백업 파일:');
  console.log('  -', firebaseBackup);
  console.log('  -', battleBackup);
  console.log('');
  console.log('변경 요약:');
  console.log('  - 숨은 영웅 HP 실드가 다중 배틀 active team slot에 반영되도록 수정');
  console.log('  - 인기스타 SP 오버차지가 다중 배틀 active team slot에 반영되도록 수정');
  console.log('  - 성실한 나무 회복이 실드 HP를 깎지 않도록 수정');
  console.log('');
  console.log('테스트 포인트:');
  console.log('  - 숨은 영웅 장착 후 배틀 시작 시 HP가 maxHp보다 높게 표시되고 보라색 실드 바가 보여야 합니다.');
  console.log('  - 인기스타 장착 후 배틀 시작 시 SP가 maxSp보다 높게 표시되고 노란색 오버차지 바가 보여야 합니다.');
  console.log('  - 일반 칭호 효과는 기존 경로를 유지합니다.');
  console.log('');
  console.log('다음 명령어를 실행해 확인하세요:');
  console.log('  npm run dev');
} catch (error) {
  restoreAndFail(error);
}
