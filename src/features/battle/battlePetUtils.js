// src/features/battle/battlePetUtils.js

/**
 * 배틀 참가자 데이터에서 전투에 사용할 펫 목록을 읽습니다.
 *
 * 현재 구조:
 * - participant.pet
 *
 * 향후 복수 펫 구조:
 * - participant.team
 * - participant.activePetIndex
 * - participant.activePetId
 *
 * 이 유틸을 거치면 단일 펫/복수 펫 구조를 같은 방식으로 다룰 수 있습니다.
 */

export const getBattleTeam = (participant) => {
    if (!participant) return [];

    if (Array.isArray(participant.team) && participant.team.length > 0) {
        return participant.team;
    }

    if (Array.isArray(participant.pets) && participant.pets.length > 0) {
        return participant.pets;
    }

    if (participant.pet) {
        return [participant.pet];
    }

    return [];
};

export const getActiveBattlePetIndex = (participant) => {
    const team = getBattleTeam(participant);
    if (team.length === 0) return 0;

    if (participant?.activePetId) {
        const indexById = team.findIndex(pet => pet?.id === participant.activePetId);
        if (indexById >= 0) return indexById;
    }

    const rawIndex = Number(participant?.activePetIndex ?? 0);
    if (!Number.isInteger(rawIndex)) return 0;

    return Math.min(Math.max(rawIndex, 0), team.length - 1);
};

export const getActiveBattlePet = (participant) => {
    // M4_COOKIE_DISPLAY_ACTIVE_PET_PREFER_PATCH
    // 전투 중 즉시 갱신되는 현재 펫 스냅샷은 participant.pet입니다.
    // team[activePetIndex]가 한 박자 늦게 갱신되는 경우에도 화면은 최신 pet을 우선 표시해야 합니다.
    const team = getBattleTeam(participant);
    if (team.length === 0 && !participant?.pet) return null;

    const activeIndex = getActiveBattlePetIndex(participant);
    const activeFromTeam = team[activeIndex] || team[0] || null;
    const activeId = participant?.activePetId || activeFromTeam?.id || null;

    if (participant?.pet) {
        const currentPet = {
            ...participant.pet,
            status: { ...(participant.pet.status || {}) },
        };

        if (!activeId || currentPet.id === activeId || currentPet.id === activeFromTeam?.id) {
            return currentPet;
        }
    }

    return activeFromTeam || participant?.pet || null;
};

export const hasBenchBattlePets = (participant) => {
    const team = getBattleTeam(participant);
    const activeIndex = getActiveBattlePetIndex(participant);

    return team.some((pet, index) => index !== activeIndex && Number(pet?.hp ?? 0) > 0);
};

export const normalizeBattleParticipantForBattle = (participant) => {
    // M4_COOKIE_DISPLAY_ACTIVE_PET_PREFER_PATCH
    // pet과 team의 active slot을 표시 단계에서도 한 번 더 맞춰줍니다.
    if (!participant) return participant;

    const team = getBattleTeam(participant);
    const activePetIndex = getActiveBattlePetIndex(participant);
    const activePet = getActiveBattlePet(participant);

    if (!activePet) return participant;

    const syncedTeam = team.length > 0
        ? team.map((pet, index) => (
            index === activePetIndex
                ? { ...activePet, status: { ...(activePet.status || {}) } }
                : { ...pet, status: { ...(pet?.status || {}) } }
        ))
        : [{ ...activePet, status: { ...(activePet.status || {}) } }];

    return {
        ...participant,
        pet: { ...activePet, status: { ...(activePet.status || {}) } },
        team: syncedTeam,
        activePetIndex,
        activePetId: activePet.id || participant.activePetId || null,
    };
};

export const replaceActiveBattlePet = (participant, nextPet) => {
    if (!participant || !nextPet) return participant;

    const team = getBattleTeam(participant);
    const activePetIndex = getActiveBattlePetIndex(participant);

    if (team.length <= 1 && participant.pet) {
        return {
            ...participant,
            pet: nextPet,
        };
    }

    const nextTeam = team.map((pet, index) => (
        index === activePetIndex ? nextPet : pet
    ));

    return {
        ...participant,
        team: nextTeam,
        pet: nextPet,
        activePetIndex,
        activePetId: nextPet.id || participant.activePetId || null,
    };
};
