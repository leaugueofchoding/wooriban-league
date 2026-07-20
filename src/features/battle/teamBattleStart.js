// src/features/battle/teamBattleStart.js
//
// 3:3 팀대전 로비(randomTeamBattleRooms)가 6명 다 입장 완료되면,
// 실제 전투는 TeamBattlePage.jsx(BattlePage.jsx를 복제해 일반화한 진짜 엔진)가 담당합니다.
// 이 파일은 그 진짜 엔진이 읽을 수 있는, 1:1과 완전히 동일한 shape의
// classes/{classId}/battles/{matchId} 문서를 만드는 역할만 합니다.
//
// 핵심 아이디어: challenger/opponent의 team 배열 안에 있는 각 펫에
// ownerId/ownerName을 붙여서, "이 팀은 사람이 3명"이라는 걸 표시합니다.
// TeamBattlePage.jsx는 교체(자동/수동)가 일어날 때 이 태그를 보고 조작권을
// 실제 펫 주인에게 넘겨줍니다.

import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../../api/firebase';

const roomRefOf = (classId, matchId) => doc(db, 'classes', classId, 'randomTeamBattleRooms', matchId);
const battleRefOf = (classId, matchId) => doc(db, 'classes', classId, 'battles', matchId);

const buildTeamBattleSideParticipant = (members) => {
  const team = (members || []).map((member) => ({
    ...member.pet,
    ownerId: member.playerId,
    ownerName: member.playerName,
    status: { ...(member.pet?.status || {}) },
  }));

  const activePet = team[0];
  if (!activePet?.id) {
    throw new Error('팀대전 출전 펫 정보를 찾을 수 없습니다.');
  }

  const leadMember = members[0];

  return {
    id: leadMember.playerId,
    name: leadMember.playerName || '플레이어',
    pet: { ...activePet },
    team,
    activePetIndex: 0,
    activePetId: activePet.id,
    participatedPetIds: [activePet.id],
    equippedTitle: leadMember.equippedTitle || null,
    avatarSnapshotUrl: leadMember.avatarSnapshotUrl || null,
    photoURL: leadMember.photoURL || null,
    // 팀 로스터 자체도 참고용으로 남겨둡니다 (보상 지급 시 팀원 전원 조회용).
    rosterPlayerIds: (members || []).map((m) => m.playerId),
  };
};

/**
 * 팀대전 로비가 준비 완료(status: 'starting')되면 호출합니다.
 * 이미 실제 배틀 문서가 만들어져 있으면 아무 것도 하지 않는 멱등 함수입니다.
 * 반환값의 battleId를 갖고 `/battle/team-fight/{battleId}`로 이동하면 됩니다.
 */
export async function startTeamBattleFight(classId, matchId) {
  const roomRef = roomRefOf(classId, matchId);
  const battleRef = battleRefOf(classId, matchId);

  return await runTransaction(db, async (transaction) => {
    const roomSnap = await transaction.get(roomRef);
    if (!roomSnap.exists()) throw new Error('팀대전 방 정보를 찾을 수 없습니다.');
    const room = roomSnap.data();

    if (room.status !== 'starting') {
      return { created: false, battleId: null };
    }

    if (room.fightBattleId) {
      return { created: false, battleId: room.fightBattleId };
    }

    const battleSnap = await transaction.get(battleRef);
    if (battleSnap.exists()) {
      transaction.update(roomRef, { fightBattleId: matchId });
      return { created: false, battleId: matchId };
    }

    const challenger = buildTeamBattleSideParticipant(room.teamA);
    const opponent = buildTeamBattleSideParticipant(room.teamB);

    transaction.set(battleRef, {
      id: matchId,
      battleId: matchId,
      randomBattle: true,
      battleMode: 'random-team',
      randomBattleMatchId: matchId,
      challenger,
      opponent,
      status: 'starting',
      startAtMs: Date.now() + 1800,
      readyPlayerIds: [challenger.id, opponent.id],
      bothPlayersReadyAt: serverTimestamp(),
      question: null,
      usedQuestions: [],
      turn: null,
      attackerAction: null,
      attackerActionPayload: null,
      defenderAction: null,
      pendingNextQuestion: null,
      pendingUsedQuestions: null,
      switchResumeAt: null,
      pendingSwitch: null,
      chat: {},
      log: '👥 6명 입장 완료! 곧 3:3 팀대전이 시작됩니다.',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    transaction.update(roomRef, { fightBattleId: matchId });

    return { created: true, battleId: matchId };
  });
}

/**
 * 로비 화면에서 실제 배틀 문서가 만들어졌는지 확인할 때 씁니다.
 */
export async function getTeamBattleFightId(classId, matchId) {
  const snap = await getDoc(roomRefOf(classId, matchId));
  if (!snap.exists()) return null;
  return snap.data()?.fightBattleId || null;
}
