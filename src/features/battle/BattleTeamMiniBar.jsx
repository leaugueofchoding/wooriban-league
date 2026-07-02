// src/features/battle/BattleTeamMiniBar.jsx
// M32_SIDE_PANEL_HEIGHT_THRESHOLD_PATCH: 태블릿 가로 화면은 높이 1000px 이하까지 오른쪽 문제 패널을 사용합니다.

import React from 'react';
import styled from 'styled-components';

const TeamMiniBarWrapper = styled.div`
    position: absolute;
    z-index: 6;
    display: flex;
    gap: 7px;
    padding: 6px 8px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.82);
    border: 2px solid rgba(255, 255, 255, 0.95);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.14);
    backdrop-filter: blur(4px);
    /* M14_BATTLE_TEAM_MINIBAR_POSITION_PATCH
       M14B_MINIBAR_OVERLAP_FIX_PATCH
       M14D_RESTORE_MY_QUEUE_MOVE_OPPONENT_QUEUE_PATCH
       M14E_OPPONENT_QUEUE_ALIGN_PATCH
       M14C_MINIBAR_UPPER_GAP_FIX_PATCH
       상태창 카드와 겹치지 않도록 카드 옆 빈 공간으로 더 밀어냅니다.
       - 내 팀: 내 상태창 오른쪽 바깥
       - 상대 팀: 상대 상태창 왼쪽 바깥
    */
    ${props => props.$isMine ? `
        left: 350px;
        top: 26px;
    ` : `
        right: 350px;
        bottom: 32px;
        flex-direction: row-reverse;
    `}

    @media (max-width: 900px) {
        gap: 5px;
        padding: 5px 6px;

        ${props => props.$isMine ? `
            left: 285px;
            top: 20px;
        ` : `
            right: 280px;
            bottom: 30px;
        `}
    }

    @media (max-width: 640px) {
        ${props => props.$isMine ? `
            left: 12px;
            top: 104px;
        ` : `
            right: 12px;
            bottom: 78px;
        `}
    }

    /* M27_TABLET_TEAM_MINIBAR_OVERLAP_FIX_PATCH
       낮은 높이의 가로 태블릿에서는 대기열 미니바를 세로형으로 가장자리에 붙여
       출전 펫, 상태 오라, 타이머와 겹치는 문제를 줄입니다. */
    @media (orientation: landscape) and (max-height: 1000px) and (min-width: 920px) {
        gap: 4px;
        padding: 4px;
        border-width: 1px;
        background: rgba(255, 255, 255, 0.74);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);

        ${props => props.$isMine ? `
            left: 12px;
            top: 92px;
            flex-direction: column;
        ` : `
            right: 12px;
            bottom: 92px;
            flex-direction: column-reverse;
        `}
    }

    @media (orientation: landscape) and (max-height: 620px) and (min-width: 920px) {
        ${props => props.$isMine ? `
            left: 10px;
            top: 82px;
        ` : `
            right: 10px;
            bottom: 82px;
        `}
    }
    /* M28_RESTORE_MINIBAR_SIZE_PATCH
       문제 영역을 다시 아래로 내렸으므로, 대기열 미니바는 너무 작게 세로 배치하지 않고
       적당한 크기의 가로형으로 복구합니다. */
    @media (orientation: landscape) and (max-height: 1000px) and (min-width: 920px) {
        gap: 6px;
        padding: 5px 7px;
        border-width: 2px;
        background: rgba(255, 255, 255, 0.82);

        ${props => props.$isMine ? `
            left: 220px;
            top: 24px;
            flex-direction: row;
        ` : `
            right: 220px;
            bottom: 28px;
            flex-direction: row-reverse;
        `}
    }

    @media (orientation: landscape) and (max-height: 620px) and (min-width: 920px) {
        ${props => props.$isMine ? `
            left: 200px;
            top: 22px;
        ` : `
            right: 200px;
            bottom: 24px;
        `}
    }
    /* M29_PORTRAIT_STACKED_MINIBAR_PATCH
       오른쪽 문제 패널 레이아웃에서는 대기열 펫을 주인 초상화 근처에 세로로 쌓습니다.
       - 내 대기열: 내 초상화 아래
       - 상대 대기열: 상대 초상화 위 */
    @media (orientation: landscape) and (max-height: 1000px) and (min-width: 920px) {
        gap: 5px;
        padding: 5px;
        border-width: 2px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.84);
        box-shadow: 0 5px 14px rgba(0, 0, 0, 0.13);

        ${props => props.$isMine ? `
            left: auto;
            right: 8px;
            top: auto;
            bottom: 68px;
            flex-direction: column;
        ` : `
            right: auto;
            left: 8px;
            bottom: auto;
            top: 68px;
            flex-direction: column-reverse;
        `}
    }

    @media (orientation: landscape) and (max-height: 620px) and (min-width: 920px) {
        gap: 4px;
        padding: 4px;

        ${props => props.$isMine ? `
            right: 7px;
            bottom: 62px;
        ` : `
            left: 7px;
            top: 62px;
        `}
    }
    /* M30_MINIBAR_PORTRAIT_NO_OVERLAP_PATCH
       오른쪽 문제 패널 레이아웃에서 대기열 펫이 주인 초상화와 겹치지 않도록 최종 위치 보정.
       - 내 대기열: 왼쪽 위 내 초상화 아래
       - 상대 대기열: 오른쪽 아래 상대 초상화 위 */
    @media (orientation: landscape) and (max-height: 1000px) and (min-width: 920px) {
        z-index: 18;
        gap: 5px;
        padding: 5px;
        border-width: 2px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.86);
        box-shadow: 0 5px 14px rgba(0, 0, 0, 0.13);

        ${props => props.$isMine ? `
            left: 12px;
            right: auto;
            top: 106px;
            bottom: auto;
            flex-direction: column;
        ` : `
            right: 12px;
            left: auto;
            bottom: 106px;
            top: auto;
            flex-direction: column-reverse;
        `}
    }

    @media (orientation: landscape) and (max-height: 700px) and (min-width: 920px) {
        ${props => props.$isMine ? `
            top: 100px;
        ` : `
            bottom: 100px;
        `}
    }

    @media (orientation: landscape) and (max-height: 620px) and (min-width: 920px) {
        gap: 4px;
        padding: 4px;

        ${props => props.$isMine ? `
            top: 92px;
        ` : `
            bottom: 92px;
        `}
    }`;

