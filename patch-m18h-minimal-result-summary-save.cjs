// patch-m18h-minimal-result-summary-save.cjs
// M18h: 결과창 보상 표시 최소 안정 패치
//
// 목적:
// - 기존 M18 UI/resultSummary 구조는 그대로 사용
// - leagueStore wrapper가 firebase resultSummary를 반환하도록 수정
// - 일반 승패/수동 교체 승패의 processBattleResults 결과를 battle 문서에 저장
// - 도망 성공 후 자동 이동 제거
//
// 변경 파일:
// - src/store/leagueStore.js
// - src/features/battle/BattlePage.jsx
//
// 실행 위치:
//   C:\Users\Zell-yeah\우리반리그
// 실행:
//   node .\patch-m18h-minimal-result-summary-save.cjs

const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const battlePath = path.join(projectRoot, 'src', 'features', 'battle', 'BattlePage.jsx');
const storePath = path.join(projectRoot, 'src', 'store', 'leagueStore.js');

for (const filePath of [battlePath, storePath]) {
  if (!fs.existsSync(filePath)) {
    console.error('[실패] 파일을 찾을 수 없습니다:', filePath);
    console.error('현재 위치:', projectRoot);
    process.exit(1);
  }
}

const backupDir = path.join(projectRoot, '.patch-backups');
fs.mkdirSync(backupDir, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

const battleOriginal = fs.readFileSync(battlePath, 'utf8');
const storeOriginal = fs.readFileSync(storePath, 'utf8');
const battleEol = battleOriginal.includes('\r\n') ? '\r\n' : '\n';
const storeEol = storeOriginal.includes('\r\n') ? '\r\n' : '\n';

const battleBackup = path.join(backupDir, `BattlePage.before-m18h-minimal-result-summary.${timestamp}.jsx`);
const storeBackup = path.join(backupDir, `leagueStore.before-m18h-minimal-result-summary.${timestamp}.js`);
fs.writeFileSync(battleBackup, battleOriginal, 'utf8');
fs.writeFileSync(storeBackup, storeOriginal, 'utf8');

let battle = battleOriginal.replace(/\r\n/g, '\n');
let store = storeOriginal.replace(/\r\n/g, '\n');

function restoreAndFail(error) {
  fs.writeFileSync(battlePath, battleOriginal, 'utf8');
  fs.writeFileSync(storePath, storeOriginal, 'utf8');
  console.error(error.message || error);
  console.error('[복구] 패치 실패로 원본을 다시 복원했습니다.');
  console.error('BattlePage 백업:', battleBackup);
  console.error('leagueStore 백업:', storeBackup);
  process.exit(1);
}

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`[패치 실패] ${label} 위치를 찾지 못했습니다.`);
  }
  return source.replace(search, replacement);
}

function findStatementEnd(source, startIndex) {
  let depth = 0;
  let inString = null;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = startIndex; i < source.length; i += 1) {
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

    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;

    if (depth === 0 && ch === ';') {
      return i + 1;
    }
  }

  return -1;
}

function wrapUnassignedProcessBattleResults(source) {
  const needle = 'await processBattleResults(';
  let cursor = 0;
  let replacements = 0;
  let output = '';

  while (true) {
    const idx = source.indexOf(needle, cursor);
    if (idx === -1) {
      output += source.slice(cursor);
      break;
    }

    const lineStart = source.lastIndexOf('\n', idx) + 1;
    const prefix = source.slice(lineStart, idx);
    const beforeLine = source.slice(lineStart, idx);

    // 이미 const resultSummary = await ... 형태인 경우는 건너뜀
    if (beforeLine.includes('resultSummary') || beforeLine.includes('=')) {
      output += source.slice(cursor, idx + needle.length);
      cursor = idx + needle.length;
      continue;
    }

    const stmtEnd = findStatementEnd(source, idx);
    if (stmtEnd === -1) {
      throw new Error('[패치 실패] processBattleResults 호출문 끝을 찾지 못했습니다.');
    }

    const statement = source.slice(idx, stmtEnd);
    const indent = prefix;
    const wrapped =
`${indent}const resultSummary = ${statement.trim()}
${indent}if (resultSummary) {
${indent}    setLocalResultSummary(resultSummary);
${indent}    await updateDoc(battleRef, { resultSummary });
${indent}}`;

    output += source.slice(cursor, idx) + wrapped;
    cursor = stmtEnd;
    replacements += 1;
  }

  return { text: output, replacements };
}

