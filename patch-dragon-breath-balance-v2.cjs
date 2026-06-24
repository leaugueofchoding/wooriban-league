#!/usr/bin/env node
/**
 * patch-dragon-breath-balance-v2.cjs
 *
 * 용의 숨결(FIERY_BREATH) 데미지 계수 하향 v2
 *
 * 실행 위치: 프로젝트 루트
 * 실행 명령: node patch-dragon-breath-balance-v2.cjs
 *
 * 이전 패치에서 battlePetUtils / BattleTeamMiniBar 보정은 적용됐고,
 * petData.js의 FIERY_BREATH marker 탐색만 실패한 경우를 위한 후속 패치입니다.
 *
 * 변경:
 * - FIERY_BREATH calculateDamage 계수
 * - 기존: skillMult 5.5, atkMult 1.2
 * - 변경: skillMult 1.45, atkMult 0.8
 */

const fs = require('fs');
const path = require('path');

const root = process.cwd();
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

if (!fs.existsSync(petDataPath)) {
  fail(`파일을 찾지 못했습니다: ${petDataPath}`);
}

let code = fs.readFileSync(petDataPath, 'utf8');

if (code.includes('M4_DRAGON_BREATH_BALANCE_PATCH_V2')) {
  console.log('ℹ️ 이미 용의 숨결 밸런스 v2 패치가 적용되어 있습니다.');
  process.exit(0);
}

const backup = backupFile(petDataPath, 'dragon-breath-balance-v2');
ok(`백업 생성: ${path.relative(root, backup)}`);

// FIERY_BREATH 블록의 calculateDamage 호출만 대상으로 찾는다.
const dragonBreathBlockRegex = /(FIERY_BREATH\s*:\s*\{[\s\S]*?effect\s*:\s*\([\s\S]*?\)\s*=>\s*\{[\s\S]*?let\s*\{\s*damage[\s\S]*?\}\s*=\s*calculateDamage\s*\(\s*SKILLS\.FIERY_BREATH\.basePower\s*,\s*attackerPlayer\s*,\s*defenderPlayer\s*,\s*SKILLS\.FIERY_BREATH\.element\s*,\s*)([0-9.]+)(\s*,\s*)([0-9.]+)(\s*\)\s*;)/;

const match = code.match(dragonBreathBlockRegex);

if (!match) {
  fail(`FIERY_BREATH calculateDamage 계수 위치를 찾지 못했습니다.
petData.js에서 'FIERY_BREATH' 또는 '용의 숨결' 부분이 예상과 다릅니다.`);
}

const oldSkillMult = match[2];
const oldAtkMult = match[4];

code = code.replace(
  dragonBreathBlockRegex,
  `$1/* M4_DRAGON_BREATH_BALANCE_PATCH_V2 */ 1.45$30.8$5`
);

// 설명 문구도 너무 강한 표현을 완화
code = code.replace(
  /description:\s*'맹렬한 화염을 뿜어 엄청난 피해를 주지만, 반동으로 다음 턴 행동 불가 상태가 됩니다\.',/,
  `description: '맹렬한 화염을 뿜어 강한 피해를 주지만, 반동으로 다음 턴 행동 불가 상태가 됩니다.',`
);

fs.writeFileSync(petDataPath, code, 'utf8');

console.log('\n🎉 용의 숨결 밸런스 v2 패치 완료');
console.log(`기존 계수: skillMult ${oldSkillMult}, atkMult ${oldAtkMult}`);
console.log('변경 계수: skillMult 1.45, atkMult 0.8');
console.log('\n다음 명령으로 확인하세요:\n');
console.log('  npm run dev\n');
console.log('확인할 것:');
console.log('  1. 1레벨 용의 숨결 데미지가 과도하게 높지 않은지');
console.log('  2. 용의 숨결이 여전히 일반기보다는 강한지');
console.log('  3. 용의 숨결 사용 후 반동(recharging)이 그대로 걸리는지');
console.log('  4. 수락자의 두뇌쿠키 표시가 이번에는 즉시 반영되는지\n');
console.log('되돌리고 싶으면 백업 파일을 복사해서 복원하세요:');
console.log(`  ${path.relative(root, backup)}\n`);