const MiniPetSlot = styled.div`
    position: relative;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    padding: 2px;
    background: ${props => props.$active ? 'linear-gradient(135deg, #ffd43b, #ff922b)' : '#f1f3f5'};
    border: 2px solid ${props => props.$active ? '#fff3bf' : '#dee2e6'};
    box-shadow: ${props => props.$active ? '0 0 0 2px rgba(255, 212, 59, 0.45), 0 0 12px rgba(255, 212, 59, 0.8)' : '0 2px 5px rgba(0,0,0,0.12)'};
    opacity: ${props => props.$fainted ? 0.45 : 1};
    transform: ${props => props.$active ? 'translateY(-2px) scale(1.06)' : 'none'};
    transition: all 0.2s ease;

    img {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        object-fit: cover;
        display: block;
        background: white;
        filter: ${props => props.$fainted ? 'grayscale(100%)' : 'none'};
    }

    &::after {
        content: '${props => props.$active ? '●' : ''}';
        position: absolute;
        left: 50%;
        bottom: -10px;
        transform: translateX(-50%);
        font-size: 9px;
        color: #f08c00;
        text-shadow: 0 1px 2px rgba(255,255,255,0.9);
    }

    @media (max-width: 768px) {
        width: 26px;
        height: 30px;
    }

    @media (orientation: landscape) and (max-height: 1000px) and (min-width: 920px) {
        width: 28px;
        height: 28px;
        padding: 1px;
        border-width: 1.5px;
        transform: ${props => props.$active ? 'scale(1.04)' : 'none'};
        box-shadow: ${props => props.$active ? '0 0 0 2px rgba(255, 212, 59, 0.38), 0 0 10px rgba(255, 212, 59, 0.62)' : '0 2px 5px rgba(0,0,0,0.10)'};
    }

    @media (orientation: landscape) and (max-height: 620px) and (min-width: 920px) {
        width: 25px;
        height: 25px;
    }
    @media (orientation: landscape) and (max-height: 1000px) and (min-width: 920px) {
        width: 34px;
        height: 34px;
        padding: 2px;
        border-width: 2px;
        transform: ${props => props.$active ? 'translateY(-2px) scale(1.06)' : 'none'};
        box-shadow: ${props => props.$active ? '0 0 0 2px rgba(255, 212, 59, 0.45), 0 0 12px rgba(255, 212, 59, 0.8)' : '0 2px 5px rgba(0,0,0,0.12)'};
    }

    @media (orientation: landscape) and (max-height: 620px) and (min-width: 920px) {
        width: 31px;
        height: 31px;
    }
    @media (orientation: landscape) and (max-height: 1000px) and (min-width: 920px) {
        width: 34px;
        height: 34px;
        padding: 2px;
        border-width: 2px;
        transform: ${props => props.$active ? 'scale(1.06)' : 'none'};
        box-shadow: ${props => props.$active ? '0 0 0 2px rgba(255, 212, 59, 0.45), 0 0 12px rgba(255, 212, 59, 0.8)' : '0 2px 5px rgba(0,0,0,0.12)'};
    }

    @media (orientation: landscape) and (max-height: 620px) and (min-width: 920px) {
        width: 31px;
        height: 31px;
    }
    /* M30_MINIBAR_SIZE_RESTORE_PATCH */
    @media (orientation: landscape) and (max-height: 1000px) and (min-width: 920px) {
        width: 36px;
        height: 36px;
        padding: 2px;
        border-width: 2px;
        transform: ${props => props.$active ? 'scale(1.06)' : 'none'};
        box-shadow: ${props => props.$active ? '0 0 0 2px rgba(255, 212, 59, 0.45), 0 0 12px rgba(255, 212, 59, 0.8)' : '0 2px 5px rgba(0,0,0,0.12)'};
    }

    @media (orientation: landscape) and (max-height: 620px) and (min-width: 920px) {
        width: 32px;
        height: 32px;
    }`;

