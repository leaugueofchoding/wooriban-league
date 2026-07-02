// src/features/battle/randomBattleApi.js
// 랜덤 매칭 전용 Firestore API입니다. 기존 친구 지정 대전 흐름과 분리해 안전하게 확장합니다.
// DUAL_QUEUE_RANDOM_BATTLE_PATCH

import { deleteField, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../api/firebase';
import {
  RANDOM_BATTLE_CONFIG,
  applyRandomBattleFatigueToPets,
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
        entrantConfirmedAt: null,
      };
    },
  });
}

export async function cancelRandomBattleQueueEntry(classId, playerId, reason = 'cancelled_by_player', mode = null) {
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

    const modesToCancel = mode ? [mode] : RANDOM_QUEUE_MODES;

    modesToCancel.forEach((queueMode) => {
      setQueueCancelled(transaction, queueRefs[queueMode], queueMap[queueMode], reason);
      if (queueMap[queueMode]) queueMap[queueMode] = { ...queueMap[queueMode], status: 'cancelled' };
    });

    setQueueCancelled(transaction, queueRefs.legacy, legacyQueue, reason);

    const remainingActiveModes = mode
      ? getActiveModeList(queueMap)
      : [];

    updatePlayerQueueSummary(transaction, playerRef, remainingActiveModes, queueMap);
    return true;
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
