// src/pages/DashboardPage.jsx

import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { auth, createPlayerFromUser, getActiveGoals, donatePointsToGoal } from '../api/firebase';
import { useNavigate, Link } from 'react-router-dom';
import baseAvatar from '../assets/base-avatar.png';
import defaultEmblem from '../assets/default-emblem.png';

// --- Styled Components ---

const DashboardWrapper = styled.div`
  max-width: 1000px;
  margin: 2rem auto;
  padding: 2rem;
`;

const JoinLeagueButton = styled.button`
  padding: 1rem 2rem;
  font-size: 1.2rem;
  font-weight: bold;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 2rem;
  display: block;
  margin-left: auto;
  margin-right: auto;
  &:hover { background-color: #0056b3; }
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
  &:hover { text-decoration: underline; }
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
    &:hover { opacity: 0.85; }
`;

const MainGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
`;

const Card = styled.div`
  background-color: #fff;
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  position: relative; // [추가] 세일 뱃지 위치 기준
  overflow: hidden; // [추가] 세일 뱃지가 카드를 벗어나지 않도록
`;

const CardTitle = styled.h4`
  margin: 0 0 0.5rem 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const CardText = styled.p`
  margin: 0;
  font-weight: bold;
  color: #28a745;
`;

// [추가] ShopPage에서 가져온 세일 뱃지
const SaleBadge = styled.div`
  position: absolute;
  top: 10px;
  right: -25px;
  background-color: #dc3545;
  color: white;
  padding: 2px 25px;
  font-size: 0.9rem;
  font-weight: bold;
  transform: rotate(45deg);
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
`;

const getBackgroundPosition = (category) => {
    switch (category) {
        case 'bottom': return 'center 75%';
        case 'shoes': return 'center 100%';
        case 'hair': case 'top': case 'eyes': case 'nose': case 'mouth': return 'center 25%';
        default: return 'center 55%';
    }
};
const ItemImage = styled.div`
  width: 80px;
  height: 80px;
  border-radius: 8px;
  border: 1px solid #dee2e6;
  background-image: url(${props => props.src});
  background-size: 200%;
  background-repeat: no-repeat;
  background-color: #e9ecef;
  background-position: ${props => getBackgroundPosition(props.$category)};
  margin: 0 auto;
`;

const RankItem = styled.div`
    display: flex;
    align-items: center;
    padding: 0.5rem 0;
    font-size: 1.1rem;
`;
const Rank = styled.span`
    font-weight: bold;
    width: 40px;
    font-size: 1.2rem;
`;
const Emblem = styled.img`
  width: 30px;
  height: 30px;
  margin-right: 10px;
  border-radius: 50%;
  object-fit: cover;
`;

const ThermometerWrapper = styled.div` width: 100%; `;
const GoalTitle = styled.h3` text-align: center; font-size: 1.5rem; margin-bottom: 1rem; `;
const ProgressBarContainer = styled.div` width: 100%; height: 40px; background-color: #e9ecef; border-radius: 20px; overflow: hidden; border: 2px solid #fff; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);`;
const ProgressBar = styled.div` width: ${props => props.percent}%; height: 100%; background: linear-gradient(90deg, #ffc107, #fd7e14); transition: width 0.5s ease-in-out; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 1rem; `;
const PointStatus = styled.p` text-align: right; font-weight: bold; margin-top: 0.5rem; color: #495057; `;
const DonationArea = styled.div` margin-top: 1.5rem; display: flex; justify-content: center; align-items: center; gap: 1rem; `;
const DonationInput = styled.input` width: 150px; padding: 0.75rem; border: 1px solid #ced4da; border-radius: 8px; font-size: 1rem; text-align: center; `;
const DonationButton = styled.button` padding: 0.75rem 1.5rem; border: none; border-radius: 8px; background-color: #28a745; color: white; font-weight: bold; font-size: 1rem; cursor: pointer; &:disabled { background-color: #6c757d; }`;