const HpMiniBar = styled.div`
    position: absolute;
    left: 50%;
    bottom: -5px;
    transform: translateX(-50%);
    width: 30px;
    height: 4px;
    border-radius: 999px;
    background: #e9ecef;
    overflow: hidden;
    border: 1px solid rgba(0,0,0,0.08);

    span {
        display: block;
        height: 100%;
        width: ${props => props.$percent}%;
        background: ${props => props.$percent > 50 ? '#51cf66' : props.$percent > 25 ? '#ffd43b' : '#ff6b6b'};
    }

    @media (max-width: 768px) {
        width: 20px;
    }

    @media (orientation: landscape) and (max-height: 1000px) and (min-width: 920px) {
        width: 20px;
        height: 3px;
        bottom: -4px;
    }
    @media (orientation: landscape) and (max-height: 1000px) and (min-width: 920px) {
        width: 26px;
        height: 4px;
        bottom: -5px;
    }
    @media (orientation: landscape) and (max-height: 1000px) and (min-width: 920px) {
        width: 26px;
        height: 4px;
        bottom: -5px;
    }
    /* M30_MINIBAR_HP_RESTORE_PATCH */
    @media (orientation: landscape) and (max-height: 1000px) and (min-width: 920px) {
        width: 28px;
        height: 4px;
        bottom: -5px;
    }`;

const getBattleTeam = (info) => {
    // M4_COOKIE_DISPLAY_ACTIVE_PET_PREFER_PATCH
    // 미니바도 active slot에는 최신 info.pet 값을 덮어씌워 표시합니다.
    const rawTeam = Array.isArray(info?.team) && info.team.length > 0
        ? info.team
        : Array.isArray(info?.pets) && info.pets.length > 0
            ? info.pets
            : info?.pet
                ? [info.pet]
                : [];

    if (!info?.pet || rawTeam.length === 0) return rawTeam;

    const activeIndex = getActiveIndex(info, rawTeam);
    const activeId = info.activePetId || rawTeam[activeIndex]?.id || null;

    return rawTeam.map((pet, index) => {
        const isActiveSlot = index === activeIndex || (activeId && pet?.id === activeId);
        if (!isActiveSlot) return pet;

        return {
            ...pet,
            ...info.pet,
            status: { ...(info.pet.status || pet?.status || {}) },
        };
    });
};

const getActiveIndex = (info, team) => {
    if (!team.length) return 0;

    if (info?.activePetId) {
        const indexById = team.findIndex(pet => pet?.id === info.activePetId);
        if (indexById >= 0) return indexById;
    }

    const rawIndex = Number(info?.activePetIndex ?? 0);
    if (!Number.isInteger(rawIndex)) return 0;

    return Math.min(Math.max(rawIndex, 0), team.length - 1);
};

export default function BattleTeamMiniBar({
    isMine,
    info,
    getPetImageSrc,
}) {
    const team = getBattleTeam(info);
    const activeIndex = getActiveIndex(info, team);

    // 1마리 배틀에서는 기존 화면을 건드리지 않기 위해 숨깁니다.
    if (team.length <= 1) return null;

    return (
        <TeamMiniBarWrapper $isMine={isMine} aria-label={isMine ? '내 배틀 펫 목록' : '상대 배틀 펫 목록'}>
            {team.map((pet, index) => {
                const active = index === activeIndex;
                const fainted = Number(pet?.hp ?? 0) <= 0;
                const imageSrc = typeof getPetImageSrc === 'function'
                    ? getPetImageSrc({ ...info, pet }, isMine)
                    : '';

                const hpPercent = pet?.maxHp
                    ? Math.max(0, Math.min(100, Math.round((Number(pet.hp || 0) / Number(pet.maxHp || 1)) * 100)))
                    : 0;

                return (
                    <MiniPetSlot
                        key={pet?.id || `${pet?.name || 'pet'}-${index}`}
                        $active={active}
                        $fainted={fainted}
                        title={`${active ? '선발' : '대기'}: ${pet?.name || '펫'} / HP ${pet?.hp ?? 0}/${pet?.maxHp ?? 0}`}
                    >
                        {imageSrc && <img src={imageSrc} alt={pet?.name || '펫'} />}
                        <HpMiniBar $percent={hpPercent}>
                            <span />
                        </HpMiniBar>
                    </MiniPetSlot>
                );
            })}
        </TeamMiniBarWrapper>
    );
}
