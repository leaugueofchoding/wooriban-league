import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { getActiveGoals, donatePointsToGoal } from '../api/firebase';
import { useNavigate, Link } from 'react-router-dom';
import baseAvatar from '../assets/base-avatar.png';

// --- Styled Components ---

const DashboardWrapper = styled.div`
  max-width: 1000px;
  margin: 2rem auto;
  padding: 2rem;
`;

const TopGrid = styled.div`
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 1.5rem;
    margin-bottom: 2.5rem;
`;

const Section = styled.section`
  margin-bottom: 2.5rem;
  padding: 1.5rem;
  background-color: #f9f9f9;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
`;

const TitleWrapper = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid #eee;
  padding-bottom: 0.5rem;
  margin-bottom: 1.5rem;
`;

const Title = styled.h2`
  margin: 0;
`;

const ViewAllLink = styled(Link)`
  font-size: 0.9rem;
  font-weight: bold;
  color: #007bff;
  text-decoration: none;
  &:hover {
    text-decoration: underline;
  }
`;

const MyInfoCard = styled.div`
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 1.5rem;
  background-color: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 6px 16px rgba(0,0,0,0.12);
  }
`;

const AvatarDisplay = styled.div`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  position: relative;
  overflow: hidden;
  border: 3px solid #007bff;
  flex-shrink: 0;
`;

const PartImage = styled.img`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
`;

const InfoText = styled.div`
  text-align: left;
  flex-grow: 1;
`;

const WelcomeMessage = styled.p`
  margin: 0;
  font-size: 1.5rem;
  font-weight: bold;
`;

const PointDisplay = styled.p`
  margin: 0.25rem 0 0;
  font-size: 1.2rem;
  font-weight: bold;
  color: #28a745;
`;

const ShortcutsPanel = styled.div`
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.5rem;
    background-color: #fff;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
`;

const ShortcutButton = styled(Link)`
    display: block;
    width: 100%;
    padding: 1rem;
    font-size: 1.1rem;
    font-weight: bold;
    color: white;
    background-color: ${props => props.color || '#007bff'};
    border: none;
    border-radius: 8px;
    text-align: center;
    text-decoration: none;
    transition: opacity 0.2s;
    &:hover {
        opacity: 0.85;
    }
`;

const WidgetGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
`;

const MissionCard = styled.div`
  background-color: #fff;
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  cursor: ${props => props.$isClickable ? 'pointer' : 'default'};
  transition: all 0.2s ease-in-out;
  &:hover {
    transform: ${props => props.$isClickable ? 'translateY(-3px)' : 'none'};
    box-shadow: ${props => props.$isClickable ? '0 4px 8px rgba(0,0,0,0.08)' : '0 2px 4px rgba(0,0,0,0.05)'};
  }
`;

const MissionTitle = styled.h4`
  margin: 0 0 0.5rem 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const MissionReward = styled.p`
  margin: 0;
  font-weight: bold;
  color: #28a745;
`;

const ThermometerWrapper = styled.div`
  width: 100%;
`;

const GoalTitle = styled.h3`
  text-align: center;
  font-size: 1.5rem;
  margin-bottom: 1rem;
`;

const ProgressBarContainer = styled.div`
  width: 100%;
  height: 40px;
  background-color: #e9ecef;
  border-radius: 20px;
  overflow: hidden;
  border: 2px solid #fff;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);
