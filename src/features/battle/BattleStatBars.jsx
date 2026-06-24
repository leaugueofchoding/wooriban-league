// src/features/battle/BattleStatBars.jsx

import React from 'react';
import styled from 'styled-components';

const getHpColor = (current, max) => {
    const safeMax = Math.max(1, Number(max) || 1);
    const percentage = (Number(current) / safeMax) * 100;

    if (percentage <= 25) return '#fa5252';
    if (percentage <= 50) return '#fab005';
    return '#20c997';
};

const StatBar = styled.div`
  width: 100%;
  height: 18px;
  background-color: #e9ecef;
  border-radius: 10px;
  overflow: hidden;
  position: relative;
  display: flex;
`;

const BarFill = styled.div`
  width: ${props => props.$percent}%;
  height: 100%;
  background-color: ${props => props.$color};
  transition: width 0.5s ease;
`;

const ShieldFill = styled.div`
  width: ${props => props.$percent}%;
  height: 100%;
  background-color: #845ef7;
  transition: width 0.5s ease;
  border-left: 1px solid rgba(255,255,255,0.6);
  box-shadow: inset 0 0 10px rgba(255,255,255,0.4);
`;

const SpOverflowFill = styled.div`
  width: ${props => props.$percent}%;
  height: 100%;
  background-color: #fcc419;
  transition: width 0.5s ease;
  border-left: 1px solid rgba(255,255,255,0.6);
  box-shadow: inset 0 0 10px rgba(255,255,255,0.6);
`;

const BarText = styled.div`
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: #fff;
  font-weight: 800;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
  pointer-events: none;
`;

export function BattleHpBar({ hp, maxHp }) {
    const currentHp = Number(hp ?? 0);
    const max = Math.max(1, Number(maxHp ?? 1));

    const interstateShield = currentHp > max;
    const displayMax = interstateShield ? currentHp : max;
    const baseHpPercent = interstateShield ? (max / displayMax) * 100 : (currentHp / max) * 100;
    const shieldPercent = interstateShield ? ((currentHp - max) / displayMax) * 100 : 0;

    return (
        <StatBar>
            <BarFill
                $percent={Math.max(0, baseHpPercent)}
                $color={getHpColor(Math.min(currentHp, max), max)}
            />
            {interstateShield && <ShieldFill $percent={shieldPercent} />}
            <BarText>HP: {hp} / {maxHp}</BarText>
        </StatBar>
    );
}

export function BattleSpBar({ sp, maxSp }) {
    const currentSp = Number(sp ?? 0);
    const max = Math.max(1, Number(maxSp ?? 1));

    const hasOverflow = currentSp > max;
    const displayMax = hasOverflow ? currentSp : max;
    const baseSpPercent = hasOverflow ? (max / displayMax) * 100 : (currentSp / max) * 100;
    const overflowPercent = hasOverflow ? ((currentSp - max) / displayMax) * 100 : 0;

    return (
        <StatBar>
            <BarFill $percent={Math.max(0, baseSpPercent)} $color="#007bff" />
            {hasOverflow && <SpOverflowFill $percent={overflowPercent} />}
            <BarText>SP: {sp} / {maxSp}</BarText>
        </StatBar>
    );
}
