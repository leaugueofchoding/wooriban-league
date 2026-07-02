// src/features/battle/randomBattleApi.js
// RANDOM_BATTLE_QUEUE_API_SCAFFOLD
// 기존 친구 지정 대전 코드를 건드리지 않고 랜덤대전 전용 Firestore API를 분리합니다.

import {
  doc,
  runTransaction,
  serverTimestamp,
  deleteField,
} from 'firebase/firestore';
import { auth, db } from '../../api/firebase';
import {
  RANDOM_BATTLE_CONFIG,
  applyBattleFatigueToPets,
  getTodayString,
  resetPetBattleFatigueByVitaminJelly,
  resolveRandomBattleTeam,
  snapshotPetForRandomQueue,
} from './randomBattleRules';

const QUEUE_ACTIVE_STATUSES = ['waiting', 'matched', 'entering'];

const getPlayerRef = (classId, playerId) => doc(db, 'classes', classId, 'players', playerId);
const getQueueRef = (classId, playerId) => doc(db, 'classes', classId, 'randomBattleQueue', playerId);

const assertClassAndPlayer = (classId, playerId) => {
  if (!classId) throw new Error('학급 정보가 없습니다.');
  if (!playerId) throw new Error('플레이어 정보가 없습니다.');
};

const isActiveQueueStatus = (status) => QUEUE_ACTIVE_STATUSES.includes(status);

export async function setRandomBattlePresetPetIds(classId, playerId, battlePresetPetIds) {
  assertClassAndPlayer(classId, playerId);

  const playerRef = getPlayerRef(classId, playerId);
  const preset = {
    leadPetId: battlePresetPetIds?.leadPetId || null,
    benchPetId: battlePresetPetIds?.benchPetId || null,
    thirdPetId: battlePresetPetIds?.thirdPetId || null,
  };

  return await runTransaction(db, async (transaction) => {
    const playerSnap = await transaction.get(playerRef);
    if (!playerSnap.exists()) throw new Error('플레이어 정보를 찾을 수 없습니다.');

    const playerData = playerSnap.data();
    const ownedPetIds = new Set((playerData.pets || []).map((pet) => pet.id));
    Object.values(preset).filter(Boolean).forEach((petId) => {
      if (!ownedPetIds.has(petId)) {
        throw new Error('보유하지 않은 펫은 랜덤 대전 프리셋에 넣을 수 없습니다.');
      }
    });

    transaction.update(playerRef, { battlePresetPetIds: preset });
    return { ...playerData, battlePresetPetIds: preset };
  });
}

export async function useVitaminJellyForPet(classId, playerId, petId) {
  assertClassAndPlayer(classId, playerId);
  if (!petId) throw new Error('비타민젤리를 먹일 펫을 선택해주세요.');

  const playerRef = getPlayerRef(classId, playerId);
  const queueRef = getQueueRef(classId, playerId);
  const today = getTodayString();

  return await runTransaction(db, async (transaction) => {
    const [playerSnap, queueSnap] = await Promise.all([
      transaction.get(playerRef),
      transaction.get(queueRef),
    ]);

    if (!playerSnap.exists()) throw new Error('플레이어 정보를 찾을 수 없습니다.');

    const queueData = queueSnap.exists() ? queueSnap.data() : null;
    if (isActiveQueueStatus(queueData?.status)) {
      throw new Error('큐 신청 후에는 비타민젤리를 사용할 수 없습니다.');
    }

    const playerData = playerSnap.data();
    const inventory = { ...(playerData.petInventory || {}) };
    const jellyCount = Number(inventory[RANDOM_BATTLE_CONFIG.VITAMIN_JELLY_ITEM_ID] || 0);

    if (jellyCount <= 0) {
      throw new Error('비타민젤리가 없습니다.');
    }

    const pets = Array.isArray(playerData.pets) ? playerData.pets : [];
    const targetPet = pets.find((pet) => pet.id === petId);
    if (!targetPet) throw new Error('펫을 찾을 수 없습니다.');

    if (targetPet.activeBattleId || targetPet.currentBattleId || targetPet.battleLockId || targetPet.lockedBattleId) {
      throw new Error('배틀 중인 펫에게는 비타민젤리를 사용할 수 없습니다.');
    }

    const nextPets = resetPetBattleFatigueByVitaminJelly({ pets, petId, today });
    const nextInventory = {
      ...inventory,
      [RANDOM_BATTLE_CONFIG.VITAMIN_JELLY_ITEM_ID]: jellyCount - 1,
    };

    transaction.update(playerRef, {
      pets: nextPets,
      petInventory: nextInventory,
    });

    return {
      ...playerData,
      pets: nextPets,
      petInventory: nextInventory,
    };
  });
}

