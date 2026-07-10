// src/features/battle/randomBattleApi.js
// 랜덤 매칭 전용 Firestore API입니다. 기존 친구 지정 대전 흐름과 분리해 안전하게 확장합니다.
// DUAL_QUEUE_RANDOM_BATTLE_PATCH

import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { auth, db } from '../../api/firebase';
import {
  RANDOM_BATTLE_CONFIG,
  applyRandomBattleFatigueToPets,
  chooseBalancedTeamSplit,
  chooseRandom1v1Candidate,
  getTodayString,
  resetRandomBattleFatigueByVitaminJelly,
  resolveRandom1v1Team,
  resolveRandomTeamBattlePet,
  snapshotPetForRandomQueue,
} from './randomBattleRules';

const ACTIVE_QUEUE_STATUSES = ['waiting', 'matched', 'entering'];
const MATCH_LOCK_STATUSES = ['matched', 'entering'];
const RANDOM_QUEUE_MODES = ['random-1v1', 'random-team'];

const isActiveQueueStatus = (status) => ACTIVE_QUEUE_STATUSES.includes(status);
const isMatchLockedQueueStatus = (status) => MATCH_LOCK_STATUSES.includes(status);

export const getRandomBattleQueueDocId = (playerId, mode) => {
  if (!playerId) throw new Error('플레이어 정보가 없습니다.');
  if (mode === 'random-1v1') return playerId + '_1v1';
  if (mode === 'random-team') return playerId + '_team';
  if (mode === 'legacy') return playerId;
  throw new Error('알 수 없는 랜덤대전 큐 모드입니다.');
};

export const getRandomBattleQueueDocIds = (playerId) => ({
  'random-1v1': getRandomBattleQueueDocId(playerId, 'random-1v1'),
  'random-team': getRandomBattleQueueDocId(playerId, 'random-team'),
  legacy: getRandomBattleQueueDocId(playerId, 'legacy'),
});

const playerRefOf = (classId, playerId) => doc(db, 'classes', classId, 'players', playerId);
const queueRefOf = (classId, playerId, mode) => doc(db, 'classes', classId, 'randomBattleQueue', getRandomBattleQueueDocId(playerId, mode));

const assertClassAndPlayer = (classId, playerId) => {
  if (!classId) throw new Error('학급 정보가 없습니다.');
  if (!playerId) throw new Error('플레이어 정보가 없습니다.');
};

const clearPlayerQueueState = () => ({
  randomBattleQueueStatus: deleteField(),
  randomBattleQueuedAt: deleteField(),
  randomBattleLockedPetIds: deleteField(),
  randomBattleMatchLevel: deleteField(),
  randomBattleMode: deleteField(),
  randomBattleQueueModes: deleteField(),
});

const queueDataFromSnap = (snap, mode) => (
  snap.exists() ? { id: snap.id, mode, ...snap.data() } : null
);

const getActiveModeList = (queueMap = {}) => RANDOM_QUEUE_MODES.filter((mode) => (
  isActiveQueueStatus(queueMap[mode]?.status)
));

const getMatchedModeList = (queueMap = {}) => RANDOM_QUEUE_MODES.filter((mode) => (
  isMatchLockedQueueStatus(queueMap[mode]?.status)
));

const setQueueCancelled = (transaction, queueRef, queueData, reason) => {
  if (!queueData || !isActiveQueueStatus(queueData.status)) return;
  transaction.set(queueRef, {
    status: 'cancelled',
    cancelReason: reason,
    cancelledAt: serverTimestamp(),
    rematchBlockedUntilMs: Date.now() + RANDOM_BATTLE_CONFIG.REMATCH_COOLDOWN_MS,
  }, { merge: true });
};

const updatePlayerQueueSummary = (transaction, playerRef, activeModes, modePayloads = {}) => {
  if (!activeModes.length) {
    transaction.update(playerRef, clearPlayerQueueState());
    return;
  }

  const primaryMode = activeModes[0];
  const primaryPayload = modePayloads[primaryMode] || {};

  transaction.update(playerRef, {
    randomBattleQueueStatus: 'waiting',
    randomBattleQueuedAt: serverTimestamp(),
    randomBattleQueueModes: activeModes,
    randomBattleMode: activeModes.length > 1 ? 'multi' : primaryMode,
    randomBattleLockedPetIds: primaryPayload.lockedPetIds || [],
    randomBattleMatchLevel: primaryPayload.matchLevel || null,
  });
};

async function createQueueEntryForMode({
  classId,
  playerId,
  mode,
  resolvePayload,
}) {
  assertClassAndPlayer(classId, playerId);

  const playerRef = playerRefOf(classId, playerId);
  const queueRefs = {
    'random-1v1': queueRefOf(classId, playerId, 'random-1v1'),
    'random-team': queueRefOf(classId, playerId, 'random-team'),
    legacy: queueRefOf(classId, playerId, 'legacy'),
  };

  return await runTransaction(db, async (transaction) => {
    const playerSnap = await transaction.get(playerRef);
    const oneVOneSnap = await transaction.get(queueRefs['random-1v1']);
    const teamSnap = await transaction.get(queueRefs['random-team']);
    const legacySnap = await transaction.get(queueRefs.legacy);

    if (!playerSnap.exists()) throw new Error('플레이어 정보를 찾을 수 없습니다.');

    const queueMap = {
      'random-1v1': queueDataFromSnap(oneVOneSnap, 'random-1v1'),
      'random-team': queueDataFromSnap(teamSnap, 'random-team'),
    };
    const legacyQueue = queueDataFromSnap(legacySnap, 'legacy');

    if (isActiveQueueStatus(queueMap[mode]?.status)) {
      throw new Error('이미 같은 대기열에 참가 중입니다.');
    }

    if (getMatchedModeList(queueMap).length > 0 || isMatchLockedQueueStatus(legacyQueue?.status)) {
      throw new Error('이미 매칭된 랜덤대전이 있습니다. 먼저 입장하거나 대기를 취소해주세요.');
    }

    // 예전 단일 큐 문서가 waiting으로 남아 있으면 새 mode별 큐와 중복되지 않도록 정리합니다.
    setQueueCancelled(transaction, queueRefs.legacy, legacyQueue, 'migrated_to_dual_queue');

    const playerData = playerSnap.data();
    const queuePayload = resolvePayload(playerData);

    transaction.set(queueRefs[mode], queuePayload, { merge: true });

    const activeModes = [...new Set([...getActiveModeList(queueMap), mode])];
    const modePayloads = {
      ...Object.fromEntries(RANDOM_QUEUE_MODES.map((queueMode) => [queueMode, queueMap[queueMode] || {}])),
      [mode]: queuePayload,
    };

    updatePlayerQueueSummary(transaction, playerRef, activeModes, modePayloads);

    return { queueId: getRandomBattleQueueDocId(playerId, mode), ...queuePayload, queuedAt: null };
  });
}

