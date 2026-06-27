// patch-m20b-team-wide-title-effects.cjs
// M20b: 다중 펫 배틀 칭호 효과 전면 보정
//
// 사용자 테스트 반영:
// 1) 숨은 영웅 실드가 1선발에만 적용됨
// 2) 인기스타 SP 오버차지가 표시되지 않음
// 3) 성실한 나무 턴 종료 HP 회복이 작동하지 않음
//
// 수정 방향:
// - 숨은 영웅 / 인기스타: 선택한 배틀 팀 전체에 시작 버프 적용
// - 성실한 나무: 턴 종료 시 공격자/방어자 양쪽 active pet 모두 회복 대상
// - 기존 attacker-only 성실한 나무 블록 제거 후 공통 title turn-end helper로 통합
//
// 변경 파일:
// - src/api/firebase.js
// - src/features/battle/BattlePage.jsx
//
// 실행 위치:
//   C:\Users\Zell-yeah\우리반리그
// 실행:
//   node .\patch-m20b-team-wide-title-effects.cjs

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

const firebaseBackup = path.join(backupDir, `firebase.before-m20b-team-wide-title-effects.${timestamp}.js`);
const battleBackup = path.join(backupDir, `BattlePage.before-m20b-team-wide-title-effects.${timestamp}.jsx`);
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

function findMatchingBrace(source, openBraceIndex) {
  let depth = 0;
  let inString = null;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = openBraceIndex; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === inString) {
        inString = null;
      }
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch;
      continue;
    }

    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }

  return -1;
}

function removeAttackerOnlyDiligentTreeBlock(source) {
  const marker = "if (attacker.equippedTitle === 'diligent_tree')";
  const start = source.indexOf(marker);
  if (start === -1) {
    throw new Error('[패치 실패] 기존 성실한 나무 attacker-only 블록을 찾지 못했습니다.');
  }

  const lineStart = source.lastIndexOf('\n', start) + 1;
  const openBrace = source.indexOf('{', start);
  if (openBrace === -1) {
    throw new Error('[패치 실패] 성실한 나무 블록의 여는 중괄호를 찾지 못했습니다.');
  }

  const closeBrace = findMatchingBrace(source, openBrace);
  if (closeBrace === -1) {
    throw new Error('[패치 실패] 성실한 나무 블록의 닫는 중괄호를 찾지 못했습니다.');
  }

  const lineEnd = source.indexOf('\n', closeBrace);
  const end = lineEnd === -1 ? closeBrace + 1 : lineEnd + 1;
  const indent = source.slice(lineStart, start);

  const replacement =
`${indent}// M20B_TEAM_WIDE_TITLE_EFFECTS_PATCH
${indent}// 성실한 나무 회복은 아래 공통 턴 종료 칭호 처리에서 attacker/defender 모두 적용합니다.
`;

  return source.slice(0, lineStart) + replacement + source.slice(end);
}