try {
  if (battle.includes('M18H_MINIMAL_RESULT_SUMMARY_SAVE_PATCH') || store.includes('M18H_RETURN_RESULT_SUMMARY_FROM_STORE_PATCH')) {
    console.log('[안내] 이미 M18h 최소 resultSummary 저장 패치가 적용되어 있습니다.');
    process.exit(0);
  }

  if (!battle.includes('const [localResultSummary, setLocalResultSummary] = useState(null);')) {
    throw new Error('[중단] BattlePage.jsx에 localResultSummary 상태가 보이지 않습니다. M18 UI가 먼저 필요합니다.');
  }

  if (!battle.includes('await updateDoc(battleRef, { resultSummary });')) {
    throw new Error('[중단] 도망 성공 resultSummary 저장 코드가 보이지 않습니다. 현재 BattlePage 구조를 확인해야 합니다.');
  }

  // 1) leagueStore wrapper가 resultSummary를 반환하도록 수정
  const storeOld = `        // M5_BATTLE_FINAL_PARTICIPATED_PERSIST_PATCH_FIX_AFTER_V2
        try {
            await firebaseProcessBattleResults(
                classIdArg,
                winnerId,
                loserId,
                fled,
                finalWinnerPet,
                finalLoserPet,
                finalWinnerTeam,
                finalLoserTeam,
                finalWinnerParticipatedPetIds,
                finalLoserParticipatedPetIds
            );
            const updatedPlayers = await getPlayers(classIdArg);
            set({ players: updatedPlayers });
        } catch (error) {
            console.error("Battle result processing failed:", error);
        }`;

  const storeNew = `        // M5_BATTLE_FINAL_PARTICIPATED_PERSIST_PATCH_FIX_AFTER_V2
        try {
            // M18H_RETURN_RESULT_SUMMARY_FROM_STORE_PATCH
            const resultSummary = await firebaseProcessBattleResults(
                classIdArg,
                winnerId,
                loserId,
                fled,
                finalWinnerPet,
                finalLoserPet,
                finalWinnerTeam,
                finalLoserTeam,
                finalWinnerParticipatedPetIds,
                finalLoserParticipatedPetIds
            );
            const updatedPlayers = await getPlayers(classIdArg);
            set({ players: updatedPlayers });
            return resultSummary;
        } catch (error) {
            console.error("Battle result processing failed:", error);
            return null;
        }`;

  store = replaceOnce(store, storeOld, storeNew, 'leagueStore processBattleResults 반환값');

  // 2) 일반 승패/수동 교체 승패의 unassigned processBattleResults 호출을 resultSummary 저장 형태로 감쌈
  const wrapped = wrapUnassignedProcessBattleResults(battle);
  battle = wrapped.text;

  if (wrapped.replacements < 2) {
    throw new Error(`[패치 실패] 저장 처리로 감싼 processBattleResults 호출이 ${wrapped.replacements}개입니다. 예상: 2개 이상`);
  }

  // 3) M18h marker 삽입
  battle = replaceOnce(
    battle,
    `const [localResultSummary, setLocalResultSummary] = useState(null);`,
    `const [localResultSummary, setLocalResultSummary] = useState(null); // M18H_MINIMAL_RESULT_SUMMARY_SAVE_PATCH`,
    'M18h BattlePage marker'
  );

  // 4) 도망 성공 후 자동 이동 제거
  if (battle.includes('setTimeout(() => goBack(), 2000);')) {
    battle = battle.replace(
      '                        setTimeout(() => goBack(), 2000);',
      `                        // M18H_MINIMAL_RESULT_SUMMARY_SAVE_PATCH
                        // 도망 결과도 결과창에서 확인할 수 있도록 자동 이동하지 않습니다.`
    );
  }

  // 5) 결과창에 resultSummaryError가 있을 때 최소 안내
  if (!battle.includes('resultSummaryError')) {
    battle = battle.replace(
      `                            <p>{battleState.log}</p>
                            {hasRewardSummary && (`,
      `                            <p>{battleState.log}</p>
                            {!isDraw && !hasRewardSummary && battleState.resultSummaryError && (
                                <div style={{
                                    background: 'rgba(255,255,255,0.18)',
                                    borderRadius: '12px',
                                    padding: '0.8rem 1rem',
                                    margin: '0.6rem 0 1rem',
                                    fontWeight: 900,
                                }}>
                                    ⚠️ 보상 요약을 불러오지 못했습니다. 실제 보상은 처리되었을 수 있습니다.
                                </div>
                            )}
                            {hasRewardSummary && (`
    );
  }

  fs.writeFileSync(battlePath, battle.replace(/\n/g, battleEol), 'utf8');
  fs.writeFileSync(storePath, store.replace(/\n/g, storeEol), 'utf8');

  console.log('[완료] M18h 최소 resultSummary 저장 패치가 적용되었습니다.');
  console.log('수정 파일:');
  console.log('  -', battlePath);
  console.log('  -', storePath);
  console.log('백업 파일:');
  console.log('  -', battleBackup);
  console.log('  -', storeBackup);
  console.log('');
  console.log('변경 요약:');
  console.log('  - leagueStore.processBattleResults가 resultSummary를 return');
  console.log(`  - BattlePage의 직접 processBattleResults 호출 ${wrapped.replacements}개를 resultSummary 저장 형태로 변경`);
  console.log('  - resultSummary를 localResultSummary와 battle 문서에 저장');
  console.log('  - 도망 성공 후 자동 이동 제거');
  console.log('');
  console.log('다음 명령어를 실행해 확인하세요:');
  console.log('  npm run dev');
} catch (error) {
  restoreAndFail(error);
}