export async function createRandom1v1QueueEntry(classId, playerId, selectedPetIds = []) {
  const today = getTodayString();

  return await createQueueEntryForMode({
    classId,
    playerId,
    mode: 'random-1v1',
    resolvePayload: (playerData) => {
      const resolvedTeam = resolveRandom1v1Team({
        player: playerData,
        selectedPetIds,
        today,
      });

      if (!resolvedTeam.isComplete) {
        throw new Error('출전 가능한 펫이 최소 1마리 필요합니다. 기절했거나 오늘 랜덤대전을 모두 사용한 펫은 제외됩니다.');
      }

      return {
        playerId,
        playerName: playerData.name || auth.currentUser?.displayName || '플레이어',
        authUid: playerData.authUid || auth.currentUser?.uid || null,
        mode: 'random-1v1',
        status: 'waiting',
        selectedPetCount: resolvedTeam.selectedPetCount,
        lockedTeam: resolvedTeam.team.map(snapshotPetForRandomQueue),
        lockedPetIds: resolvedTeam.petIds,
        matchLevel: resolvedTeam.matchLevel,
        today,
        queueStartedAtMs: Date.now(),
        queuedAt: serverTimestamp(),
        matchedBattleId: null,
        matchedOpponentId: null,
        battleReady: false,
        battleReadyAt: null,
        entrantConfirmedAt: null,
      };
    },
  });
}

export async function createRandomTeamQueueEntry(classId, playerId, selectedPetId, options = {}) {
  const today = getTodayString();
  const teamSize = Number(options.teamSize || RANDOM_BATTLE_CONFIG.TEAM_BATTLE_BETA_SIZE);

  return await createQueueEntryForMode({
    classId,
    playerId,
    mode: 'random-team',
    resolvePayload: (playerData) => {
      
      // RANDOM_TEAM_FORFEIT_PENALTY_PATCH
      const penaltyUntilMs = Number(playerData.randomTeamBattlePenaltyUntilMs || 0);
      if (penaltyUntilMs > Date.now()) {
        const remainSec = Math.ceil((penaltyUntilMs - Date.now()) / 1000);
        throw new Error('팀대전 포기 페널티가 남아 있습니다. ' + remainSec + '초 후 다시 참가할 수 있습니다.');
      }

const resolvedPet = resolveRandomTeamBattlePet({
        player: playerData,
        selectedPetId,
        today,
      });

      if (!resolvedPet.isComplete) {
        throw new Error('팀대전에 참가할 수 있는 펫이 1마리 필요합니다.');
      }

      return {
        playerId,
        playerName: playerData.name || auth.currentUser?.displayName || '플레이어',
        authUid: playerData.authUid || auth.currentUser?.uid || null,
        mode: 'random-team',
        status: 'waiting',
        teamSize,
        selectedPetId: resolvedPet.petId,
        selectedPetCount: 1,
        lockedTeam: [snapshotPetForRandomQueue(resolvedPet.pet)],
        lockedPetIds: [resolvedPet.petId],
        petLevel: resolvedPet.petLevel,
        matchLevel: resolvedPet.petLevel,
        today,
        queueStartedAtMs: Date.now(),
        queuedAt: serverTimestamp(),
        matchedBattleId: null,
        matchedOpponentId: null,
        battleReady: false,
        battleReadyAt: null,
        entrantConfirmedAt: null,
      };
    },
  });
}

