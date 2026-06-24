// src/features/battle/BattleActionMenu.jsx

import React from 'react';

/**
 * 배틀 행동 메뉴입니다.
 *
 * - 기본 공격
 * - 특수 공격
 * - 간식 가방
 * - 방어/회피/기 모으기/도망치기
 *
 * styled-components는 아직 BattlePage.jsx에 두고 props로 주입합니다.
 * 다음 단계에서 스타일 컴포넌트까지 옮기면 BattlePage.jsx가 더 가벼워집니다.
 */
export default function BattleActionMenu({
    isStunned,
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
    DEFENSE_ACTIONS,
    ActionMenuComponent,
    MenuItemComponent,
}) {
    return (
        <ActionMenuComponent>
            {!isStunned && (
                <>
                    {showActionMenu && (
                        !actionSubMenu ?
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
                            </> :
                            actionSubMenu === 'skills' ?
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
                                </> :
                                actionSubMenu === 'items' ?
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
                                    </> : null
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
