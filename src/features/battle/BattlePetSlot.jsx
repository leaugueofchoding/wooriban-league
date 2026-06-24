// src/features/battle/BattlePetSlot.jsx

import React from 'react';
import BattleStatusEffect from './BattleStatusEffect';
import { DotDamageEffect } from './BattleSkillEffect';

/**
 * 배틀 필드 위에 표시되는 펫 한 칸입니다.
 *
 * styled-components와 keyframes는 아직 BattlePage.jsx에 남겨 둡니다.
 * 다음 단계에서 BattleField/BattlePetSlot 전용 스타일 파일로 더 안전하게 옮길 수 있습니다.
 */
export default function BattlePetSlot({
    isMine,
    info,
    imageSrc,
    hitState,
    animType,
    introActive,
    dotEffect,
    chatEntry,
    WrapperComponent,
    PetContainerComponent,
    PetImageComponent,
    ChatBubbleComponent,
    statusSizeScale = 3.1,
}) {
    if (!info?.pet) return null;

    const targetKey = isMine ? 'my' : 'opponent';
    const dotLeft = isMine ? '45%' : '55%';
    const altText = isMine ? '나의 펫' : '상대 펫';

    return (
        <WrapperComponent>
            <PetContainerComponent
                $isHit={hitState}
                $animType={animType}
                $isMine={isMine}
                $intro={introActive}
            >
                <BattleStatusEffect
                    petStatus={info.pet.status}
                    variant="battle"
                    sizeScale={statusSizeScale}
                />

                {dotEffect?.target === targetKey && (
                    <DotDamageEffect $type={dotEffect.type} $top="15%" $left={dotLeft}>
                        {dotEffect.type === 'burn' ? '🔥' : '☠️'}
                    </DotDamageEffect>
                )}

                {chatEntry && ChatBubbleComponent && (
                    <ChatBubbleComponent $isMine={isMine} $isCorrect={chatEntry.isCorrect}>
                        {chatEntry.text}
                    </ChatBubbleComponent>
                )}

                <PetImageComponent
                    src={imageSrc}
                    alt={altText}
                    $isFainted={info.pet.hp <= 0}
                />
            </PetContainerComponent>
        </WrapperComponent>
    );
}
