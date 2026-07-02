// src/features/battle/randomBattleApi.js
// 랜덤 매칭 전용 Firestore API입니다. 기존 친구 지정 대전 흐름과 분리해 안전하게 확장합니다.

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
const isActiveQueueStatus = (status) => ACTIVE_QUEUE_STATUSES.includes(status);

const playerRefOf = (classId, playerId) => doc(db, 'classes', classId, 'players', playerId);
const queueRefOf = (classId, playerId) => doc(db, 'classes', classId, 'randomBattleQueue', playerId);

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
});

export async function createRandom1v1QueueEntry(classId, playerId, selectedPetIds = []) {
  assertClassAndPlayer(classId, playerId);
  const playerRef = playerRefOf(classId, playerId);
  const queueRef = queueRefOf(classId, playerId);
  const today = getTodayString();

  return await runTransaction(db, async (transaction) => {
    const playerSnap = await transaction.get(playerRef);
    const queueSnap = await transaction.get(queueRef);

    if (!playerSnap.exists()) throw new Error('플레이어 정보를 찾을 수 없습니다.');

    const queueData = queueSnap.exists() ? queueSnap.data() : null;
    if (isActiveQueueStatus(queueData?.status)) throw new Error('이미 랜덤 대전 대기 중입니다.');

    const playerData = playerSnap.data();
    const resolvedTeam = resolveRandom1v1Team({
      player: playerData,
      selectedPetIds,
      today,
    });

    if (!resolvedTeam.isComplete) {
      throw new Error('출전 가능한 펫이 최소 1마리 필요합니다. 기절했거나 오늘 랜덤대전을 모두 사용한 펫은 제외됩니다.');
    }

    const queuePayload = {
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

    transaction.set(queueRef, queuePayload, { merge: true });
    transaction.update(playerRef, {
      randomBattleQueueStatus: 'waiting',
      randomBattleQueuedAt: serverTimestamp(),
      randomBattleLockedPetIds: resolvedTeam.petIds,
      randomBattleMatchLevel: resolvedTeam.matchLevel,
      randomBattleMode: 'random-1v1',
    });

    return { queueId: playerId, ...queuePayload, queuedAt: null };
  });
}

export async function createRandomTeamQueueEntry(classId, playerId, selectedPetId, options = {}) {
  assertClassAndPlayer(classId, playerId);
  const playerRef = playerRefOf(classId, playerId);
  const queueRef = queueRefOf(classId, playerId);
  const today = getTodayString();
  const teamSize = Number(options.teamSize || RANDOM_BATTLE_CONFIG.TEAM_BATTLE_BETA_SIZE);

  return await runTransaction(db, async (transaction) => {
    const playerSnap = await transaction.get(playerRef);
    const queueSnap = await transaction.get(queueRef);

    if (!playerSnap.exists()) throw new Error('플레이어 정보를 찾을 수 없습니다.');

    const queueData = queueSnap.exists() ? queueSnap.data() : null;
    if (isActiveQueueStatus(queueData?.status)) throw new Error('이미 랜덤 대전 대기 중입니다.');

    const playerData = playerSnap.data();
    const resolvedPet = resolveRandomTeamBattlePet({
      player: playerData,
      selectedPetId,
      today,
    });

    if (!resolvedPet.isComplete) {
      throw new Error('팀대전에 참가할 수 있는 펫이 1마리 필요합니다.');
    }

    const queuePayload = {
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

    transaction.set(queueRef, queuePayload, { merge: true });
    transaction.update(playerRef, {
      randomBattleQueueStatus: 'waiting',
      randomBattleQueuedAt: serverTimestamp(),
      randomBattleLockedPetIds: [resolvedPet.petId],
      randomBattleMatchLevel: resolvedPet.petLevel,
      randomBattleMode: 'random-team',
    });

    return { queueId: playerId, ...queuePayload, queuedAt: null };
  });
}

export async function cancelRandomBattleQueueEntry(classId, playerId, reason = 'cancelled_by_player') {
  assertClassAndPlayer(classId, playerId);
  const playerRef = playerRefOf(classId, playerId);
  const queueRef = queueRefOf(classId, playerId);

  return await runTransaction(db, async (transaction) => {
    const queueSnap = await transaction.get(queueRef);

    if (queueSnap.exists()) {
      transaction.set(queueRef, {
        status: 'cancelled',
        cancelReason: reason,
        cancelledAt: serverTimestamp(),
        rematchBlockedUntilMs: Date.now() + RANDOM_BATTLE_CONFIG.REMATCH_COOLDOWN_MS,
      }, { merge: true });
    }

    transaction.update(playerRef, clearPlayerQueueState());
    return true;
  });
}

export async function confirmRandomBattleEntrance(classId, playerId) {
  assertClassAndPlayer(classId, playerId);
  const queueRef = queueRefOf(classId, playerId);

  return await runTransaction(db, async (transaction) => {
    const queueSnap = await transaction.get(queueRef);
    if (!queueSnap.exists()) throw new Error('랜덤 대전 큐 정보를 찾을 수 없습니다.');

    const queueData = queueSnap.data();
    if (queueData.status !== 'matched') throw new Error('아직 입장 가능한 매칭 상태가 아닙니다.');

    transaction.set(queueRef, {
      status: 'entering',
      entrantConfirmedAt: serverTimestamp(),
    }, { merge: true });

    return { id: queueSnap.id, ...queueData, status: 'entering' };
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
  const queueRef = queueRefOf(classId, playerId);
  const today = getTodayString();

  return await runTransaction(db, async (transaction) => {
    const playerSnap = await transaction.get(playerRef);
    const queueSnap = await transaction.get(queueRef);

    if (!playerSnap.exists()) throw new Error('플레이어 정보를 찾을 수 없습니다.');

    const queueData = queueSnap.exists() ? queueSnap.data() : null;
    if (isActiveQueueStatus(queueData?.status)) {
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
