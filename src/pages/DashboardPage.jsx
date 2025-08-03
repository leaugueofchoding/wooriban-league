// src/pages/DashboardPage.jsx

import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { auth, getActiveGoals, donatePointsToGoal } from '../api/firebase';
import { useNavigate, Link } from 'react-router-dom';
import baseAvatar from '../assets/base-avatar.png';
import defaultEmblem from '../assets/default-emblem.png';
import QuizWidget from '../components/QuizWidget';
import confetti from 'canvas-confetti';

// --- Styled Components ---

const DashboardWrapper = styled.div`
  max-width: 1000px;
  margin: 2rem auto;
  padding: 1rem;
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
    grid-template-columns: 1fr;
    gap: 1.5rem;
    margin-bottom: 2.5rem;
`;

const Section = styled.section`
  padding: 1.5rem;
  background-color: #f9f9f9;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const ClickableSection = styled(Link)`
  text-decoration: none;
  color: inherit;
  display: block;
  height: 100%;
  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }
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

const MyInfoCard = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.5rem;
  background-color: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  transition: all 0.2s ease-in-out;
`;

const ProfileLink = styled(Link)`
  display: flex;
  align-items: center;
  gap: 1.5rem;
  text-decoration: none;
  color: inherit;
  flex-grow: 1;

  &:hover {
    /* Optional: add hover effect for profile part */
  }
`;

const ActionButtonsWrapper = styled.div`
  display: flex;
  gap: 1rem;
`;

const VisitButton = styled.button`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    padding: 1rem;
    width: 140px;
    height: 120px;
    border-radius: 12px;
    background-color: #f8f9fa;
    color: #495057;
    font-weight: bold;
    border: 1px solid #dee2e6;
    transition: all 0.2s ease-in-out;
    cursor: pointer;
    font-size: 1rem;

    & > span:first-child {
        font-size: 2rem;
        margin-bottom: 0.5rem;
    }
    
    & > span:last-child {
        line-height: 1.2;
    }

    &:hover {
        background-color: #e9ecef;
        border-color: #adb5bd;
    }
