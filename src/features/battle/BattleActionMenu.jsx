// src/features/battle/BattleActionMenu.jsx
// M5_MANUAL_SWITCH_FIX_V2

import React from 'react';

/**
 * 배틀 행동 메뉴
 *
 * 수동 교체 규칙:
 * - showActionMenu일 때만 표시
 * - 공격권이 있고 아직 attackerAction을 선택하지 않았을 때만 표시
 * - 교체는 한 턴을 소모
 */
export default function BattleActionMenu({
    isStunned,
    isStaggered,
    isFrozen,
    isBound,
    showActionMenu,
    showDefenseMenu,
    actionSubMenu,
    setActionSubMenu,
    myEquippedSkills,
    myInfo,
    usableItems,
    getSkillCost,
    handleActionSelect,
    handleUseItem,
    switchablePets = [],
    handleManualSwitch,
    DEFENSE_ACTIONS,
    ActionMenuComponent,
    MenuItemComponent,
}) {
    const canSwitch = showActionMenu && Array.isArray(switchablePets) && switchablePets.length > 0;
    const isActionBlockedByCc = !!(isStunned || isStaggered || isFrozen);
    const ccBlockMeta = isFrozen
        ? {
            icon: '❄️',
            title: '빙결 상태!',
            detail: '얼어붙어 방어 행동을 할 수 없습니다. 무방비 상태로 공격을 받습니다.',
            color: '#1864ab',
            background: '#e7f5ff',
            border: '#74c0fc',
        }
        : isStaggered
            ? {
                icon: '⚡',
                title: '경직 상태!',
                detail: '몸이 굳어 행동을 고를 수 없습니다. 자동으로 웅크림 판정이 되어 피해를 줄여 받습니다.',
                color: '#e67700',
                background: '#fff9db',
                border: '#ffd43b',
            }
            : {
                icon: '💫',
                title: '기절 상태!',
                detail: '정신을 차리지 못해 방어 행동을 할 수 없습니다. 무방비 상태로 공격을 받습니다.',
                color: '#c92a2a',
                background: '#fff5f5',
                border: '#ffc9c9',
            };

    return (
        <ActionMenuComponent>
            {/* M11_CC_DEFENSE_MENU_BLOCK */}
            {isActionBlockedByCc && showDefenseMenu && (
                <div
                    style={{
                        textAlign: 'center',
                        marginTop: '20px',
                        gridColumn: 'span 2',
                        padding: '0.9rem',
                        borderRadius: '16px',
                        background: ccBlockMeta.background,
                        border: `2px solid ${ccBlockMeta.border}`,
                        color: ccBlockMeta.color,
                        fontWeight: 900,
                        lineHeight: 1.55,
                    }}
                >
                    <p style={{ margin: 0, fontSize: '1.18rem' }}>
                        {ccBlockMeta.icon} {ccBlockMeta.title}
                    </p>
                    <p style={{ margin: '0.35rem 0 0', fontSize: '0.9rem' }}>
                        {ccBlockMeta.detail}
                    </p>
                </div>
            )}

            {!isActionBlockedByCc && (
                <>
                    {showActionMenu && (
                        !actionSubMenu ? (
                            <>
                                <MenuItemComponent onClick={() => handleActionSelect('TACKLE')}>
                                    기본 공격
                                </MenuItemComponent>

                                <MenuItemComponent onClick={() => setActionSubMenu('skills')}>
                                    특수 공격
                                </MenuItemComponent>

                                <MenuItemComponent
                                    onClick={() => setActionSubMenu('items')}
                                    style={{
                                        backgroundColor: '#e2f0d9',
                                        borderColor: '#51cf66',
                                        color: '#2b8a3e'
                                    }}
                                >
                                    🎒 간식 가방
                                </MenuItemComponent>

                                {canSwitch && (
                                    <MenuItemComponent
                                        onClick={() => setActionSubMenu('switch')}
                                        style={{
                                            backgroundColor: '#e7f5ff',
                                            borderColor: '#339af0',
                                            color: '#1864ab'
                                        }}
                                    >
                                        🔁 펫 교체
                                    </MenuItemComponent>
                                )}
                            </>
                        ) : actionSubMenu === 'skills' ? (
                            <>
                                {myEquippedSkills.map(skill => (
                                    <MenuItemComponent
                                        key={skill.id}
                                        onClick={() => handleActionSelect(skill.id)}
                                        disabled={myInfo.pet.sp < getSkillCost(skill)}
                                    >
                                        {skill.name} ({getSkillCost(skill)}SP)
                                    </MenuItemComponent>
                                ))}
                                <MenuItemComponent onClick={() => setActionSubMenu(null)}>
                                    뒤로가기
                                </MenuItemComponent>
                            </>
                        ) : actionSubMenu === 'items' ? (
                            <>
                                {usableItems.length > 0 ? (
                                    usableItems.map(([id, qty]) => (
                                        <MenuItemComponent
                                            key={id}
                                            onClick={() => handleUseItem(id)}
                                            style={{
                                                backgroundColor: '#fff3bf',
                                                borderColor: '#fcc419',
                                                color: '#e67700'
                                            }}
                                        >
                                            두뇌 간식 먹기 ({qty}개)
                                        </MenuItemComponent>
                                    ))
                                ) : (
                                    <MenuItemComponent disabled>
                                        쓸 수 있는 간식이 없습니다.
                                    </MenuItemComponent>
                                )}
                                <MenuItemComponent onClick={() => setActionSubMenu(null)}>
                                    뒤로가기
                                </MenuItemComponent>
                            </>
                        ) : actionSubMenu === 'switch' ? (
                            <>
                                {switchablePets.length > 0 ? (
                                    switchablePets.map(pet => (
                                        <MenuItemComponent
                                            key={pet.id}
                                            onClick={() => handleManualSwitch?.(pet.id)}
                                            style={{
                                                backgroundColor: '#e7f5ff',
                                                borderColor: '#339af0',
                                                color: '#1864ab'
                                            }}
                                        >
                                            🔁 {pet.name}
                                            <br />
                                            <small>Lv.{pet.level} · HP {pet.hp}/{pet.maxHp}</small>
                                        </MenuItemComponent>
                                    ))
                                ) : (
                                    <MenuItemComponent disabled>
                                        교체할 수 있는 펫이 없습니다.
                                    </MenuItemComponent>
                                )}
                                <MenuItemComponent onClick={() => setActionSubMenu(null)}>
                                    뒤로가기
                                </MenuItemComponent>
                            </>
                        ) : null
                    )}

                    {showDefenseMenu && (
                        isBound ? (
                            <div style={{ textAlign: 'center', marginTop: '20px', gridColumn: 'span 2' }}>
                                <p style={{ color: '#2b8a3e', fontWeight: 'bold', fontSize: '1.2rem' }}>
                                    🌿 속박 상태!
                                </p>
                                <p style={{ fontSize: '0.9rem' }}>
                                    덩굴에 묶여 방어/도망 행동을 할 수 없습니다.
                                </p>
                            </div>
                        ) : (
                            Object.entries(DEFENSE_ACTIONS).map(([key, name]) => (
                                <MenuItemComponent
                                    key={key}
                                    onClick={() => handleActionSelect(key)}
                                >
                                    {name}
                                </MenuItemComponent>
                            ))
                        )
                    )}
                </>
            )}
        </ActionMenuComponent>
    );
}
