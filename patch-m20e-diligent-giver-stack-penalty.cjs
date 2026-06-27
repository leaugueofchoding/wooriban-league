// patch-m20e-diligent-giver-stack-penalty.cjs
// M20e: 성실한 기부천사 패배 페널티 감면을 최종 패널티에 누적 적용
//
// 문제:
// - 현재 구조는 diligent_giver 감면이 레벨차 감면보다 먼저 적용됨
// - 기본 50P -> 기부천사 25P가 된 뒤,
//   M9B 레벨차 감면은 "25P보다 클 때만" 작동하므로 추가 감면이 안 됨
//
// 목표:
// - 기본 패널티 50P
// - 강팀 상대 레벨차 감면 25P
// - 성실한 기부천사 추가 50% 감면
// - 최종 12P
//
// 변경 파일:
// - src/api/firebase.js
//
// 실행 위치:
//   C:\Users\Zell-yeah\우리반리그
// 실행:
//   node .\patch-m20e-diligent-giver-stack-penalty.cjs

const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const firebasePath = path.join(projectRoot, 'src', 'api', 'firebase.js');

if (!fs.existsSync(firebasePath)) {
  console.error('[실패] src/api/firebase.js를 찾을 수 없습니다.');
  console.error('현재 위치:', projectRoot);
  process.exit(1);
}

const backupDir = path.join(projectRoot, '.patch-backups');
fs.mkdirSync(backupDir, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

const original = fs.readFileSync(firebasePath, 'utf8');
const originalEol = original.includes('\r\n') ? '\r\n' : '\n';
const backupPath = path.join(backupDir, `firebase.before-m20e-diligent-giver-stack.${timestamp}.js`);
fs.writeFileSync(backupPath, original, 'utf8');

let text = original.replace(/\r\n/g, '\n');

function restoreAndFail(error) {
  fs.writeFileSync(firebasePath, original, 'utf8');
  console.error(error.message || error);
  console.error('[복구] 패치 실패로 원본을 다시 복원했습니다.');
  console.error('백업 파일:', backupPath);
  process.exit(1);
}

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`[패치 실패] ${label} 위치를 찾지 못했습니다.`);
  }
  return source.replace(search, replacement);
}

try {
  if (text.includes('M20E_DILIGENT_GIVER_STACK_PENALTY_PATCH')) {
    console.log('[안내] 이미 M20e 성실한 기부천사 누적 감면 패치가 적용되어 있습니다.');
    process.exit(0);
  }

  // 1) 기존 조기 감면을 제거하고 note 변수만 선언
  const oldEarlyBlock = `    let defeatPenalty = fled ? 0 : 50;
    if (loserTitle === 'diligent_giver' && defeatPenalty > 0) {
      defeatPenalty = Math.floor(defeatPenalty * 0.5);
    }`;

  const newEarlyBlock = `    let defeatPenalty = fled ? 0 : 50;
    // M20E_DILIGENT_GIVER_STACK_PENALTY_PATCH
    // 성실한 기부천사 감면은 레벨차 감면까지 반영된 "최종 패널티"에 마지막으로 적용합니다.
    let diligentGiverPenaltyNote = '';`;

  text = replaceOnce(text, oldEarlyBlock, newEarlyBlock, '기부천사 조기 감면 제거');

  // 2) M9B 레벨차 감면 뒤에 기부천사 최종 감면 삽입
  const afterM9BBlock = `    if (!fled && maxLevelGap >= 5 && defeatPenalty > 25) {
      defeatPenalty = 25;
      defeatPenaltyLevelNote = \` (상대 최고 레벨 +\${maxLevelGap}: 강팀 상대 감면)\`;
    }

    // M15B_FLEE_EXP_SCALE_PATCH`;

  const afterM9BWithDiligentGiver = `    if (!fled && maxLevelGap >= 5 && defeatPenalty > 25) {
      defeatPenalty = 25;
      defeatPenaltyLevelNote = \` (상대 최고 레벨 +\${maxLevelGap}: 강팀 상대 감면)\`;
    }

    // M20E_DILIGENT_GIVER_STACK_PENALTY_PATCH
    // 성실한 기부천사는 레벨차/도망 여부까지 계산된 최종 패배 페널티를 다시 50% 감면합니다.
    // 예: 기본 50P → 강팀 상대 감면 25P → 기부천사 추가 감면 12P
    if (loserTitle === 'diligent_giver' && defeatPenalty > 0) {
      const beforeDiligentGiverPenalty = defeatPenalty;
      defeatPenalty = Math.max(1, Math.floor(defeatPenalty * 0.5));
      diligentGiverPenaltyNote = \` (기부천사 추가 감면 \${beforeDiligentGiverPenalty}P→\${defeatPenalty}P)\`;
    }

    // M15B_FLEE_EXP_SCALE_PATCH`;

  text = replaceOnce(text, afterM9BBlock, afterM9BWithDiligentGiver, 'M9B 뒤 기부천사 최종 감면 삽입');

  // 3) 결과창 notes에 기부천사 감면 note 추가
  text = replaceOnce(
    text,
    `      notes: [fleeRewardNote, teamSizeRewardNote, levelScaleNote, defeatPenaltyLevelNote, lossExpScaleNote].filter(Boolean),`,
    `      notes: [fleeRewardNote, teamSizeRewardNote, levelScaleNote, defeatPenaltyLevelNote, diligentGiverPenaltyNote, lossExpScaleNote].filter(Boolean),`,
    'resultSummary notes에 기부천사 note 추가'
  );

  // 4) 포인트 이력 문구도 실제 최종 감면 순서대로 표시
  text = replaceOnce(
    text,
    `"퀴즈 배틀 패배" + (loserTitle === 'diligent_giver' ? ' (기부천사 페널티 감면)' : '') + defeatPenaltyLevelNote + lossExpScaleNote`,
    `"퀴즈 배틀 패배" + defeatPenaltyLevelNote + diligentGiverPenaltyNote + lossExpScaleNote`,
    '포인트 이력 기부천사 문구 정리'
  );

  fs.writeFileSync(firebasePath, text.replace(/\n/g, originalEol), 'utf8');

  console.log('[완료] M20e 성실한 기부천사 누적 페널티 감면 패치가 적용되었습니다.');
  console.log('수정 파일:', firebasePath);
  console.log('백업 파일:', backupPath);
  console.log('');
  console.log('변경 요약:');
  console.log('  - 기부천사 감면을 레벨차 감면보다 뒤로 이동');
  console.log('  - 강팀 상대 패배 25P가 기부천사로 다시 12P까지 감면');
  console.log('  - 결과창 notes와 포인트 이력에 기부천사 추가 감면 내역 표시');
  console.log('');
  console.log('테스트 포인트:');
  console.log('  - 성실한 기부천사 장착 + 강팀 상대 패배');
  console.log('  - 결과창 포인트 변화가 -25P가 아니라 -12P로 떠야 함');
  console.log('  - 포인트 이력에 “강팀 상대 감면”과 “기부천사 추가 감면 25P→12P”가 보여야 함');
  console.log('');
  console.log('다음 명령어를 실행해 확인하세요:');
  console.log('  npm run dev');
} catch (error) {
  restoreAndFail(error);
}
