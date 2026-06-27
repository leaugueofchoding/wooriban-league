// patch-m20c-team-title-and-focus-actions.cjs
// M20c: 다중 배틀 칭호 효과 + FOCUS 방어 행동 보정
//
// 사용자 테스트 반영:
// - 숨은 영웅 실드가 선발 1마리만 적용됨
// - 인기스타 SP 오버차지가 안 보임
// - 성실한 나무 턴 종료 회복이 안 됨
// - 아이디어 뱅크 기 모으기는 확인됨
// - 다만 상대가 두뇌간식/펫 교체를 하면 FOCUS 자체가 판정되지 않음
//
// 수정 내용:
// 1) 숨은 영웅 / 인기스타 시작 효과를 배틀 팀 전체에 적용
// 2) 성실한 나무를 attacker-only가 아니라 양쪽 active pet 턴 종료 효과로 적용
// 3) 상대가 두뇌간식/펫 교체를 해도 defenderAction === 'FOCUS'면 기 모으기/아이디어 뱅크 SP 회복 적용
//
// 변경 파일:
// - src/api/firebase.js
// - src/features/battle/BattlePage.jsx
//
// 실행 위치:
//   C:\Users\Zell-yeah\우리반리그
// 실행:
//   node .\patch-m20c-team-title-and-focus-actions.cjs

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

const firebaseBackup = path.join(backupDir, `firebase.before-m20c-team-title-focus.${timestamp}.js`);
const battleBackup = path.join(backupDir, `BattlePage.before-m20c-team-title-focus.${timestamp}.jsx`);
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

function replaceRegexOnce(source, regex, replacement, label) {
  const next = source.replace(regex, replacement);
  if (next === source) {
    throw new Error(`[패치 실패] ${label} 위치를 찾지 못했습니다.`);
  }
  return next;
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
    return source;
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
`${indent}// M20C_TEAM_TITLE_AND_FOCUS_ACTIONS_PATCH
${indent}// 성실한 나무 회복은 아래 공통 턴 종료 칭호 처리에서 attacker/defender 모두 적용합니다.
`;

  return source.slice(0, lineStart) + replacement + source.slice(end);
}

