// patch-m20d-popular-star-overcharge-guard.cjs
// M20d: 인기스타 SP 오버차지 안전 보정
//
// 상황:
// - M20c 이후 숨은 영웅, 성실한 나무, FOCUS/아이디어 뱅크는 정상
// - 인기스타 SP 오버차지가 화면/문서에 안정적으로 반영되지 않음
//
// 해결:
// - BattlePage가 battle 문서를 구독할 때 popular_star 참가자의 team 전체를 검사
// - status.popularStarOvercharged 마커가 없는 펫에 한해 sp를 maxSp + 20% 이상으로 보정
// - 보정된 battleState를 즉시 화면에 반영하고, Firestore battle 문서에도 저장
// - 마커가 생기면 이후에는 다시 충전하지 않으므로 스킬 사용 후 무한 충전되지 않음
//
// 변경 파일:
// - src/features/battle/BattlePage.jsx
//
// 실행 위치:
//   C:\Users\Zell-yeah\우리반리그
// 실행:
//   node .\patch-m20d-popular-star-overcharge-guard.cjs

const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const battlePath = path.join(projectRoot, 'src', 'features', 'battle', 'BattlePage.jsx');

if (!fs.existsSync(battlePath)) {
  console.error('[실패] src/features/battle/BattlePage.jsx를 찾을 수 없습니다.');
  console.error('현재 위치:', projectRoot);
  process.exit(1);
}