`;

const SuggestionButton = styled(Link)`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center; /* 텍스트 가운데 정렬 추가 */
    text-decoration: none;
    padding: 1rem;
    width: 140px;
    height: 120px;
    border-radius: 12px;
    background-color: #f8f9fa;
    color: #495057;
    font-weight: bold;
    border: 1px solid #dee2e6;
    transition: all 0.2s ease-in-out;
    font-size: 1rem;

    & > span:first-child {
        font-size: 2rem;
        margin-bottom: 0.5rem;
    }

    & > span:last-child {
        line-height: 1.2;
    }

    &:hover {
        background-color: #e9ecef;
        border-color: #adb5bd;
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

const MainGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
  margin-bottom: 2.5rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const Card = styled.div`
  background-color: #fff;
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  position: relative;
  overflow: hidden;
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
const ProgressBar = styled.div` width: ${props => props.$percent}%; height: 100%; background: linear-gradient(90deg, #ffc107, #fd7e14); transition: width 0.5s ease-in-out; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 1rem; `;
const PointStatus = styled.p` text-align: right; font-weight: bold; margin-top: 0.5rem; color: #495057; `;
const DonationArea = styled.div` 
  margin-top: 1.5rem; 
  display: flex; 
  justify-content: center; 
  align-items: center; 
  gap: 1rem; 

  @media (max-width: 768px) {
    flex-direction: column;
  }
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
  &:disabled { background-color: #6c757d; }
`;
const ContributorInfo = styled.p` text-align: center; font-weight: bold; margin-top: 1.5rem; font-size: 1.1rem; color: #ff6f61;`;

const ItemWidgetGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
`;

const RequestButton = styled.button`
    padding: 0.6rem 1.2rem;
    font-size: 0.9rem;
    font-weight: bold;
    color: #fff;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.2s;
    white-space: nowrap;
    margin-left: auto;

    background-color: ${props => {
        if (props.$status === 'approved') return '#007bff';
        if (props.$status === 'pending') return '#6c757d';
        if (props.$status === 'rejected') return '#ffc107'; // [추가] 반려 상태일 때 노란색
        return '#dc3545';
    }};

    color: ${props => (props.$status === 'rejected' ? 'black' : 'white')}; /* [추가] 반려 상태일 때 글자색 */

    &:hover:not(:disabled) {
        background-color: ${props => {
        if (props.$status === 'approved') return '#0056b3';
        if (props.$status === 'pending') return '#5a6268';
        if (props.$status === 'rejected') return '#e0a800'; // [추가] 반려 상태일 때 hover 색
        return '#c82333';
    }};
    }

    &:disabled {
        cursor: not-allowed;
        opacity: 0.8;
    }
`;


function DashboardPage() {
    const { players, missions, matches, teams, registerAsPlayer, submitMissionForApproval, missionSubmissions, avatarParts } = useLeagueStore();
    const currentUser = auth.currentUser;
    const [activeGoal, setActiveGoal] = useState(null);
    const [donationAmount, setDonationAmount] = useState('');
    const navigate = useNavigate();

    const myPlayerData = useMemo(() => {
        if (!currentUser) return null;
        return players.find(p => p.authUid === currentUser.uid);
    }, [players, currentUser]);

    useEffect(() => {
        const fetchGoals = async () => {
            const goals = await getActiveGoals();
            if (goals.length > 0) {
                const goal = goals[0];
                setActiveGoal(goal);
                if (goal.currentPoints >= goal.targetPoints) {
                    confetti({ particleCount: 200, spread: 70, origin: { y: 0.6 } });
                }
            } else {
                setActiveGoal(null);
            }
        };
        if (myPlayerData) {
            fetchGoals();
        }
    }, [myPlayerData]);

    const topContributor = useMemo(() => {
        if (!activeGoal || !activeGoal.contributions || activeGoal.contributions.length === 0) return null;
        const contributionsByName = activeGoal.contributions.reduce((acc, curr) => {
            acc[curr.playerName] = (acc[curr.playerName] || 0) + curr.amount;
            return acc;
        }, {});
        return Object.entries(contributionsByName).reduce((top, current) => current[1] > top[1] ? current : top, ["", 0]);
    }, [activeGoal]);

    const myAvatarUrls = useMemo(() => {
        if (!myPlayerData?.avatarConfig || !avatarParts.length) return [baseAvatar];

        const RENDER_ORDER = ['shoes', 'bottom', 'top', 'hair', 'face', 'eyes', 'nose', 'mouth'];
        const urls = [baseAvatar];
        const config = myPlayerData.avatarConfig;

        RENDER_ORDER.forEach(category => {
            const partId = config[category];
            if (partId) {
                const part = avatarParts.find(p => p.id === partId);
                if (part) urls.push(part.src);
            }
        });

        if (config.accessories) {
            Object.values(config.accessories).forEach(partId => {
                const part = avatarParts.find(p => p.id === partId);
                if (part) urls.push(part.src);
            });
        }

        return Array.from(new Set(urls));
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
                if (goals.length > 0) setActiveGoal(goals[0]);
            } catch (error) {
                alert(`기부 실패: ${error.message}`);
            }
        }
    };

    const shopHighlightItems = useMemo(() => {
        const now = new Date();

        // 1. 할인 중인 아이템 필터링
        const saleItems = avatarParts.filter(part =>
            part.isSale &&
            part.saleStartDate?.toDate() < now &&
            now < part.saleEndDate?.toDate() &&
            part.status !== 'hidden'
        );

        // 2. 신규 아이템 필터링 및 정렬 (createdAt이 있는 아이템만)
        const newItems = avatarParts
            .filter(part => part.createdAt && part.status !== 'hidden')
            .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());

        let highlightItems = [];

        if (saleItems.length > 0) {
            // 할인 아이템이 있으면, 할인템 1개 + 신규템 1개
            highlightItems.push(saleItems[0]);
            const newestItem = newItems.find(item => item.id !== saleItems[0].id);
            if (newestItem) {
                highlightItems.push(newestItem);
            }
        } else {
            // 할인 아이템이 없으면, 신규템 2개
            highlightItems = newItems.slice(0, 2);
        }

        return highlightItems;
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

    const mySubmissions = useMemo(() => {
        if (!myPlayerData) return {};
        const submissionsMap = {};
        missionSubmissions.filter(sub => sub.studentId === myPlayerData.id).forEach(sub => {
            submissionsMap[sub.missionId] = sub.status;
        });
        return submissionsMap;
    }, [missionSubmissions, myPlayerData]);

    // [추가] 미완료 미션 개수 계산
    const uncompletedMissionsCount = useMemo(() => {
        return missions.filter(mission => mySubmissions[mission.id] !== 'approved').length;
    }, [missions, mySubmissions]);

    const recentMissions = useMemo(() => missions.slice(0, 2), [missions]);
    const canSubmitMission = myPlayerData && ['player', 'recorder'].includes(myPlayerData.role);
    const isGoalAchieved = activeGoal && activeGoal.currentPoints >= activeGoal.targetPoints;
    const progressPercent = activeGoal ? Math.min((activeGoal.currentPoints / activeGoal.targetPoints) * 100, 100) : 0;
    const rankIcons = ["🥇", "🥈", "🥉"];
    const handleRandomVisit = () => {
        if (!myPlayerData) return;
        const otherPlayers = players.filter(p => p.id !== myPlayerData.id && p.status !== 'inactive');
        if (otherPlayers.length === 0) {
            alert("방문할 다른 친구가 없습니다.");
            return;
        }
        const randomPlayer = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
        navigate(`/my-room/${randomPlayer.id}`);
    };


    return (
        <DashboardWrapper>
            {currentUser && !myPlayerData && (
                <JoinLeagueButton onClick={registerAsPlayer}>
                    🏆 선수 등록하여 리그 참가하기
                </JoinLeagueButton>
            )}

            {myPlayerData && (
                <TopGrid>
                    <MyInfoCard>
                        <ProfileLink to={`/profile`}>
                            <AvatarDisplay>
                                {myAvatarUrls.map(src => <PartImage key={src} src={src} />)}
                            </AvatarDisplay>
                            <InfoText>
                                <WelcomeMessage>{myPlayerData.name}님, 환영합니다!</WelcomeMessage>
                                <PointDisplay>💰 {myPlayerData.points?.toLocaleString() || 0} P</PointDisplay>
                            </InfoText>
                        </ProfileLink>
                        <ActionButtonsWrapper>
                            <VisitButton onClick={handleRandomVisit}>
                                <span>👫</span>
                                <span>친구집<br />놀러가기</span>
                            </VisitButton>
                            <SuggestionButton to="/suggestions">
                                <span>💌</span>
                                <span>선생님께<br />메시지 보내기</span>
                            </SuggestionButton>
                        </ActionButtonsWrapper>
                    </MyInfoCard>
                </TopGrid>
            )}

            <MainGrid>
                <ClickableSection to="/missions">
                    <Section>
                        {/* [수정] 제목에 미완료 미션 개수 표시 */}
                        <TitleWrapper><Title>📢 새로운 미션 [{uncompletedMissionsCount}개]</Title></TitleWrapper>
                        {recentMissions.length > 0 ? (
                            recentMissions.map(mission => {
                                const submissionStatus = mySubmissions[mission.id];
                                const submissionType = mission.submissionType || ['simple'];
                                const isSimpleMission = submissionType.includes('simple') && submissionType.length === 1;

                                const handleButtonClick = (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();

                                    // 반려되었거나, 글/사진 제출이 필요하면 무조건 미션 페이지로 이동
                                    if (submissionStatus === 'rejected' || !isSimpleMission) {
                                        navigate('/missions');
                                    } else if (isSimpleMission) {
                                        // 단순 미션일 때만 바로 승인 요청
                                        submitMissionForApproval(mission.id, {});
                                    }
                                };

                                return (
                                    <Card key={mission.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <div style={{ flexGrow: 1 }}>
                                            <CardTitle>{mission.title}</CardTitle>
                                            <CardText>💰 {mission.reward} P</CardText>
                                        </div>
                                        {canSubmitMission && (
                                            <RequestButton
                                                onClick={handleButtonClick}
                                                // [수정] 반려 상태일 때는 버튼이 비활성화되지 않도록 조건 변경
                                                disabled={submissionStatus === 'pending' || submissionStatus === 'approved'}
                                                $status={submissionStatus}
                                            >
                                                {submissionStatus === 'pending' && '승인 대기중'}
                                                {submissionStatus === 'approved' && '완료!'}
                                                {submissionStatus === 'rejected' && '다시하기'}
                                                {!submissionStatus && (isSimpleMission ? '다 했어요!' : '제출하러 가기')}
                                            </RequestButton>
                                        )}
                                    </Card>
                                )
                            })
                        ) : (<p>현재 등록된 새로운 미션이 없습니다.</p>)}
                    </Section>
                </ClickableSection>

                <ClickableSection to="/shop">
                    <Section>
                        <TitleWrapper><Title>⭐ 신규/세일 아이템</Title></TitleWrapper>
                        {shopHighlightItems.length > 0 ? (
                            <ItemWidgetGrid>
                                {shopHighlightItems.map(item => (
                                    <Card key={item.id}>
                                        {item.isSale && <SaleBadge>SALE</SaleBadge>}
                                        <ItemImage src={item.src} $category={item.category} />
                                        <CardTitle style={{ textAlign: 'center' }}>{item.displayName || item.id}</CardTitle>
                                        <CardText style={{ textAlign: 'center', color: '#dc3545' }}>💰 {item.salePrice} P</CardText>
                                    </Card>
                                ))}
                            </ItemWidgetGrid>
                        ) : (<p>현재 할인 중인 아이템이 없습니다.</p>)}
                    </Section>
                </ClickableSection>

                <ClickableSection to="/league">
                    <Section>
                        <TitleWrapper><Title>🏆 실시간 리그 순위</Title></TitleWrapper>
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
                </ClickableSection>

                <Section>
                    <TitleWrapper><Title>🧠 오늘의 퀴즈</Title></TitleWrapper>
                    <QuizWidget />
                </Section>
            </MainGrid>

            {myPlayerData && (
                <Section style={{ marginBottom: 0 }}>
                    <TitleWrapper><Title>🔥 우리 반 공동 목표! 🔥</Title></TitleWrapper>
                    {activeGoal ? (
                        <ThermometerWrapper>
                            <GoalTitle>{activeGoal.title}</GoalTitle>
                            <ProgressBarContainer>
                                <ProgressBar $percent={progressPercent}>
                                    {isGoalAchieved ? "목표 달성! 🎉" : `${Math.floor(progressPercent)}%`}
                                </ProgressBar>
                            </ProgressBarContainer>
                            <PointStatus>
                                {activeGoal.currentPoints.toLocaleString()} / {activeGoal.targetPoints.toLocaleString()} P
                            </PointStatus>
                            {topContributor && topContributor[0] && (
                                <ContributorInfo>
                                    최고 기여자 👑: {topContributor[0]} ({topContributor[1].toLocaleString()}P)
                                </ContributorInfo>
                            )}
                            <DonationArea>
                                <DonationInput type="number" value={donationAmount} onChange={e => setDonationAmount(e.target.value)} placeholder="기부할 포인트" disabled={isGoalAchieved} />
                                <DonationButton onClick={handleDonate} disabled={!myPlayerData || !donationAmount || Number(donationAmount) <= 0 || isGoalAchieved}>
                                    {isGoalAchieved ? "달성 완료!" : "기부하기"}
                                </DonationButton>
                            </DonationArea>
                        </ThermometerWrapper>
                    ) : (
                        <p>현재 진행 중인 학급 공동 목표가 없습니다. 선생님께 새로운 목표를 만들어달라고 요청해보세요!</p>
                    )}
                </Section>
            )}
        </DashboardWrapper>
    );
}

export default DashboardPage;