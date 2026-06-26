// src/features/battle/BattleTeamMiniBar.jsx

import React from 'react';
import styled, { keyframes, css } from 'styled-components';

const activePetPulse = keyframes`
    0% {
        transform: translateY(0) scale(0.96);
        box-shadow: 0 0 0 0 rgba(255, 212, 59, 0.8), 0 2px 5px rgba(0,0,0,0.12);
    }
    45% {
        transform: translateY(-5px) scale(1.16);
        box-shadow: 0 0 0 7px rgba(255, 212, 59, 0.28), 0 0 18px rgba(255, 212, 59, 0.95);
    }
    100% {
        transform: translateY(-2px) scale(1.06);
        box-shadow: 0 0 0 2px rgba(255, 212, 59, 0.45), 0 0 12px rgba(255, 212, 59, 0.8);
    }
`;

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

    ${props => props.$isMine ? `
        left: 18px;
        bottom: 18px;
    ` : `
        right: 18px;
        top: 18px;
        flex-direction: row-reverse;
    `}

    @media (max-width: 768px) {
        gap: 5px;
        padding: 5px 6px;

        ${props => props.$isMine ? `
            left: 10px;
            bottom: 10px;
        ` : `
            right: 10px;
            top: 10px;
        `}
    }
`;

const MiniPetSlot = styled.div`
    position: relative;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    padding: 2px;
    background: ${props => props.$active ? 'linear-gradient(135deg, #ffd43b, #ff922b)' : '#f1f3f5'};
    border: 2px solid ${props => props.$active ? '#fff3bf' : '#dee2e6'};
    box-shadow: ${props => props.$active ? '0 0 0 2px rgba(255, 212, 59, 0.45), 0 0 12px rgba(255, 212, 59, 0.8)' : '0 2px 5px rgba(0,0,0,0.12)'};
    opacity: ${props => props.$fainted ? 0.45 : 1};
    transform: ${props => props.$active ? 'translateY(-2px) scale(1.06)' : 'none'};
    transition: all 0.2s ease;
    animation: ${props => props.$active ? css`${activePetPulse} 0.75s ease-out` : 'none'};

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
        content: '${props => props.$active ? '출전' : ''}';
        position: absolute;
        left: 50%;
        bottom: -16px;
        transform: translateX(-50%);
        min-width: 26px;
        padding: 1px 5px;
        border-radius: 999px;
        background: rgba(255, 243, 191, 0.96);
        border: ${props => props.$active ? '1px solid #ffd43b' : '0'};
        font-size: 9px;
        line-height: 1.2;
        color: #f08c00;
        font-weight: 900;
        text-align: center;
        text-shadow: 0 1px 2px rgba(255,255,255,0.9);
        pointer-events: none;
        opacity: ${props => props.$active ? 1 : 0};
    }

    @media (max-width: 768px) {
        width: 34px;
        height: 34px;

        &::after {
            bottom: -14px;
            min-width: 22px;
            padding: 1px 4px;
            font-size: 8px;
        }
    }
`;

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
        width: 24px;
    }
`;

const FaintedBadge = styled.span`
    position: absolute;
    inset: 50% auto auto 50%;
    transform: translate(-50%, -50%) rotate(-12deg);
    padding: 2px 4px;
    border-radius: 6px;
    background: rgba(33, 37, 41, 0.78);
    color: white;
    font-size: 8px;
    font-weight: 900;
    line-height: 1;
    pointer-events: none;
`;

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

const getSlotStateLabel = ({ active, fainted }) => {
    if (active && fainted) return '현재 출전 중이지만 쓰러진 펫';
    if (active) return '현재 출전 중';
    if (fainted) return '쓰러짐';
    return '대기 중';
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
        <TeamMiniBarWrapper
            $isMine={isMine}
            aria-label={isMine ? '내 배틀 펫 목록' : '상대 배틀 펫 목록'}
            role="list"
        >
            {team.map((pet, index) => {
                const active = index === activeIndex;
                const fainted = Number(pet?.hp ?? 0) <= 0;
                const imageSrc = typeof getPetImageSrc === 'function'
                    ? getPetImageSrc({ ...info, pet }, isMine)
                    : '';

                const hpPercent = pet?.maxHp
                    ? Math.max(0, Math.min(100, Math.round((Number(pet.hp || 0) / Number(pet.maxHp || 1)) * 100)))
                    : 0;

                const stateLabel = getSlotStateLabel({ active, fainted });
                const petName = pet?.name || '펫';
                const hpText = `HP ${pet?.hp ?? 0}/${pet?.maxHp ?? 0}`;

                return (
                    <MiniPetSlot
                        key={pet?.id || `${petName}-${index}`}
                        $active={active}
                        $fainted={fainted}
                        title={`${stateLabel}: ${petName} / ${hpText}`}
                        aria-label={`${stateLabel}: ${petName}, ${hpText}`}
                        role="listitem"
                    >
                        {imageSrc && <img src={imageSrc} alt={petName} />}
                        {fainted && <FaintedBadge>기절</FaintedBadge>}
                        <HpMiniBar $percent={hpPercent}>
                            <span />
                        </HpMiniBar>
                    </MiniPetSlot>
                );
            })}
        </TeamMiniBarWrapper>
    );
}