// [추가] 신규/세일 아이템을 가로로 배치하기 위한 컨테이너
const ItemWidgetGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
`;

function DashboardPage() {
    const { players, fetchInitialData, avatarParts, missions, matches, teams } = useLeagueStore();
    const currentUser = auth.currentUser;
    const [activeGoal, setActiveGoal] = useState(null);
    const [donationAmount, setDonationAmount] = useState('');
    const navigate = useNavigate();

    const myPlayerData = useMemo(() => {
        if (!currentUser) return null;
        return players.find(p => p.authUid === currentUser.uid);
    }, [players, currentUser]);

    const handleJoinLeague = async () => {
        if (!currentUser) return alert('로그인이 필요합니다.');
        if (window.confirm('리그에 선수로 참가하시겠습니까? 참가 시 기본 정보가 등록됩니다.')) {
            try {
                await createPlayerFromUser(currentUser);
                alert('리그 참가 신청이 완료되었습니다!');
                await fetchInitialData();
            } catch (error) {
                console.error("리그 참가 오류:", error);
                alert('참가 신청 중 오류가 발생했습니다.');
            }
        }
    };

    useEffect(() => {
        const fetchGoals = async () => {
            const goals = await getActiveGoals();
            if (goals.length > 0) setActiveGoal(goals[0]);
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

    const shopHighlightItems = useMemo(() => {
        const saleItems = avatarParts.filter(part => {
            const now = new Date();
            const isCurrentlyOnSale = part.isSale && part.saleStartDate?.toDate() < now && now < part.saleEndDate?.toDate();
            return isCurrentlyOnSale && part.status !== 'hidden';
        });
        return saleItems.slice(0, 2); // [수정] 2개만 표시
    }, [avatarParts]);

    const topRankedTeams = useMemo(() => {
        const completedMatches = matches.filter(m => m.status === '완료');
        let stats = teams.map(team => ({ id: team.id, teamName: team.teamName, emblemUrl: team.emblemUrl || defaultEmblem, points: 0, goalDifference: 0, goalsFor: 0, }));
        completedMatches.forEach(match => {
            const teamA = stats.find(t => t.id === match.teamA_id);
            const teamB = stats.find(t => t.id === match.teamB_id);
            if (!teamA || !teamB) return;
            teamA.goalsFor += match.teamA_score;
            teamB.goalsFor += match.teamB_score;
            teamA.goalDifference += match.teamA_score - match.teamB_score;
            teamB.goalDifference += match.teamB_score - match.teamA_score;
            if (match.teamA_score > match.teamB_score) teamA.points += 3;
            else if (match.teamB_score > match.teamA_score) teamB.points += 3;
            else { teamA.points++; teamB.points++; }
        });
        stats.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
            return b.goalsFor - a.goalsFor;
        });
        return stats.slice(0, 3);
    }, [matches, teams]);

    const recentMissions = useMemo(() => missions.slice(0, 2), [missions]);
    const isRecorderOrAdmin = myPlayerData?.role === 'recorder' || myPlayerData?.role === 'admin';
    const progressPercent = activeGoal ? (activeGoal.currentPoints / activeGoal.targetPoints) * 100 : 0;
    const rankIcons = ["🥇", "🥈", "🥉"];

    return (
        <DashboardWrapper>
            {currentUser && !myPlayerData && (
                <JoinLeagueButton onClick={handleJoinLeague}>
                    🏆 리그 참가하여 선수 등록하기
                </JoinLeagueButton>
            )}

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
            ) : (<h1>우리반 경영 & 리그 포털</h1>)}

            <MainGrid>
                <Section style={{ margin: 0 }}>
                    <TitleWrapper>
                        <Title>📢 새로운 미션</Title>
                        {/* [삭제] 전체 미션 보기 링크 제거 */}
                    </TitleWrapper>
                    {recentMissions.length > 0 ? (
                        recentMissions.map(mission => (
                            <Card as={isRecorderOrAdmin ? Link : 'div'} to={`/recorder/${mission.id}`} key={mission.id}>
                                <CardTitle>{mission.title}</CardTitle>
                                <CardText>💰 {mission.reward} P</CardText>
                            </Card>
                        ))
                    ) : (<p>현재 등록된 새로운 미션이 없습니다.</p>)}
                </Section>

                <Section style={{ margin: 0 }}>
                    <TitleWrapper>
                        <Title>⭐ 신규/세일 아이템</Title>
                        {/* [삭제] 상점 전체보기 링크 제거 */}
                    </TitleWrapper>
                    {shopHighlightItems.length > 0 ? (
                        // [수정] 아이템을 가로로 배치하기 위한 그리드 추가
                        <ItemWidgetGrid>
                            {shopHighlightItems.map(item => (
                                <Card as={Link} to="/shop" key={item.id}>
                                    {/* [수정] 세일 중일 때 뱃지 표시 */}
                                    {item.isSale && <SaleBadge>SALE</SaleBadge>}
                                    <ItemImage src={item.src} $category={item.category} />
                                    <CardTitle style={{ textAlign: 'center' }}>{item.displayName || item.id}</CardTitle>
                                    <CardText style={{ textAlign: 'center', color: '#dc3545' }}>💰 {item.salePrice} P</CardText>
                                </Card>
                            ))}
                        </ItemWidgetGrid>
                    ) : (<p>현재 할인 중인 아이템이 없습니다.</p>)}
                </Section>
                <Section style={{ margin: 0, gridColumn: '1 / -1' }}>
                    <TitleWrapper>
                        <Title>🏆 실시간 리그 순위</Title>
                        {/* [수정] 버튼 텍스트 변경 */}
                        <ViewAllLink to="/league">리그 정보 보기</ViewAllLink>
                    </TitleWrapper>
                    {topRankedTeams.length > 0 ? (
                        topRankedTeams.map((team, index) => (
                            <RankItem key={team.id}>
                                <Rank>{rankIcons[index] || `${index + 1}위`}</Rank>
                                <Emblem src={team.emblemUrl} alt={`${team.teamName} 엠블럼`} />
                                <span>{team.teamName} ({team.points}점)</span>
                            </RankItem>
                        ))
                    ) : (<p>아직 리그 순위가 없습니다.</p>)}
                </Section>
            </MainGrid>

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
                            <DonationInput type="number" value={donationAmount} onChange={e => setDonationAmount(e.target.value)} placeholder="기부할 포인트" />
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