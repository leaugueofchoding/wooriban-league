import React from 'react';
import styled from 'styled-components';

const ProfileWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem; // 이름과 별 사이 간격
`;

const StarWrapper = styled.span`
  color: #ffc107; // 노란 별
  font-size: 1.1rem;
  
  .purple {
    color: #9c27b0; // 보라 별
  }
`;

function PlayerProfile({ player }) {
    // player 데이터가 없을 경우를 대비한 방어 코드
    if (!player) {
        return <span>선수 정보 없음</span>;
    }

    // 'wins' 수에 따라 별을 계산하는 로직
    const getStars = (wins = 0) => {
        const purpleStars = Math.floor(wins / 5);
        const yellowStars = wins % 5;

        return (
            <>
                {[...Array(purpleStars)].map((_, i) => <span key={`p${i}`} className="purple">★</span>)}
                {[...Array(yellowStars)].map((_, i) => <span key={`y${i}`}>★</span>)}
            </>
        );
    };

    return (
        <ProfileWrapper>
            <span>{player.name} <strong>({player.gender || '미지정'})</strong></span>
            <StarWrapper>
                {getStars(player.wins)}
            </StarWrapper>
        </ProfileWrapper>
    );
}

export default PlayerProfile;