try {
  if (firebase.includes('M20C_TEAM_TITLE_AND_FOCUS_ACTIONS_PATCH') || battle.includes('M20C_TEAM_TITLE_AND_FOCUS_ACTIONS_PATCH')) {
    console.log('[안내] 이미 M20c 칭호/FOCUS 보정 패치가 적용되어 있습니다.');
    process.exit(0);
  }

  // ─────────────────────────────────────
  // 1) firebase.js: 배틀 시작 칭호 효과를 팀 전체에 적용
  // ─────────────────────────────────────

  const teamWideHelper = `
  // M20C_TEAM_TITLE_AND_FOCUS_ACTIONS_PATCH
  // 다중 펫 배틀에서는 편성된 팀 전체가 "배틀 시작" 상태에 들어간 것으로 봅니다.
  // 숨은 영웅 HP 실드와 인기스타 SP 오버차지를 선발 1마리뿐 아니라 팀 전체에 적용합니다.
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

  // 기존 active pet에만 적용되던 시작 버프 값은 팀 전체 버프 결과로 다시 확정합니다.
  challengerPet = { ...(challengerBattleTeamWithTitleEffects[0] || challengerPet), status: { ...((challengerBattleTeamWithTitleEffects[0] || challengerPet)?.status || {}) } };
  opponentPet = { ...(opponentBattleTeamWithTitleEffects[0] || opponentPet), status: { ...((opponentBattleTeamWithTitleEffects[0] || opponentPet)?.status || {}) } };

`;

  // "기절 상태 체크" 앞에 삽입. M20 1차 패치로 주석이 바뀌어도 이 위치는 안정적이다.
  firebase = replaceRegexOnce(
    firebase,
    /\n\s*\/\/\s*기절 상태 체크/,
    `${teamWideHelper}  // 기절 상태 체크`,
    '팀 전체 시작 칭호 버프 삽입'
  );

  // 기존 단일 active 버프가 먼저 실행되어도 팀 전체 버프 결과로 덮어쓰므로 중복 실드는 생기지 않음.

  firebase = replaceRegexOnce(
    firebase,
    /const\s+battleTeamSize\s*=\s*Math\.max\(\s*challengerBattleTeam\.length\s*,\s*opponentBattleTeam\.length\s*\);/,
    `const battleTeamSize = Math.max(challengerBattleTeamWithTitleEffects.length, opponentBattleTeamWithTitleEffects.length);`,
    'battleTeamSize 팀 버프 배열 기준 변경'
  );

  firebase = replaceRegexOnce(
    firebase,
    /challenger:\s*createBattleParticipantSnapshot\(challenger,\s*challengerPet,\s*\{\},\s*challengerBattleTeam\),\s*\n\s*opponent:\s*createBattleParticipantSnapshot\(opponent,\s*opponentPet,\s*\{\s*accepted:\s*false\s*\},\s*opponentBattleTeam\),/,
    `challenger: createBattleParticipantSnapshot(challenger, challengerPet, {}, challengerBattleTeamWithTitleEffects),
    opponent: createBattleParticipantSnapshot(opponent, opponentPet, { accepted: false }, opponentBattleTeamWithTitleEffects),`,
    'battleData participant snapshot 팀 버프 배열 사용'
  );

  // ─────────────────────────────────────
  // 2) BattlePage.jsx: 성실한 나무 + FOCUS helper 추가
  // ─────────────────────────────────────

  battle = removeAttackerOnlyDiligentTreeBlock(battle);

  const helperAnchor = `        return messages.join(' ');
    };

    const syncBattleParticipantActivePetToTeam = (participant) => {`;

  const helperInsert = `        return messages.join(' ');
    };

    // M20C_TEAM_TITLE_AND_FOCUS_ACTIONS_PATCH
    // 턴 종료 칭호 효과는 현재 공격자뿐 아니라 양쪽 active pet 모두를 대상으로 처리합니다.
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

    // 상대가 공격하지 않고 두뇌간식/펫 교체를 선택해도,
    // 방어자가 FOCUS를 골랐다면 그 틈에 기를 모은 것으로 처리합니다.
    const applyDefensiveFocusAction = (defenderParticipant, defenderAction) => {
        if (defenderAction !== 'FOCUS') return '';

        const pet = defenderParticipant?.pet;
        if (!defenderParticipant || !pet || Number(pet.hp ?? 0) <= 0) return '';

        if (!pet.status) pet.status = {};
        pet.status.focusCharge = 1;

        if (defenderParticipant.equippedTitle === 'idea_bank') {
            const maxSp = Number(pet.maxSp ?? 0);
            const currentSp = Number(pet.sp ?? 0);
            const spGain = Math.floor(maxSp * 0.2);

            if (maxSp > 0 && spGain > 0) {
                pet.sp = Math.min(maxSp, currentSp + spGain);
                return \`💡 [아이디어 뱅크] \${pet.name || '펫'}이(가) 틈을 타 기를 모으며 SP를 \${spGain} 회복했습니다!\`;
            }
        }

        return \`⚡ \${pet.name || '펫'}이(가) 틈을 타 기를 모았습니다! 다음 공격이 강해집니다!\`;
    };

    const syncBattleParticipantActivePetToTeam = (participant) => {`;

  battle = replaceOnce(battle, helperAnchor, helperInsert, '턴 종료 칭호/FOCUS helper 추가');

  // ─────────────────────────────────────
  // 3) 일반 공격/스킬 해석: 양쪽 성실한 나무 턴 종료 적용
  // ─────────────────────────────────────

  const resolutionAnchor = `                if (ccDotLogs.length > 0) {
                    log += \` \${ccDotLogs.join(' ')}\`;
                }

                const attackerFaintState = getFaintedSwitchState(attacker);`;

  const resolutionInsert = `                if (ccDotLogs.length > 0) {
                    log += \` \${ccDotLogs.join(' ')}\`;
                }

                // M20C_TEAM_TITLE_AND_FOCUS_ACTIONS_PATCH
                // DOT/상태 턴 종료 처리 뒤에 양쪽 active pet의 턴 종료 칭호 효과를 적용합니다.
                const titleTurnEndLogs = [
                    applyEndOfTurnTitleEffects(attacker),
                    applyEndOfTurnTitleEffects(defender),
                ].filter(Boolean);

                if (titleTurnEndLogs.length > 0) {
                    log += \` \${titleTurnEndLogs.join(' ')}\`;
                }

                const attackerFaintState = getFaintedSwitchState(attacker);`;

  battle = replaceOnce(battle, resolutionAnchor, resolutionInsert, '일반 공격/스킬 성실한 나무 턴 종료 적용');

  // ─────────────────────────────────────
  // 4) 두뇌간식: defender FOCUS + 양쪽 성실한 나무 적용
  // ─────────────────────────────────────

  const itemAnchor = `                const myStatusLog = applyEndOfTurnDotAndStatus(nextMyParticipantBase, { eligibleStatusKeys: getActiveStatusKeys(nextMyParticipantBase.pet?.status) });
                const opponentStatusLog = applyEndOfTurnDotAndStatus(nextOpponentParticipantBase, { eligibleStatusKeys: getActiveStatusKeys(nextOpponentParticipantBase.pet?.status) });

                const myResolved = resolveFaintedActiveParticipant(nextMyParticipantBase);
                const opponentResolved = resolveFaintedActiveParticipant(nextOpponentParticipantBase);`;

  const itemInsert = `                const myStatusLog = applyEndOfTurnDotAndStatus(nextMyParticipantBase, { eligibleStatusKeys: getActiveStatusKeys(nextMyParticipantBase.pet?.status) });
                const opponentStatusLog = applyEndOfTurnDotAndStatus(nextOpponentParticipantBase, { eligibleStatusKeys: getActiveStatusKeys(nextOpponentParticipantBase.pet?.status) });

                // M20C_TEAM_TITLE_AND_FOCUS_ACTIONS_PATCH
                // 공격자가 두뇌간식을 먹어도 방어자의 FOCUS는 정상 처리합니다.
                const defenderFocusLog = applyDefensiveFocusAction(nextOpponentParticipantBase, data.defenderAction);
                const myTitleTurnEndLog = applyEndOfTurnTitleEffects(nextMyParticipantBase);
                const opponentTitleTurnEndLog = applyEndOfTurnTitleEffects(nextOpponentParticipantBase);

                const myResolved = resolveFaintedActiveParticipant(nextMyParticipantBase);
                const opponentResolved = resolveFaintedActiveParticipant(nextOpponentParticipantBase);`;

  battle = replaceOnce(battle, itemAnchor, itemInsert, '두뇌간식 FOCUS/성실한 나무 적용');

  battle = replaceOnce(
    battle,
    `                    myStatusLog,
                    opponentStatusLog,
                    myResolved.log,`,
    `                    myStatusLog,
                    opponentStatusLog,
                    defenderFocusLog,
                    myTitleTurnEndLog,
                    opponentTitleTurnEndLog,
                    myResolved.log,`,
    '두뇌간식 로그 배열에 FOCUS/칭호 로그 추가'
  );

  // ─────────────────────────────────────
  // 5) 수동 펫 교체: defender FOCUS + 양쪽 성실한 나무 적용
  // ─────────────────────────────────────

  const switchAnchor = `                const switcherStatusLog = applyEndOfTurnDotAndStatus(currentTurnParticipant, { eligibleStatusKeys: getActiveStatusKeys(currentTurnParticipant.pet?.status) });
                const opponentStatusLog = applyEndOfTurnDotAndStatus(opponentTurnParticipant, { eligibleStatusKeys: getActiveStatusKeys(opponentTurnParticipant.pet?.status) });

                const currentPetAfterTurn = currentTurnParticipant.pet;`;

  const switchInsert = `                const switcherStatusLog = applyEndOfTurnDotAndStatus(currentTurnParticipant, { eligibleStatusKeys: getActiveStatusKeys(currentTurnParticipant.pet?.status) });
                const opponentStatusLog = applyEndOfTurnDotAndStatus(opponentTurnParticipant, { eligibleStatusKeys: getActiveStatusKeys(opponentTurnParticipant.pet?.status) });

                // M20C_TEAM_TITLE_AND_FOCUS_ACTIONS_PATCH
                // 공격자가 펫을 교체해도 방어자의 FOCUS는 정상 처리합니다.
                const defenderFocusLog = applyDefensiveFocusAction(opponentTurnParticipant, data.defenderAction);
                const switcherTitleTurnEndLog = applyEndOfTurnTitleEffects(currentTurnParticipant);
                const opponentTitleTurnEndLog = applyEndOfTurnTitleEffects(opponentTurnParticipant);

                const currentPetAfterTurn = currentTurnParticipant.pet;`;

  battle = replaceOnce(battle, switchAnchor, switchInsert, '수동 교체 FOCUS/성실한 나무 적용');

  battle = replaceOnce(
    battle,
    `                    switcherStatusLog,
                    opponentStatusLog,
                    switchLog,`,
    `                    switcherStatusLog,
                    opponentStatusLog,
                    defenderFocusLog,
                    switcherTitleTurnEndLog,
                    opponentTitleTurnEndLog,
                    switchLog,`,
    '수동 교체 로그 배열에 FOCUS/칭호 로그 추가'
  );

  fs.writeFileSync(firebasePath, firebase.replace(/\n/g, firebaseEol), 'utf8');
  fs.writeFileSync(battlePath, battle.replace(/\n/g, battleEol), 'utf8');

  console.log('[완료] M20c 다중 배틀 칭호 효과와 FOCUS 행동 보정 패치가 적용되었습니다.');
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
  console.log('  - 성실한 나무 HP 회복을 양쪽 active pet 턴 종료 효과로 적용');
  console.log('  - 상대가 두뇌간식/펫 교체를 해도 FOCUS/아이디어 뱅크 효과가 발동');
  console.log('');
  console.log('테스트 포인트:');
  console.log('  1) 숨은 영웅: 교체로 나온 대기 펫도 HP 실드 표시');
  console.log('  2) 인기스타: 선발/대기 펫 모두 SP 오버차지 표시');
  console.log('  3) 성실한 나무: 턴 종료 후 🌳 로그와 HP 회복');
  console.log('  4) FOCUS: 상대가 두뇌간식/교체를 해도 기 모으기 또는 아이디어 뱅크 SP 회복 로그 표시');
  console.log('');
  console.log('다음 명령어를 실행해 확인하세요:');
  console.log('  npm run dev');
} catch (error) {
  restoreAndFail(error);
}