const backupDir = path.join(projectRoot, '.patch-backups');
fs.mkdirSync(backupDir, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

const original = fs.readFileSync(battlePath, 'utf8');
const originalEol = original.includes('\r\n') ? '\r\n' : '\n';
const backupPath = path.join(backupDir, `BattlePage.before-m20d-popular-star-overcharge.${timestamp}.jsx`);
fs.writeFileSync(backupPath, original, 'utf8');

let text = original.replace(/\r\n/g, '\n');

function restoreAndFail(error) {
  fs.writeFileSync(battlePath, original, 'utf8');
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
  if (text.includes('M20D_POPULAR_STAR_OVERCHARGE_GUARD_PATCH')) {
    console.log('[안내] 이미 M20d 인기스타 오버차지 안전 보정 패치가 적용되어 있습니다.');
    process.exit(0);
  }

  // 1) helper 추가: goBack 함수 직후에 삽입
  const goBackBlock = `    const goBack = () => {
        if (window.history.length > 1) {
            navigate(-1);
        } else {
            navigate('/pet');
        }
    };
`;

  const helperBlock = `    const goBack = () => {
        if (window.history.length > 1) {
            navigate(-1);
        } else {
            navigate('/pet');
        }
    };

    // M20D_POPULAR_STAR_OVERCHARGE_GUARD_PATCH
    // 인기스타(popular_star): 배틀 시작 시 팀 전체 SP 20% 오버차지.
    // 기존 생성 단계에서 누락되거나 다중 팀 교체 과정에서 사라진 경우를 대비해,
    // battle 문서를 읽는 시점에 한 번만 보정하고 status marker로 중복 충전을 막습니다.
    const applyPopularStarOverchargeGuard = (participant) => {
        if (!participant || participant.equippedTitle !== 'popular_star') {
            return { participant, changed: false };
        }

        const activePet = participant.pet;
        const baseTeam = Array.isArray(participant.team) && participant.team.length > 0
            ? participant.team
            : activePet
                ? [activePet]
                : [];

        if (baseTeam.length === 0) {
            return { participant, changed: false };
        }

        let changed = false;

        const nextTeam = baseTeam.map((pet) => {
            if (!pet?.id) return pet;

            const status = { ...(pet.status || {}) };
            if (status.popularStarOvercharged === true) {
                return {
                    ...pet,
                    status,
                };
            }

            const maxSp = Number(pet.maxSp ?? 0);
            if (!Number.isFinite(maxSp) || maxSp <= 0) {
                return {
                    ...pet,
                    status,
                };
            }

            const bonusSp = Math.floor(maxSp * 0.2);
            const targetSp = maxSp + bonusSp;
            const currentSp = Number(pet.sp ?? 0);

            changed = true;
            return {
                ...pet,
                sp: Math.max(currentSp, targetSp),
                status: {
                    ...status,
                    popularStarOvercharged: true,
                },
            };
        });

        if (!changed) {
            return { participant, changed: false };
        }

        const activeIndexById = participant.activePetId
            ? nextTeam.findIndex(pet => pet?.id === participant.activePetId)
            : -1;

        const activeIndex = activeIndexById >= 0
            ? activeIndexById
            : Math.max(0, Number(participant.activePetIndex ?? 0));

        const nextPet = nextTeam[activeIndex] || activePet;

        return {
            changed: true,
            participant: {
                ...participant,
                pet: nextPet
                    ? {
                        ...nextPet,
                        status: { ...(nextPet.status || {}) },
                    }
                    : nextPet,
                team: nextTeam,
                activePetIndex: activeIndex,
                activePetId: nextPet?.id || participant.activePetId || null,
            },
        };
    };

    const applyPopularStarOverchargeGuardToBattle = (data) => {
        if (!data || data.status === 'finished' || data.status === 'cancelled' || data.status === 'rejected') {
            return { data, changed: false };
        }

        const challengerResult = applyPopularStarOverchargeGuard(data.challenger);
        const opponentResult = applyPopularStarOverchargeGuard(data.opponent);

        if (!challengerResult.changed && !opponentResult.changed) {
            return { data, changed: false };
        }

        return {
            changed: true,
            data: {
                ...data,
                challenger: challengerResult.participant,
                opponent: opponentResult.participant,
            },
        };
    };
`;

  text = replaceOnce(text, goBackBlock, helperBlock, 'popular_star overcharge helper 추가');

  // 2) battle snapshot listener에서 data set 전 보정
  const oldListenerPart = `                const data = docSnap.data();
                setBattleState(data);`;

  const newListenerPart = `                const rawData = docSnap.data();
                const overchargeGuardResult = applyPopularStarOverchargeGuardToBattle(rawData);
                const data = overchargeGuardResult.data;

                setBattleState(data);

                if (overchargeGuardResult.changed) {
                    updateDoc(battleRef, {
                        challenger: data.challenger,
                        opponent: data.opponent,
                    }).catch(error => {
                        console.warn('popular_star overcharge guard update failed:', error);
                    });
                }`;

  text = replaceOnce(text, oldListenerPart, newListenerPart, 'battle snapshot popular_star 보정 연결');

  fs.writeFileSync(battlePath, text.replace(/\n/g, originalEol), 'utf8');

  console.log('[완료] M20d 인기스타 SP 오버차지 안전 보정 패치가 적용되었습니다.');
  console.log('수정 파일:', battlePath);
  console.log('백업 파일:', backupPath);
  console.log('');
  console.log('변경 요약:');
  console.log('  - popular_star 참가자의 팀 전체 SP 오버차지를 battleState 구독 시 1회 보정');
  console.log('  - sp를 maxSp + 20% 이상으로 올리고 status.popularStarOvercharged 마커 저장');
  console.log('  - 화면에는 즉시 반영하고 Firestore battle 문서에도 저장');
  console.log('  - 마커가 있으면 재충전하지 않아 스킬 사용 후 무한 충전 방지');
  console.log('');
  console.log('테스트 포인트:');
  console.log('  - 인기스타 장착 후 새 배틀 시작');
  console.log('  - 선발 펫 SP가 maxSp보다 높고 노란 오버차지 바가 보여야 함');
  console.log('  - 교체로 나온 대기 펫도 처음 등장 시 SP 오버차지가 있어야 함');
  console.log('  - 스킬 사용 후에는 오버차지가 다시 무한 보충되면 안 됨');
  console.log('');
  console.log('다음 명령어를 실행해 확인하세요:');
  console.log('  npm run dev');
} catch (error) {
  restoreAndFail(error);
}