export async function createRandomBattleQueueEntry(classId, playerId, options = {}) {
  assertClassAndPlayer(classId, playerId);

  const playerRef = getPlayerRef(classId, playerId);
  const queueRef = getQueueRef(classId, playerId);
  const today = getTodayString();
  const teamSize = Number(options.teamSize || RANDOM_BATTLE_CONFIG.DEFAULT_RANDOM_1V1_TEAM_SIZE);
  const mode = options.mode || 'random-1v1';

  return await runTransaction(db, async (transaction) => {
    const [playerSnap, queueSnap] = await Promise.all([
      transaction.get(playerRef),
      transaction.get(queueRef),
    ]);

    if (!playerSnap.exists()) throw new Error('플레이어 정보를 찾을 수 없습니다.');

    const queueData = queueSnap.exists() ? queueSnap.data() : null;
    if (isActiveQueueStatus(queueData?.status)) {
      throw new Error('이미 랜덤 대전 대기 중입니다.');
    }

    const playerData = playerSnap.data();
    const lockedPetIds = Array.isArray(options.lockedPetIds) ? options.lockedPetIds : [];
    const resolvedTeam = resolveRandomBattleTeam({
      player: playerData,
      today,
      lockedPetIds,
      teamSize,
    });

    if (!resolvedTeam.isComplete) {
      throw new Error(`출전 가능한 펫이 ${teamSize}마리 필요합니다. 부족한 수: ${resolvedTeam.missingCount}마리`);
    }

    const queueStartedAtMs = Date.now();
    const lockedTeam = resolvedTeam.team.map(snapshotPetForRandomQueue);

    const queuePayload = {
      playerId,
      playerName: playerData.name || auth.currentUser?.displayName || '플레이어',
      authUid: playerData.authUid || auth.currentUser?.uid || null,
      mode,
      status: 'waiting',
      teamSize,
      lockedTeam,
      lockedPetIds: resolvedTeam.petIds,
      matchLevel: resolvedTeam.matchLevel,
      today,
      queueStartedAtMs,
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
    });

    return {
      queueId: playerId,
      ...queuePayload,
      queuedAt: null,
    };
  });
}

export async function cancelRandomBattleQueueEntry(classId, playerId, reason = 'cancelled_by_player') {
  assertClassAndPlayer(classId, playerId);

  const playerRef = getPlayerRef(classId, playerId);
  const queueRef = getQueueRef(classId, playerId);

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

    transaction.update(playerRef, {
      randomBattleQueueStatus: deleteField(),
      randomBattleQueuedAt: deleteField(),
      randomBattleLockedPetIds: deleteField(),
      randomBattleMatchLevel: deleteField(),
    });

    return true;
  });
}

export async function consumeRandomBattleFatigueForPets(classId, playerId, petIds, options = {}) {
  assertClassAndPlayer(classId, playerId);
  if (!Array.isArray(petIds) || petIds.length === 0) {
    throw new Error('대전 횟수를 차감할 펫 정보가 없습니다.');
  }

  const playerRef = getPlayerRef(classId, playerId);
  const today = options.today || getTodayString();

  return await runTransaction(db, async (transaction) => {
    const playerSnap = await transaction.get(playerRef);
    if (!playerSnap.exists()) throw new Error('플레이어 정보를 찾을 수 없습니다.');

    const playerData = playerSnap.data();
    const pets = Array.isArray(playerData.pets) ? playerData.pets : [];
    const nextPets = applyBattleFatigueToPets({ pets, petIds, today });

    transaction.update(playerRef, { pets: nextPets });

    return {
      ...playerData,
      pets: nextPets,
    };
  });
}

export async function confirmRandomBattleEntrance(classId, playerId) {
  assertClassAndPlayer(classId, playerId);

  const queueRef = getQueueRef(classId, playerId);

  return await runTransaction(db, async (transaction) => {
    const queueSnap = await transaction.get(queueRef);
    if (!queueSnap.exists()) throw new Error('랜덤 대전 큐 정보를 찾을 수 없습니다.');

    const queueData = queueSnap.data();
    if (queueData.status !== 'matched') {
      throw new Error('아직 입장 가능한 매칭 상태가 아닙니다.');
    }

    transaction.set(queueRef, {
      status: 'entering',
      entrantConfirmedAt: serverTimestamp(),
    }, { merge: true });

    return {
      id: queueSnap.id,
      ...queueData,
      status: 'entering',
    };
  });
}
