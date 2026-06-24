// src/features/battle/BattlePlayerPanel.jsx

import React from 'react';

/**
 * 배틀 필드의 플레이어 정보 패널입니다.
 *
 * - 아바타
 * - 플레이어 이름
 * - 현재 펫 이름/레벨
 * - HP/SP 바
 *
 * styled-components는 아직 BattlePage.jsx에 두고 props로 주입합니다.
 * 이렇게 하면 이번 단계에서는 화면 변화 없이 JSX만 안전하게 줄일 수 있습니다.
 */
export default function BattlePlayerPanel({
    isMine,
    info,
    avatarSourceInfo,
    WrapperComponent,
    AvatarBoxComponent,
    InfoBoxComponent,
    renderHpBar,
    renderSpBar,
}) {
    if (!info?.pet) return null;

    const seedId = info.id || avatarSourceInfo?.id || 'player';
    const snapshotUrl = avatarSourceInfo?.avatarSnapshotUrl || info.avatarSnapshotUrl;
    const photoURL = avatarSourceInfo?.photoURL || info.photoURL;
    const avatarSrc = snapshotUrl || photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${seedId}`;

    const badgeClassName = isMine ? 'mine' : 'opponent';
    const avatarAlt = isMine ? '나의 아바타' : '상대방 아바타';

    return (
        <WrapperComponent>
            <AvatarBoxComponent>
                <div className="avatar-img-frame">
                    <img
                        src={avatarSrc}
                        alt={avatarAlt}
                        className={snapshotUrl ? 'avatar-snapshot' : ''}
                        onError={(e) => {
                            e.target.classList.remove('avatar-snapshot');
                            e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seedId}`;
                        }}
                    />
                </div>
                <div className={`name-badge ${badgeClassName}`}>{info.name}</div>
            </AvatarBoxComponent>

            <InfoBoxComponent>
                <span>{info.pet.name} (Lv.{info.pet.level})</span>
                {renderHpBar(info.pet.hp, info.pet.maxHp)}
                {renderSpBar(info.pet.sp, info.pet.maxSp)}
            </InfoBoxComponent>
        </WrapperComponent>
    );
}