`;

const ProgressBar = styled.div`
  width: ${props => props.percent}%;
  height: 100%;
  background: linear-gradient(90deg, #ffc107, #fd7e14);
  transition: width 0.5s ease-in-out;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: 1rem;
`;

const PointStatus = styled.p`
  text-align: right;
  font-weight: bold;
  margin-top: 0.5rem;
  color: #495057;
`;

const DonationArea = styled.div`
  margin-top: 1.5rem;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
`;

const DonationInput = styled.input`
  width: 150px;
  padding: 0.75rem;
  border: 1px solid #ced4da;
  border-radius: 8px;
  font-size: 1rem;
  text-align: center;
`;

const DonationButton = styled.button`
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  background-color: #28a745;
  color: white;
  font-weight: bold;
  font-size: 1rem;
  cursor: pointer;
  &:disabled {
    background-color: #6c757d;
  }
`;

function DashboardPage() {
    const { players, currentUser, fetchInitialData, avatarParts, missions } = useLeagueStore();
    const [activeGoal, setActiveGoal] = useState(null);
    const [donationAmount, setDonationAmount] = useState('');
    const navigate = useNavigate();

    const myPlayerData = useMemo(() => {
        return players.find(p => p.authUid === currentUser?.uid);
    }, [players, currentUser]);

    useEffect(() => {
        const fetchGoals = async () => {
            const goals = await getActiveGoals();
            if (goals.length > 0) {
                setActiveGoal(goals[0]);
            }
        };
        fetchGoals();
    }, []);

    const myAvatarUrls = useMemo(() => {
        if (!myPlayerData?.avatarConfig || !avatarParts.length) return [];

        const partsByCategory = avatarParts.reduce((acc, part) => {
            if (!acc[part.category]) acc[part.category] = [];
            acc[part.category].push(part);
            return acc;
        }, {});

        const RENDER_ORDER = ['shoes', 'bottom', 'top', 'hair', 'face', 'eyes', 'nose', 'mouth', 'accessory'];
        const urls = [];
        RENDER_ORDER.forEach(category => {
            const partId = myPlayerData.avatarConfig[category];
            if (partId) {
                const part = partsByCategory[category]?.find(p => p.id === partId);
                if (part) urls.push(part.src);
            }
        });
        return urls;
    }, [myPlayerData, avatarParts]);

    const handleDonate = async () => {
        if (!myPlayerData) return alert('플레이어 정보를 불러올 수 없습니다.');
        const amount = Number(donationAmount);
        if (amount <= 0) return alert('기부할 포인트를 올바르게 입력해주세요.');
        if (myPlayerData.points < amount) return alert('포인트가 부족합니다.');

        if (window.confirm(`${amount}P를 '${activeGoal.title}' 목표에 기부하시겠습니까?`)) {
            try {
                await donatePointsToGoal(myPlayerData.id, activeGoal.id, amount);
                alert('포인트를 기부했습니다! 고맙습니다!');
                setDonationAmount('');
                const goals = await getActiveGoals();
                setActiveGoal(goals[0]);
                fetchInitialData();
            } catch (error) {
                alert(`기부 실패: ${error.message}`);
            }
        }
    };

    const progressPercent = activeGoal ? (activeGoal.currentPoints / activeGoal.targetPoints) * 100 : 0;

    const recentMissions = useMemo(() => missions.slice(0, 4), [missions]);

    const isRecorderOrAdmin = myPlayerData?.role === 'recorder' || myPlayerData?.role === 'admin';

    return (
        <DashboardWrapper>
            {myPlayerData ? (
                <TopGrid>
                    <MyInfoCard onClick={() => navigate(`/profile`)}>
                        <AvatarDisplay>
                            <PartImage src={baseAvatar} alt="기본 아바타" />
                            {myAvatarUrls.map(src => <PartImage key={src} src={src} />)}
                        </AvatarDisplay>
                        <InfoText>
                            <WelcomeMessage>{myPlayerData.name}님, 환영합니다!</WelcomeMessage>
                            <PointDisplay>💰 {myPlayerData.points?.toLocaleString() || 0} P</PointDisplay>
                        </InfoText>
                    </MyInfoCard>
                    <ShortcutsPanel>
                        <ShortcutButton to="/shop" color="#28a745">🏪 상점 가기</ShortcutButton>
                        <ShortcutButton to="/missions" color="#17a2b8">📜 미션 확인</ShortcutButton>
                    </ShortcutsPanel>
                </TopGrid>
            ) : (<h1>대시보드</h1>)}

            <Section>
                <TitleWrapper>
                    <Title>📢 새로운 미션</Title>
                </TitleWrapper>
                {recentMissions.length > 0 ? (
                    <WidgetGrid>
                        {recentMissions.map(mission => (
                            <MissionCard
                                key={mission.id}
                                $isClickable={isRecorderOrAdmin}
                                onClick={() => {
                                    if (isRecorderOrAdmin) {
                                        navigate(`/recorder/${mission.id}`)
                                    }
                                }}
                            >
                                <MissionTitle>{mission.title}</MissionTitle>
                                <MissionReward>💰 {mission.reward} P</MissionReward>
                            </MissionCard>
                        ))}
                    </WidgetGrid>
                ) : (
                    <p>현재 등록된 새로운 미션이 없습니다.</p>
                )}
            </Section>

            <Section>
                <TitleWrapper>
                    <Title>🔥 우리 반 공동 목표! 🔥</Title>
                </TitleWrapper>
                {activeGoal ? (
                    <ThermometerWrapper>
                        <GoalTitle>{activeGoal.title}</GoalTitle>
                        <ProgressBarContainer>
                            <ProgressBar percent={progressPercent}>
                                {Math.floor(progressPercent)}%
                            </ProgressBar>
                        </ProgressBarContainer>
                        <PointStatus>
                            {activeGoal.currentPoints.toLocaleString()} / {activeGoal.targetPoints.toLocaleString()} P
                        </PointStatus>
                        <DonationArea>
                            <DonationInput
                                type="number"
                                value={donationAmount}
                                onChange={e => setDonationAmount(e.target.value)}
                                placeholder="기부할 포인트"
                            />
                            <DonationButton onClick={handleDonate} disabled={!myPlayerData || !donationAmount || Number(donationAmount) <= 0}>
                                기부하기
                            </DonationButton>
                        </DonationArea>
                    </ThermometerWrapper>
                ) : (
                    <p>현재 진행 중인 학급 공동 목표가 없습니다. 선생님께 새로운 목표를 만들어달라고 요청해보세요!</p>
                )}
            </Section>
        </DashboardWrapper>
    );
}

export default DashboardPage;