try {
  if (firebase.includes('M20B_TEAM_WIDE_TITLE_EFFECTS_PATCH') || battle.includes('M20B_TEAM_WIDE_TITLE_EFFECTS_PATCH')) {
    console.log('[안내] 이미 M20b 다중 배틀 칭호 효과 패치가 적용되어 있습니다.');
    process.exit(0);
  }

  // ─────────────────────────────────────
  // 1) firebase.js: 시작 버프를 팀 전체에 적용
  // ─────────────────────────────────────

  const startBuffEnd = `  // ▲▲▲ [버프 적용 완료] ▲▲▲

  // 기절 상태 체크`;
  const teamWideStartBuff = `  // ▲▲▲ [버프 적용 완료] ▲▲▲

  // M20B_TEAM_WIDE_TITLE_EFFECTS_PATCH
  // 다중 펫 배틀에서는 배틀에 편성된 팀 전체가 "배틀 시작" 상태에 들어간 것으로 봅니다.
  // 따라서 숨은 영웅 HP 실드와 인기스타 SP 오버차지는 선발 1마리뿐 아니라 선택한 팀 전체에 적용합니다.
  const applyBattleStartTitleEffectsToTeam = (team, equippedTitle) => {
    const safeTeam = Array.isArray(team) && team.length > 0 ? team : [];

    return safeTeam.map((pet) => {
      const nextPet = {
        ...pet,
        status: { ...(pet?.status || {}) },
      };

      if (!nextPet?.id) return nextPet;

      if (equippedTitle === 'god_of_tidiness') {
        const shield = Math.floor(Number(nextPet.maxHp ?? 0) * 0.05);
        nextPet.hp = Number(nextPet.hp ?? 0) + shield;
      }

      if (equippedTitle === 'popular_star') {
        const bonusSp = Math.floor(Number(nextPet.maxSp ?? 0) * 0.2);
        nextPet.sp = Number(nextPet.maxSp ?? nextPet.sp ?? 0) + bonusSp;
      }

      return nextPet;
    });
  };

  const challengerBattleTeamWithTitleEffects = applyBattleStartTitleEffectsToTeam(challengerBattleTeam, challenger.equippedTitle);
  const opponentBattleTeamWithTitleEffects = applyBattleStartTitleEffectsToTeam(opponentBattleTeam, opponent.equippedTitle);

  // 기존 단일 active pet에만 넣던 시작 버프 값은 팀 전체 버프 결과로 다시 확정합니다.
  challengerPet = { ...(challengerBattleTeamWithTitleEffects[0] || challengerPet), status: { ...((challengerBattleTeamWithTitleEffects[0] || challengerPet)?.status || {}) } };
  opponentPet = { ...(opponentBattleTeamWithTitleEffects[0] || opponentPet), status: { ...((opponentBattleTeamWithTitleEffects[0] || opponentPet)?.status || {}) } };

  // 기절 상태 체크`;

  firebase = replaceOnce(firebase, startBuffEnd, teamWideStartBuff, '팀 전체 시작 칭호 버프 삽입');

  firebase = replaceOnce(
    firebase,
    `  const battleTeamSize = Math.max(challengerBattleTeam.length, opponentBattleTeam.length);`,
    `  const battleTeamSize = Math.max(challengerBattleTeamWithTitleEffects.length, opponentBattleTeamWithTitleEffects.length);`,
    'battleTeamSize 팀 버프 배열 기준 변경'
  );

  firebase = replaceOnce(
    firebase,
    `    challenger: createBattleParticipantSnapshot(challenger, challengerPet, {}, challengerBattleTeam),
    opponent: createBattleParticipantSnapshot(opponent, opponentPet, { accepted: false }, opponentBattleTeam),`,
    `    challenger: createBattleParticipantSnapshot(challenger, challengerPet, {}, challengerBattleTeamWithTitleEffects),
    opponent: createBattleParticipantSnapshot(opponent, opponentPet, { accepted: false }, opponentBattleTeamWithTitleEffects),`,
    'battleData participant snapshot 팀 버프 배열 사용'
  );

  // ─────────────────────────────────────
  // 2) BattlePage.jsx: 성실한 나무를 양쪽 active pet 턴 종료 효과로 적용
  // ─────────────────────────────────────

  battle = removeAttackerOnlyDiligentTreeBlock(battle);

  const endDotFunction = `        return messages.join(' ');
    };

    const syncBattleParticipantActivePetToTeam = (participant) => {`;

  const titleTurnEndHelper = `        return messages.join(' ');
    };

    // M20B_TEAM_WIDE_TITLE_EFFECTS_PATCH
    // 턴 종료 칭호 효과는 현재 행동한 펫뿐 아니라 양쪽 active pet 모두를 대상으로 처리합니다.
    const applyEndOfTurnTitleEffects = (participant) => {
        const pet = participant?.pet;
        if (!participant || !pet || Number(pet.hp ?? 0) <= 0) return '';

        if (participant.equippedTitle === 'diligent_tree') {
            const maxHp = Number(pet.maxHp ?? 0);
            const currentHp = Number(pet.hp ?? 0);
            const heal = Math.max(1, Math.floor(maxHp * 0.05));

            // 숨은 영웅 실드처럼 hp가 maxHp를 넘은 상태라면 회복 처리로 실드를 깎지 않습니다.
            if (maxHp > 0 && currentHp > 0 && currentHp < maxHp) {
                pet.hp = Math.min(maxHp, currentHp + heal);
                return \`🌳 [성실한 나무] \${pet.name || '펫'} HP +\${heal} 회복!\`;
            }
        }

        return '';
    };

    const syncBattleParticipantActivePetToTeam = (participant) => {`;

  battle = replaceOnce(battle, endDotFunction, titleTurnEndHelper, '턴 종료 칭호 helper 추가');

  const afterDotLogs = `                if (ccDotLogs.length > 0) {
                    log += \` \${ccDotLogs.join(' ')}\`;
                }

                const attackerFaintState = getFaintedSwitchState(attacker);`;

  const afterDotLogsWithTitle = `                if (ccDotLogs.length > 0) {
                    log += \` \${ccDotLogs.join(' ')}\`;
                }

                // M20B_TEAM_WIDE_TITLE_EFFECTS_PATCH
                // DOT/상태 턴 종료 처리 뒤에 양쪽 active pet의 턴 종료 칭호 효과를 적용합니다.
                const titleTurnEndLogs = [
                    applyEndOfTurnTitleEffects(attacker),
                    applyEndOfTurnTitleEffects(defender),
                ].filter(Boolean);

                if (titleTurnEndLogs.length > 0) {
                    log += \` \${titleTurnEndLogs.join(' ')}\`;
                }

                const attackerFaintState = getFaintedSwitchState(attacker);`;

  battle = replaceOnce(battle, afterDotLogs, afterDotLogsWithTitle, '성실한 나무 양쪽 턴 종료 적용');

  fs.writeFileSync(firebasePath, firebase.replace(/\n/g, firebaseEol), 'utf8');
  fs.writeFileSync(battlePath, battle.replace(/\n/g, battleEol), 'utf8');

  console.log('[완료] M20b 다중 배틀 칭호 효과 보정 패치가 적용되었습니다.');
  console.log('수정 파일:');
  console.log('  -', firebasePath);
  console.log('  -', battlePath);
  console.log('백업 파일:');
  console.log('  -', firebaseBackup);
  console.log('  -', battleBackup);
  console.log('');
  console.log('변경 요약:');
  console.log('  - 숨은 영웅 HP 실드를 선택한 배틀 팀 전체에 적용');
  console.log('  - 인기스타 SP 오버차지를 선택한 배틀 팀 전체에 적용');
  console.log('  - 성실한 나무 HP 회복을 attacker-only에서 양쪽 active pet 턴 종료 효과로 변경');
  console.log('  - 숨은 영웅 실드 HP가 성실한 나무 회복 처리로 깎이지 않도록 유지');
  console.log('');
  console.log('테스트 포인트:');
  console.log('  1) 숨은 영웅: 1선발뿐 아니라 교체로 나온 대기 펫도 HP 실드가 있어야 합니다.');
  console.log('  2) 인기스타: 선발 및 교체 펫 SP가 maxSp보다 높고 노란 오버차지 바가 보여야 합니다.');
  console.log('  3) 성실한 나무: 턴 종료 후 active pet HP가 회복되고 로그에 🌳 문구가 떠야 합니다.');
  console.log('');
  console.log('다음 명령어를 실행해 확인하세요:');
  console.log('  npm run dev');
} catch (error) {
  restoreAndFail(error);
}