export async function cancelRandomBattleQueueEntry(classId, playerId) {
  // CANCEL_RANDOM_1V1_WAITING_ROOM_PATCH
  assertClassAndPlayer(classId, playerId);

  const playerRef = playerRefOf(classId, playerId);
  const queueModes = ['random-1v1', 'random-team', 'legacy'];
  const queueRefs = queueModes.map(mode => ({ mode, ref: queueRefOf(classId, playerId, mode) }));

  await runTransaction(db, async (transaction) => {
    const queueSnaps = [];
    for (const entry of queueRefs) {
      queueSnaps.push({
        mode: entry.mode,
        ref: entry.ref,
        snap: await transaction.get(entry.ref),
      });
    }

    const random1v1Entry = queueSnaps
      .map(entry => ({
        ...entry,
        data: queueDataFromSnap(entry.snap, entry.mode),
      }))
      .find(entry => entry.mode === 'random-1v1' && entry.data && isActiveQueueStatus(entry.data.status));

    let opponentId = null;
    let battleId = null;
    let opponentQueueRef = null;
    let opponentQueueSnap = null;
    let battleRef = null;
    let battleSnap = null;
    let opponentPlayerRef = null;

    if (
      random1v1Entry?.data &&
      ['matched', 'entering'].includes(random1v1Entry.data.status) &&
      random1v1Entry.data.matchedOpponentId
    ) {
      opponentId = random1v1Entry.data.matchedOpponentId;
      battleId = random1v1Entry.data.matchedBattleId || [playerId, opponentId].sort().join('_');
      opponentQueueRef = queueRefOf(classId, opponentId, 'random-1v1');
      battleRef = doc(db, 'classes', classId, 'battles', battleId);
      opponentPlayerRef = playerRefOf(classId, opponentId);

      opponentQueueSnap = await transaction.get(opponentQueueRef);
      battleSnap = await transaction.get(battleRef);
    }

    queueSnaps.forEach(({ mode, ref, snap }) => {
      setQueueCancelled(transaction, ref, queueDataFromSnap(snap, mode), 'cancelled_by_player');
    });

    if (opponentQueueRef && opponentQueueSnap) {
      const opponentQueueData = queueDataFromSnap(opponentQueueSnap, 'random-1v1');

      if (
        opponentQueueData &&
        opponentQueueData.matchId === random1v1Entry.data.matchId &&
        opponentQueueData.matchedOpponentId === playerId &&
        isActiveQueueStatus(opponentQueueData.status)
      ) {
        setQueueCancelled(transaction, opponentQueueRef, opponentQueueData, 'opponent_cancelled');
        transaction.update(opponentPlayerRef, clearPlayerQueueState());
      }
    }

    if (battleRef && battleSnap?.exists()) {
      const battleData = battleSnap.data();
      // STALE_RANDOM_1V1_WAITING_ROOM_FIX
      // 취소 시에는 matchId가 조금 어긋났더라도 같은 pair의 랜덤대전 대기방이면 정리합니다.
      // 단, 이미 quiz/action 등 실제 전투가 시작된 문서는 건드리지 않습니다.
      const cancellableRandomWaitingRoom =
        battleData.randomBattle === true &&
        ['pending', 'starting'].includes(battleData.status);

      if (cancellableRandomWaitingRoom) {
        transaction.set(battleRef, {
          status: 'cancelled',
          cancelledBy: playerId,
          cancelReason: 'opponent_cancelled_before_start',
          log: '상대가 입장을 취소했습니다.',
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
    }

    transaction.update(playerRef, clearPlayerQueueState());
  });
}

export async function confirmRandomBattleEntrance(classId, playerId, mode = null) {
  assertClassAndPlayer(classId, playerId);

  const playerRef = playerRefOf(classId, playerId);
  const queueRefs = {
    'random-1v1': queueRefOf(classId, playerId, 'random-1v1'),
    'random-team': queueRefOf(classId, playerId, 'random-team'),
    legacy: queueRefOf(classId, playerId, 'legacy'),
  };

  return await runTransaction(db, async (transaction) => {
    const oneVOneSnap = await transaction.get(queueRefs['random-1v1']);
    const teamSnap = await transaction.get(queueRefs['random-team']);
    const legacySnap = await transaction.get(queueRefs.legacy);

    const queueMap = {
      'random-1v1': queueDataFromSnap(oneVOneSnap, 'random-1v1'),
      'random-team': queueDataFromSnap(teamSnap, 'random-team'),
    };
    const legacyQueue = queueDataFromSnap(legacySnap, 'legacy');

    const targetMode = mode || RANDOM_QUEUE_MODES.find((queueMode) => queueMap[queueMode]?.status === 'matched');
    const targetQueue = targetMode ? queueMap[targetMode] : null;

    if (!targetMode || !targetQueue) {
      throw new Error('랜덤 대전 큐 정보를 찾을 수 없습니다.');
    }
    if (targetQueue.status !== 'matched') {
      throw new Error('아직 입장 가능한 매칭 상태가 아닙니다.');
    }

    transaction.set(queueRefs[targetMode], {
      status: 'entering',
      entrantConfirmedAt: serverTimestamp(),
    }, { merge: true });

    RANDOM_QUEUE_MODES
      .filter((queueMode) => queueMode !== targetMode)
      .forEach((queueMode) => {
        setQueueCancelled(transaction, queueRefs[queueMode], queueMap[queueMode], 'matched_other_mode');
      });

    setQueueCancelled(transaction, queueRefs.legacy, legacyQueue, 'matched_other_mode');

    updatePlayerQueueSummary(transaction, playerRef, [targetMode], {
      [targetMode]: { ...targetQueue, status: 'entering' },
    });

    return {
      id: queueRefs[targetMode].id,
      ...targetQueue,
      status: 'entering',
    };
  });
}

// AUTO_MATCH_RANDOM_BATTLE_PATCH
const MATCHED_QUEUE_STATUSES = ['matched', 'entering'];

const randomBattleQueueCollectionOf = (classId) => collection(db, 'classes', classId, 'randomBattleQueue');

const getOtherRandomQueueMode = (mode) => (
  mode === 'random-1v1' ? 'random-team' : 'random-1v1'
);

const buildRandomMatchId = (mode, playerIds = []) => {
  const safeIds = playerIds.filter(Boolean).sort().join('_');
  return mode.replace('random-', 'random_') + '_' + safeIds + '_' + Date.now();
};

const getWaitingQueueEntries = async (classId, mode, maxCount = 40) => {
  const snapshot = await getDocs(query(
    randomBattleQueueCollectionOf(classId),
    where('status', '==', 'waiting'),
    limit(maxCount)
  ));

  return snapshot.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    .filter((entry) => entry.mode === mode && entry.status === 'waiting');
};

const getQueueEntryByRef = async (queueRef) => {
  const snap = await getDoc(queueRef);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

const setMatchedPlayerSummary = (transaction, playerId, mode, queuePayload) => {
  transaction.update(playerRefOf(queuePayload.classId, playerId), {
    randomBattleQueueStatus: 'matched',
    randomBattleQueueModes: [mode],
    randomBattleMode: mode,
    randomBattleLockedPetIds: queuePayload.lockedPetIds || [],
    randomBattleMatchLevel: queuePayload.matchLevel || null,
  });
};

const setMatchedPlayerSummaryByRef = (transaction, playerRef, mode, queuePayload) => {
  transaction.update(playerRef, {
    randomBattleQueueStatus: 'matched',
    randomBattleQueueModes: [mode],
    randomBattleMode: mode,
    randomBattleLockedPetIds: queuePayload.lockedPetIds || [],
    randomBattleMatchLevel: queuePayload.matchLevel || null,
  });
};

const isQueueMatchedOrEntering = (entry) => MATCHED_QUEUE_STATUSES.includes(entry?.status);

async function tryMatchRandom1v1Queue(classId, playerId) {
  assertClassAndPlayer(classId, playerId);

  const myQueueRef = queueRefOf(classId, playerId, 'random-1v1');
  const myQueue = await getQueueEntryByRef(myQueueRef);

  if (!myQueue || myQueue.status !== 'waiting' || myQueue.mode !== 'random-1v1') {
    return { matched: false, reason: 'not_waiting' };
  }

  const waitingEntries = await getWaitingQueueEntries(classId, 'random-1v1');
  const candidate = chooseRandom1v1Candidate({
    me: myQueue,
    queueEntries: waitingEntries,
    nowMs: Date.now(),
  });

  if (!candidate) {
    return { matched: false, reason: 'no_candidate' };
  }

  const candidateQueueRef = doc(db, 'classes', classId, 'randomBattleQueue', candidate.id);
  const otherQueueRefs = {
    meOther: queueRefOf(classId, playerId, getOtherRandomQueueMode('random-1v1')),
    candidateOther: queueRefOf(classId, candidate.playerId, getOtherRandomQueueMode('random-1v1')),
    meLegacy: queueRefOf(classId, playerId, 'legacy'),
    candidateLegacy: queueRefOf(classId, candidate.playerId, 'legacy'),
  };
  const myPlayerRef = playerRefOf(classId, playerId);
  const candidatePlayerRef = playerRefOf(classId, candidate.playerId);

  return await runTransaction(db, async (transaction) => {
    const [
      freshMyQueueSnap,
      freshCandidateQueueSnap,
      meOtherSnap,
      candidateOtherSnap,
      meLegacySnap,
      candidateLegacySnap,
    ] = await Promise.all([
      transaction.get(myQueueRef),
      transaction.get(candidateQueueRef),
      transaction.get(otherQueueRefs.meOther),
      transaction.get(otherQueueRefs.candidateOther),
      transaction.get(otherQueueRefs.meLegacy),
      transaction.get(otherQueueRefs.candidateLegacy),
    ]);

    if (!freshMyQueueSnap.exists() || !freshCandidateQueueSnap.exists()) {
      return { matched: false, reason: 'queue_missing' };
    }

    const freshMyQueue = { id: freshMyQueueSnap.id, ...freshMyQueueSnap.data() };
    const freshCandidateQueue = { id: freshCandidateQueueSnap.id, ...freshCandidateQueueSnap.data() };

    if (
      freshMyQueue.status !== 'waiting' ||
      freshCandidateQueue.status !== 'waiting' ||
      freshMyQueue.mode !== 'random-1v1' ||
      freshCandidateQueue.mode !== 'random-1v1' ||
      freshMyQueue.playerId === freshCandidateQueue.playerId
    ) {
      return { matched: false, reason: 'already_taken' };
    }

    if (
      isQueueMatchedOrEntering(meOtherSnap.data()) ||
      isQueueMatchedOrEntering(candidateOtherSnap.data()) ||
      isQueueMatchedOrEntering(meLegacySnap.data()) ||
      isQueueMatchedOrEntering(candidateLegacySnap.data())
    ) {
      return { matched: false, reason: 'other_mode_matched' };
    }

    const matchId = buildRandomMatchId('random-1v1', [freshMyQueue.playerId, freshCandidateQueue.playerId]);
    const nowMs = Date.now();
    const commonPatch = {
      status: 'matched',
      matchId,
      matchedAt: serverTimestamp(),
      matchExpiresAtMs: nowMs + RANDOM_BATTLE_CONFIG.ENTRANCE_TIMEOUT_MS,
      opponentHidden: true,
      battleReady: false,
      battleReadyAt: null,
      matchedBattleId: null,
    };

    transaction.set(myQueueRef, {
      ...commonPatch,
      matchedOpponentId: freshCandidateQueue.playerId,
      matchedQueueId: freshCandidateQueue.id,
    }, { merge: true });

    transaction.set(candidateQueueRef, {
      ...commonPatch,
      matchedOpponentId: freshMyQueue.playerId,
      matchedQueueId: freshMyQueue.id,
    }, { merge: true });

    setQueueCancelled(transaction, otherQueueRefs.meOther, queueDataFromSnap(meOtherSnap, 'random-team'), 'matched_1v1');
    setQueueCancelled(transaction, otherQueueRefs.candidateOther, queueDataFromSnap(candidateOtherSnap, 'random-team'), 'matched_1v1');
    setQueueCancelled(transaction, otherQueueRefs.meLegacy, queueDataFromSnap(meLegacySnap, 'legacy'), 'matched_1v1');
    setQueueCancelled(transaction, otherQueueRefs.candidateLegacy, queueDataFromSnap(candidateLegacySnap, 'legacy'), 'matched_1v1');

    setMatchedPlayerSummaryByRef(transaction, myPlayerRef, 'random-1v1', {
      ...freshMyQueue,
      classId,
    });
    setMatchedPlayerSummaryByRef(transaction, candidatePlayerRef, 'random-1v1', {
      ...freshCandidateQueue,
      classId,
    });

    return {
      matched: true,
      mode: 'random-1v1',
      matchId,
      opponentId: freshCandidateQueue.playerId,
    };
  });
}

async function tryMatchRandomTeamQueue(classId, playerId) {
  assertClassAndPlayer(classId, playerId);

  const teamSize = RANDOM_BATTLE_CONFIG.TEAM_BATTLE_BETA_SIZE;
  const needed = teamSize * 2;
  const myQueueRef = queueRefOf(classId, playerId, 'random-team');
  const myQueue = await getQueueEntryByRef(myQueueRef);

  if (!myQueue || myQueue.status !== 'waiting' || myQueue.mode !== 'random-team') {
    return { matched: false, reason: 'not_waiting' };
  }

  const waitingEntries = await getWaitingQueueEntries(classId, 'random-team');
  const others = waitingEntries
    .filter((entry) => entry.playerId !== playerId)
    .sort((a, b) => Number(a.queueStartedAtMs || 0) - Number(b.queueStartedAtMs || 0));

  const pool = [myQueue, ...others.slice(0, needed - 1)];

  if (pool.length < needed) {
    return { matched: false, reason: 'not_enough_players', waitingCount: pool.length };
  }

  const split = chooseBalancedTeamSplit({
    queueEntries: pool,
    teamSize,
    nowMs: Date.now(),
  });

  if (!split) {
    return { matched: false, reason: 'no_team_split' };
  }

  const matchedEntries = [...split.teamA, ...split.teamB];
  const playerIds = matchedEntries.map((entry) => entry.playerId);
  const queueRefs = Object.fromEntries(matchedEntries.map((entry) => [
    entry.playerId,
    doc(db, 'classes', classId, 'randomBattleQueue', entry.id),
  ]));
  const otherQueueRefs = Object.fromEntries(matchedEntries.map((entry) => [
    entry.playerId,
    {
      other: queueRefOf(classId, entry.playerId, 'random-1v1'),
      legacy: queueRefOf(classId, entry.playerId, 'legacy'),
      player: playerRefOf(classId, entry.playerId),
    },
  ]));

  return await runTransaction(db, async (transaction) => {
    const queueSnaps = await Promise.all(playerIds.map((id) => transaction.get(queueRefs[id])));
    const otherSnapPairs = await Promise.all(playerIds.map(async (id) => ({
      playerId: id,
      other: await transaction.get(otherQueueRefs[id].other),
      legacy: await transaction.get(otherQueueRefs[id].legacy),
    })));

    const freshEntries = queueSnaps.map((snap) => (
      snap.exists() ? { id: snap.id, ...snap.data() } : null
    ));

    if (
      freshEntries.some((entry) => !entry || entry.status !== 'waiting' || entry.mode !== 'random-team') ||
      new Set(freshEntries.map((entry) => entry.playerId)).size !== needed
    ) {
      return { matched: false, reason: 'already_taken' };
    }

    if (otherSnapPairs.some((pair) => (
      isQueueMatchedOrEntering(pair.other.data()) ||
      isQueueMatchedOrEntering(pair.legacy.data())
    ))) {
      return { matched: false, reason: 'other_mode_matched' };
    }

    const matchId = buildRandomMatchId('random-team', playerIds);
    const nowMs = Date.now();
    const teamAIds = split.teamA.map((entry) => entry.playerId);
    const teamBIds = split.teamB.map((entry) => entry.playerId);

    freshEntries.forEach((entry) => {
      const isTeamA = teamAIds.includes(entry.playerId);
      const myTeamIds = isTeamA ? teamAIds : teamBIds;
      const opponentTeamIds = isTeamA ? teamBIds : teamAIds;

      transaction.set(queueRefs[entry.playerId], {
        status: 'matched',
        matchId,
        matchedAt: serverTimestamp(),
        matchExpiresAtMs: nowMs + RANDOM_BATTLE_CONFIG.ENTRANCE_TIMEOUT_MS,
        opponentHidden: true,
        teamSize,
        matchedTeamRole: isTeamA ? 'A' : 'B',
        matchedTeamPlayerIds: myTeamIds,
        matchedOpponentPlayerIds: opponentTeamIds,
      }, { merge: true });

      const otherPair = otherSnapPairs.find((pair) => pair.playerId === entry.playerId);
      setQueueCancelled(transaction, otherQueueRefs[entry.playerId].other, queueDataFromSnap(otherPair?.other, 'random-1v1'), 'matched_team');
      setQueueCancelled(transaction, otherQueueRefs[entry.playerId].legacy, queueDataFromSnap(otherPair?.legacy, 'legacy'), 'matched_team');

      setMatchedPlayerSummaryByRef(transaction, otherQueueRefs[entry.playerId].player, 'random-team', {
        ...entry,
        classId,
      });
    });

    return {
      matched: true,
      mode: 'random-team',
      matchId,
      teamAIds,
      teamBIds,
    };
  });
}

// ENTER_RANDOM_1V1_BATTLE_PATCH
// ENTER_RANDOM_1V1_FIX_PATCH
const buildRandomBattleParticipant = (playerData, queueData) => {
  const team = Array.isArray(queueData?.lockedTeam) && queueData.lockedTeam.length > 0
    ? queueData.lockedTeam.map((pet) => ({ ...pet, status: { ...(pet?.status || {}) } }))
    : [];

  const firstPet = team[0] || null;

  if (!firstPet?.id) {
    throw new Error('출전 펫 정보를 찾을 수 없습니다.');
  }

  return {
    id: playerData.id || queueData.playerId,
    name: playerData.name || queueData.playerName || '플레이어',
    pet: { ...firstPet, status: { ...(firstPet.status || {}) } },
    team,
    activePetIndex: 0,
    activePetId: firstPet.id,
    participatedPetIds: [firstPet.id],
    equippedTitle: playerData.equippedTitle || null,
    avatarSnapshotUrl: playerData.avatarSnapshotUrl || null,
    photoURL: playerData.photoURL || null,
  };
};

const buildRandomBattleFallbackQuestion = () => ({
  question: '랜덤대전 시작! 준비가 되었으면 O를 고르세요.',
  answer: 'O',
  type: 'ox',
});

const isReusableRandomBattleDoc = (battleData, matchId) => {
  // STALE_RANDOM_1V1_WAITING_ROOM_FIX
  if (!battleData) return true;

  const status = battleData.status;
  const isRandomWaitingRoom =
    battleData.randomBattle === true &&
    ['pending', 'starting'].includes(status);

  // 같은 두 학생의 이전 랜덤대전 대기방이 남아 있으면 새 매칭이 덮어쓸 수 있게 허용합니다.
  // 실제 진행 중인 quiz/action/switching 계열만 막습니다.
  if (isRandomWaitingRoom && battleData.randomBattleMatchId !== matchId) {
    return true;
  }

  if (battleData.randomBattleMatchId === matchId) {
    return true;
  }

  return ['finished', 'cancelled', 'rejected'].includes(status);
};

const markRandomQueueBattleStarted = (transaction, queueRef, battleId) => {
  transaction.set(queueRef, {
    status: 'battle_started',
    matchedBattleId: battleId,
    battleStartedAt: serverTimestamp(),
  }, { merge: true });
};

export async function enterRandom1v1Battle(classId, playerId, options = {}) {
  assertClassAndPlayer(classId, playerId);

  const myQueueRef = queueRefOf(classId, playerId, 'random-1v1');
  const myPlayerRef = playerRefOf(classId, playerId);

  return await runTransaction(db, async (transaction) => {
    const myQueueSnap = await transaction.get(myQueueRef);

    if (!myQueueSnap.exists()) {
      throw new Error('1:1 랜덤대전 매칭 정보를 찾을 수 없습니다.');
    }

    const myQueue = { id: myQueueSnap.id, ...myQueueSnap.data() };

    if (!['matched', 'entering'].includes(myQueue.status) || myQueue.mode !== 'random-1v1') {
      throw new Error('아직 입장 가능한 1:1 랜덤대전 상태가 아닙니다.');
    }

    const opponentId = myQueue.matchedOpponentId;
    if (!opponentId) {
      throw new Error('상대 정보를 찾을 수 없습니다.');
    }

    const opponentQueueRef = queueRefOf(classId, opponentId, 'random-1v1');
    const opponentPlayerRef = playerRefOf(classId, opponentId);
    const battleId = [playerId, opponentId].sort().join('_');
    const battleRef = doc(db, 'classes', classId, 'battles', battleId);

    const [
      opponentQueueSnap,
      myPlayerSnap,
      opponentPlayerSnap,
      battleSnap,
      myTeamQueueSnap,
      opponentTeamQueueSnap,
      myLegacyQueueSnap,
      opponentLegacyQueueSnap,
    ] = await Promise.all([
      transaction.get(opponentQueueRef),
      transaction.get(myPlayerRef),
      transaction.get(opponentPlayerRef),
      transaction.get(battleRef),
      transaction.get(queueRefOf(classId, playerId, 'random-team')),
      transaction.get(queueRefOf(classId, opponentId, 'random-team')),
      transaction.get(queueRefOf(classId, playerId, 'legacy')),
      transaction.get(queueRefOf(classId, opponentId, 'legacy')),
    ]);

    if (!opponentQueueSnap.exists()) {
      throw new Error('상대의 1:1 랜덤대전 매칭 정보를 찾을 수 없습니다.');
    }
    if (!myPlayerSnap.exists() || !opponentPlayerSnap.exists()) {
      throw new Error('플레이어 정보를 찾을 수 없습니다.');
    }

    const opponentQueue = { id: opponentQueueSnap.id, ...opponentQueueSnap.data() };

    // ENTER_RANDOM_1V1_OPPONENT_STARTED_FIX
    // 두 번째 입장자가 배틀 문서를 만들면 본인 큐는 battle_started로 정리됩니다.
    // 이후 첫 번째 입장자의 자동 입장에서는 상대 큐가 battle_started여도
    // 같은 matchId/battleId라면 정상적인 상태로 봐야 합니다.
    const opponentAlreadyStartedSameBattle =
      opponentQueue.status === 'battle_started' &&
      opponentQueue.matchedBattleId === battleId &&
      opponentQueue.matchId === myQueue.matchId;

    const opponentIsStillEnterable =
      ['matched', 'entering'].includes(opponentQueue.status) ||
      opponentAlreadyStartedSameBattle;

    if (
      opponentQueue.mode !== 'random-1v1' ||
      !opponentIsStillEnterable ||
      opponentQueue.matchedOpponentId !== playerId ||
      opponentQueue.matchId !== myQueue.matchId
    ) {
      throw new Error('상대의 매칭 상태가 변경되었습니다.');
    }

    const currentBattleData = battleSnap.exists() ? battleSnap.data() : null;

    if (!isReusableRandomBattleDoc(currentBattleData, myQueue.matchId)) {
      throw new Error('이전 대전이 아직 진행 중입니다.');
    }

    transaction.set(myQueueRef, {
      status: 'entering',
      entrantConfirmedAt: serverTimestamp(),
      matchedBattleId: battleId,
    }, { merge: true });

    setQueueCancelled(transaction, queueRefOf(classId, playerId, 'random-team'), queueDataFromSnap(myTeamQueueSnap, 'random-team'), 'entering_1v1');
    setQueueCancelled(transaction, queueRefOf(classId, playerId, 'legacy'), queueDataFromSnap(myLegacyQueueSnap, 'legacy'), 'entering_1v1');

    // STRICT_RANDOM_1V1_WAITING_ROOM_PATCH
    // M10B_DUPLICATE_CONST_FIX
    // opponentAlreadyStartedSameBattle는 위의 매칭 상태 검증 블록에서 이미 선언되어 있으므로 재사용합니다.
    const opponentHasEntered =
      opponentQueue.status === 'entering' ||
      opponentAlreadyStartedSameBattle;

    if (!opponentHasEntered && (!currentBattleData || currentBattleData.randomBattleMatchId !== myQueue.matchId)) {
      const waitingMyPlayerData = { id: myPlayerSnap.id, ...myPlayerSnap.data() };
      const waitingOpponentPlayerData = { id: opponentPlayerSnap.id, ...opponentPlayerSnap.data() };
      const waitingSortedIds = [playerId, opponentId].sort();
      const waitingChallengerId = waitingSortedIds[0];
      const waitingChallengerQueue = waitingChallengerId === playerId ? myQueue : opponentQueue;
      const waitingOpponentQueue = waitingChallengerId === playerId ? opponentQueue : myQueue;
      const waitingChallengerData = waitingChallengerId === playerId ? waitingMyPlayerData : waitingOpponentPlayerData;
      const waitingOpponentData = waitingChallengerId === playerId ? waitingOpponentPlayerData : waitingMyPlayerData;

      const waitingChallenger = buildRandomBattleParticipant(waitingChallengerData, waitingChallengerQueue);
      const waitingOpponent = buildRandomBattleParticipant(waitingOpponentData, waitingOpponentQueue);

      transaction.set(battleRef, {
        id: battleId,
        battleId,
        randomBattle: true,
        battleMode: 'random-1v1',
        randomBattleMatchId: myQueue.matchId || null,
        challenger: waitingChallenger,
        opponent: waitingOpponent,
        status: 'pending',
        readyPlayerIds: [playerId],
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
        log: '🎲 입장 확인! 상대가 들어오면 랜덤 1:1 대전이 시작됩니다.',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: false });

      transaction.update(myPlayerRef, {
        randomBattleQueueStatus: 'entering',
        randomBattleQueueModes: ['random-1v1'],
        randomBattleMode: 'random-1v1',
        randomBattleLockedPetIds: myQueue.lockedPetIds || [],
        randomBattleMatchLevel: myQueue.matchLevel || null,
      });

      return {
        battleId,
        opponentId,
        matchId: myQueue.matchId || null,
        waitingForOpponent: true,
        battleReady: false,
      };
    }

    const myPlayerData = { id: myPlayerSnap.id, ...myPlayerSnap.data() };
    const opponentPlayerData = { id: opponentPlayerSnap.id, ...opponentPlayerSnap.data() };

    const sortedIds = [playerId, opponentId].sort();
    const challengerId = sortedIds[0];
    const challengerQueue = challengerId === playerId ? myQueue : opponentQueue;
    const opponentBattleQueue = challengerId === playerId ? opponentQueue : myQueue;
    const challengerData = challengerId === playerId ? myPlayerData : opponentPlayerData;
    const opponentData = challengerId === playerId ? opponentPlayerData : myPlayerData;

    // RANDOM_1V1_BATTLEPAGE_WAITING_ROOM_PATCH
    const startAtMs = Date.now() + 1800;

    const shouldWriteBattle = (
      !currentBattleData ||
      currentBattleData.randomBattleMatchId !== myQueue.matchId ||
      ['pending', 'finished', 'cancelled', 'rejected'].includes(currentBattleData.status)
    );

    if (shouldWriteBattle) {
      const challenger = buildRandomBattleParticipant(challengerData, challengerQueue);
      const opponent = buildRandomBattleParticipant(opponentData, opponentBattleQueue);

      const nextChallengerPets = applyRandomBattleFatigueToPets({
        pets: challengerData.pets || [],
        petIds: challengerQueue.lockedPetIds || [],
      });
      const nextOpponentPets = applyRandomBattleFatigueToPets({
        pets: opponentData.pets || [],
        petIds: opponentBattleQueue.lockedPetIds || [],
      });

      transaction.update(playerRefOf(classId, challengerData.id), { pets: nextChallengerPets });
      transaction.update(playerRefOf(classId, opponentData.id), { pets: nextOpponentPets });

      transaction.set(battleRef, {
        id: battleId,
        battleId,
        randomBattle: true,
        battleMode: 'random-1v1',
        randomBattleMatchId: myQueue.matchId || null,
        challenger,
        opponent,
        status: 'starting',
        startAtMs,
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
        log: '🎲 양쪽 입장 완료! 곧 랜덤 1:1 대전이 시작됩니다.',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    markRandomQueueBattleStarted(transaction, myQueueRef, battleId);
    markRandomQueueBattleStarted(transaction, opponentQueueRef, battleId);

    setQueueCancelled(transaction, queueRefOf(classId, opponentId, 'random-team'), queueDataFromSnap(opponentTeamQueueSnap, 'random-team'), 'entering_1v1');
    setQueueCancelled(transaction, queueRefOf(classId, opponentId, 'legacy'), queueDataFromSnap(opponentLegacyQueueSnap, 'legacy'), 'entering_1v1');

    transaction.update(myPlayerRef, clearPlayerQueueState());
    transaction.update(opponentPlayerRef, clearPlayerQueueState());

    return {
      battleId,
      opponentId,
      matchId: myQueue.matchId || null,
      waitingForOpponent: false,
      battleReady: true,
    };
  });
}


// ENTER_RANDOM_TEAM_BATTLE_ROOM_PATCH

// RANDOM_TEAM_FORFEIT_PENALTY_PATCH
export async function forfeitRandomTeamBattleAndRequeue(classId, playerId) {
  assertClassAndPlayer(classId, playerId);

  const penaltyMs = 3 * 60 * 1000;
  const penaltyUntilMs = Date.now() + penaltyMs;

  const myQueueRef = queueRefOf(classId, playerId, 'random-team');
  const myPlayerRef = playerRefOf(classId, playerId);

  return await runTransaction(db, async (transaction) => {
    const myQueueSnap = await transaction.get(myQueueRef);
    const myPlayerSnap = await transaction.get(myPlayerRef);

    if (!myPlayerSnap.exists()) {
      throw new Error('플레이어 정보를 찾을 수 없습니다.');
    }

    if (!myQueueSnap.exists()) {
      transaction.update(myPlayerRef, {
        ...clearPlayerQueueState(),
        randomTeamBattlePenaltyUntilMs: penaltyUntilMs,
      });
      return { requeued: false, penaltyUntilMs };
    }

    const myQueue = { id: myQueueSnap.id, ...myQueueSnap.data() };

    if (
      myQueue.mode !== 'random-team' ||
      !['matched', 'entering'].includes(myQueue.status) ||
      !myQueue.matchId
    ) {
      transaction.set(myQueueRef, {
        status: 'cancelled',
        cancelReason: 'team_forfeit_penalty',
        cancelledAt: serverTimestamp(),
        randomTeamBattlePenaltyUntilMs: penaltyUntilMs,
        rematchBlockedUntilMs: penaltyUntilMs,
      }, { merge: true });

      transaction.update(myPlayerRef, {
        ...clearPlayerQueueState(),
        randomTeamBattlePenaltyUntilMs: penaltyUntilMs,
      });

      return { requeued: false, penaltyUntilMs };
    }

    const matchId = myQueue.matchId;
    const myTeamIds = Array.isArray(myQueue.matchedTeamPlayerIds) ? myQueue.matchedTeamPlayerIds.filter(Boolean) : [];
    const opponentTeamIds = Array.isArray(myQueue.matchedOpponentPlayerIds) ? myQueue.matchedOpponentPlayerIds.filter(Boolean) : [];
    const allPlayerIds = [...new Set([...myTeamIds, ...opponentTeamIds])];

    const roomRef = doc(db, 'classes', classId, 'randomTeamBattleRooms', matchId);

    const refsById = Object.fromEntries(allPlayerIds.map((id) => [id, {
      queue: queueRefOf(classId, id, 'random-team'),
      player: playerRefOf(classId, id),
    }]));

    const roomSnap = await transaction.get(roomRef);

    const queueSnapsById = {};
    const playerSnapsById = {};

    for (const id of allPlayerIds) {
      queueSnapsById[id] = await transaction.get(refsById[id].queue);
    }

    for (const id of allPlayerIds) {
      playerSnapsById[id] = await transaction.get(refsById[id].player);
    }

    const requeuedPlayerIds = allPlayerIds.filter((id) => id !== playerId);
    const nowMs = Date.now();

    transaction.set(myQueueRef, {
      status: 'cancelled',
      cancelReason: 'team_forfeit_penalty',
      cancelledAt: serverTimestamp(),
      randomTeamBattlePenaltyUntilMs: penaltyUntilMs,
      rematchBlockedUntilMs: penaltyUntilMs,
    }, { merge: true });

    transaction.update(myPlayerRef, {
      ...clearPlayerQueueState(),
      randomTeamBattlePenaltyUntilMs: penaltyUntilMs,
    });

    for (const id of requeuedPlayerIds) {
      const queueSnap = queueSnapsById[id];
      const playerSnap = playerSnapsById[id];
      if (!queueSnap?.exists() || !playerSnap?.exists()) continue;

      const queueData = { id: queueSnap.id, ...queueSnap.data() };

      if (
        queueData.mode !== 'random-team' ||
        queueData.matchId !== matchId ||
        !['matched', 'entering'].includes(queueData.status)
      ) {
        continue;
      }

      transaction.set(refsById[id].queue, {
        status: 'waiting',
        cancelReason: null,
        matchId: null,
        matchedAt: null,
        matchExpiresAtMs: null,
        matchedTeamRole: null,
        matchedTeamPlayerIds: null,
        matchedOpponentPlayerIds: null,
        matchedBattleId: null,
        battleReady: false,
        battleReadyAt: null,
        entrantConfirmedAt: null,
        queueStartedAtMs: nowMs,
        queuedAt: serverTimestamp(),
        requeuedFromMatchId: matchId,
        requeuedBecausePlayerId: playerId,
      }, { merge: true });

      transaction.update(refsById[id].player, {
        randomBattleQueueStatus: 'waiting',
        randomBattleQueuedAt: serverTimestamp(),
        randomBattleQueueModes: ['random-team'],
        randomBattleMode: 'random-team',
        randomBattleLockedPetIds: queueData.lockedPetIds || [],
        randomBattleMatchLevel: queueData.matchLevel || null,
      });
    }

    if (roomSnap?.exists()) {
      transaction.set(roomRef, {
        status: 'cancelled',
        cancelReason: 'team_member_forfeited',
        cancelledBy: playerId,
        cancelledAt: serverTimestamp(),
        requeuedPlayerIds,
        log: '한 명이 팀대전을 포기해서 남은 학생들은 다시 매칭 대기열로 돌아갑니다.',
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }

    return {
      requeued: true,
      matchId,
      penaltyUntilMs,
      requeuedPlayerIds,
    };
  });
}

export async function enterRandomTeamBattle(classId, playerId) {
  assertClassAndPlayer(classId, playerId);

  const myQueueRef = queueRefOf(classId, playerId, 'random-team');

  return await runTransaction(db, async (transaction) => {
    const myQueueSnap = await transaction.get(myQueueRef);

    if (!myQueueSnap.exists()) {
      throw new Error('팀대전 매칭 정보를 찾을 수 없습니다.');
    }

    const myQueue = { id: myQueueSnap.id, ...myQueueSnap.data() };

    if (
      myQueue.mode !== 'random-team' ||
      !['matched', 'entering'].includes(myQueue.status) ||
      !myQueue.matchId
    ) {
      throw new Error('입장 가능한 팀대전 매칭 상태가 아닙니다.');
    }

    const matchId = myQueue.matchId;
    const myTeamIds = Array.isArray(myQueue.matchedTeamPlayerIds) ? myQueue.matchedTeamPlayerIds.filter(Boolean) : [];
    const opponentTeamIds = Array.isArray(myQueue.matchedOpponentPlayerIds) ? myQueue.matchedOpponentPlayerIds.filter(Boolean) : [];
    const allPlayerIds = [...new Set([...myTeamIds, ...opponentTeamIds])];

    if (allPlayerIds.length < RANDOM_BATTLE_CONFIG.TEAM_BATTLE_BETA_SIZE * 2) {
      throw new Error('팀대전 인원이 부족합니다.');
    }

    const roomRef = doc(db, 'classes', classId, 'randomTeamBattleRooms', matchId);
    const roomSnap = await transaction.get(roomRef);

    const queueRefs = Object.fromEntries(allPlayerIds.map((id) => [id, queueRefOf(classId, id, 'random-team')]));
    const playerRefs = Object.fromEntries(allPlayerIds.map((id) => [id, playerRefOf(classId, id)]));

    const queueSnaps = {};
    const playerSnaps = {};

    for (const id of allPlayerIds) {
      queueSnaps[id] = await transaction.get(queueRefs[id]);
    }

    for (const id of allPlayerIds) {
      playerSnaps[id] = await transaction.get(playerRefs[id]);
    }

    const queueByPlayerId = {};
    const playerById = {};

    for (const id of allPlayerIds) {
      if (!queueSnaps[id].exists()) {
        throw new Error('팀원의 대기열 정보를 찾을 수 없습니다.');
      }

      const queueData = { id: queueSnaps[id].id, ...queueSnaps[id].data() };

      if (
        queueData.mode !== 'random-team' ||
        queueData.matchId !== matchId ||
        !['matched', 'entering', 'battle_started'].includes(queueData.status)
      ) {
        throw new Error('팀원의 매칭 상태가 변경되었습니다.');
      }

      queueByPlayerId[id] = queueData;

      if (!playerSnaps[id].exists()) {
        throw new Error('팀원 정보를 찾을 수 없습니다.');
      }

      playerById[id] = { id: playerSnaps[id].id, ...playerSnaps[id].data() };
    }

    const roleAEntry = Object.values(queueByPlayerId).find((entry) => entry.matchedTeamRole === 'A');
    const roleBEntry = Object.values(queueByPlayerId).find((entry) => entry.matchedTeamRole === 'B');

    const teamAPlayerIds = roleAEntry?.matchedTeamPlayerIds?.filter(Boolean)
      || (myQueue.matchedTeamRole === 'A' ? myTeamIds : opponentTeamIds);

    const teamBPlayerIds = roleBEntry?.matchedTeamPlayerIds?.filter(Boolean)
      || (myQueue.matchedTeamRole === 'B' ? myTeamIds : opponentTeamIds);

    const buildMember = (id) => {
      const playerData = playerById[id] || {};
      const queueData = queueByPlayerId[id] || {};
      const pet = Array.isArray(queueData.lockedTeam) ? queueData.lockedTeam[0] : null;

      if (!pet?.id) {
        throw new Error('팀원의 출전 펫 정보를 찾을 수 없습니다.');
      }

      return {
        playerId: id,
        playerName: playerData.name || queueData.playerName || '플레이어',
        authUid: playerData.authUid || queueData.authUid || null,
        pet: { ...pet, status: { ...(pet.status || {}) } },
        petId: pet.id,
        petName: pet.name || '펫',
        petLevel: Number(pet.level || queueData.petLevel || 1),
        avatarSnapshotUrl: playerData.avatarSnapshotUrl || null,
        photoURL: playerData.photoURL || null,
      };
    };

    const roomData = roomSnap.exists() ? roomSnap.data() : null;
    const previousReadyIds = Array.isArray(roomData?.readyPlayerIds) ? roomData.readyPlayerIds : [];
    const readyPlayerIds = [...new Set([...previousReadyIds, playerId])].filter((id) => allPlayerIds.includes(id));
    const neededCount = allPlayerIds.length;
    const allReady = readyPlayerIds.length >= neededCount;
    const alreadyConsumed = roomData?.teamBattleFatigueConsumed === true;
    const startAtMs = roomData?.startAtMs || Date.now() + 1800;

    const roomPayload = {
      id: matchId,
      matchId,
      randomBattle: true,
      battleMode: 'random-team',
      teamBattle: true,
      teamBattleSize: RANDOM_BATTLE_CONFIG.TEAM_BATTLE_BETA_SIZE,
      status: allReady ? 'starting' : 'pending',
      teamAPlayerIds,
      teamBPlayerIds,
      allPlayerIds,
      readyPlayerIds,
      readyCount: readyPlayerIds.length,
      neededCount,
      teamA: teamAPlayerIds.map(buildMember),
      teamB: teamBPlayerIds.map(buildMember),
      startAtMs: allReady ? startAtMs : null,
      log: allReady
        ? '👥 2:2 팀대전 준비 완료!'
        : '👥 팀원이 모두 입장하면 2:2 팀대전이 시작됩니다.',
      createdAt: roomData?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
      teamBattleFatigueConsumed: allReady ? true : Boolean(roomData?.teamBattleFatigueConsumed),
    };

    transaction.set(roomRef, roomPayload, { merge: true });

    if (allReady && !alreadyConsumed) {
      for (const id of allPlayerIds) {
        const queueData = queueByPlayerId[id];
        const playerData = playerById[id];

        const nextPets = applyRandomBattleFatigueToPets({
          pets: playerData.pets || [],
          petIds: queueData.lockedPetIds || [],
        });

        transaction.update(playerRefs[id], {
          pets: nextPets,
          ...clearPlayerQueueState(),
        });

        markRandomQueueBattleStarted(transaction, queueRefs[id], matchId);
      }
    } else if (!allReady) {
      transaction.set(myQueueRef, {
        status: 'entering',
        entrantConfirmedAt: serverTimestamp(),
        matchedBattleId: matchId,
      }, { merge: true });

      transaction.update(playerRefs[playerId], {
        randomBattleQueueStatus: 'entering',
        randomBattleQueueModes: ['random-team'],
        randomBattleMode: 'random-team',
        randomBattleLockedPetIds: myQueue.lockedPetIds || [],
        randomBattleMatchLevel: myQueue.matchLevel || null,
      });
    }

    return {
      matchId,
      roomId: matchId,
      readyCount: readyPlayerIds.length,
      neededCount,
      battleReady: allReady,
    };
  });
}

export async function tryMatchRandomBattleQueue(classId, playerId, mode) {
  if (mode === 'random-1v1') {
    return await tryMatchRandom1v1Queue(classId, playerId);
  }
  if (mode === 'random-team') {
    return await tryMatchRandomTeamQueue(classId, playerId);
  }
  throw new Error('알 수 없는 랜덤대전 큐 모드입니다.');
}

export async function consumeRandomBattleFatigueForPets(classId, playerId, petIds, options = {}) {
  assertClassAndPlayer(classId, playerId);
  if (!Array.isArray(petIds) || petIds.length === 0) {
    throw new Error('대전 횟수를 차감할 펫 정보가 없습니다.');
  }

  const playerRef = playerRefOf(classId, playerId);
  const today = options.today || getTodayString();

  return await runTransaction(db, async (transaction) => {
    const playerSnap = await transaction.get(playerRef);
    if (!playerSnap.exists()) throw new Error('플레이어 정보를 찾을 수 없습니다.');

    const playerData = playerSnap.data();
    const nextPets = applyRandomBattleFatigueToPets({
      pets: playerData.pets || [],
      petIds,
      today,
    });

    transaction.update(playerRef, { pets: nextPets });
    return { ...playerData, pets: nextPets };
  });
}

export async function useVitaminJellyForRandomBattlePet(classId, playerId, petId) {
  assertClassAndPlayer(classId, playerId);
  if (!petId) throw new Error('비타민젤리를 먹일 펫을 선택해주세요.');

  const playerRef = playerRefOf(classId, playerId);
  const queueRefs = {
    'random-1v1': queueRefOf(classId, playerId, 'random-1v1'),
    'random-team': queueRefOf(classId, playerId, 'random-team'),
    legacy: queueRefOf(classId, playerId, 'legacy'),
  };
  const today = getTodayString();

  return await runTransaction(db, async (transaction) => {
    const playerSnap = await transaction.get(playerRef);
    const oneVOneSnap = await transaction.get(queueRefs['random-1v1']);
    const teamSnap = await transaction.get(queueRefs['random-team']);
    const legacySnap = await transaction.get(queueRefs.legacy);

    if (!playerSnap.exists()) throw new Error('플레이어 정보를 찾을 수 없습니다.');

    const activeQueueExists = [oneVOneSnap, teamSnap, legacySnap].some((snap) => (
      snap.exists() && isActiveQueueStatus(snap.data()?.status)
    ));

    if (activeQueueExists) {
      throw new Error('랜덤대전 큐 신청 후에는 비타민젤리를 사용할 수 없습니다.');
    }

    const playerData = playerSnap.data();
    const inventory = { ...(playerData.petInventory || {}) };
    const jellyCount = Number(inventory[RANDOM_BATTLE_CONFIG.VITAMIN_JELLY_ITEM_ID] || 0);

    if (jellyCount <= 0) throw new Error('비타민젤리가 없습니다.');

    const pets = Array.isArray(playerData.pets) ? playerData.pets : [];
    const targetPet = pets.find((pet) => pet.id === petId);

    if (!targetPet) throw new Error('펫을 찾을 수 없습니다.');
    if (targetPet.activeBattleId || targetPet.currentBattleId || targetPet.battleLockId || targetPet.lockedBattleId) {
      throw new Error('배틀 중인 펫에게는 비타민젤리를 사용할 수 없습니다.');
    }

    const nextPets = resetRandomBattleFatigueByVitaminJelly({ pets, petId, today });
    const nextInventory = {
      ...inventory,
      [RANDOM_BATTLE_CONFIG.VITAMIN_JELLY_ITEM_ID]: jellyCount - 1,
    };

    transaction.update(playerRef, { pets: nextPets, petInventory: nextInventory });
    return { ...playerData, pets: nextPets, petInventory: nextInventory };
  });
}
