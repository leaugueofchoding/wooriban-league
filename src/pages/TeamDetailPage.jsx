// src/pages/TeamDetailPage.jsx

import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { useParams, useNavigate, Link } from 'react-router-dom';
import baseAvatar from '../assets/base-avatar.png';
import { auth, updateTeamInfo, uploadTeamEmblem } from '../api/firebase';

// ▼▼▼ [수정] 아래 presetEmblems 데이터를 수정하여 프리셋 엠블럼을 관리하세요. ▼▼▼
// 1. /src/assets/ 폴더에 emblem_tokkis.png 와 같이 이미지 파일을 추가합니다.
import defaultEmblem from '../assets/default-emblem.png';
import emblemTokki from '../assets/emblem_tokki.png';
import emblemTiger from '../assets/emblem_tiger.png';
import emblemLion from '../assets/emblem_lion.png';
import emblemPig from '../assets/emblem_pig.png';
import emblemDaramjui from '../assets/emblem_daramjui.png';
import emblemCat from '../assets/emblem_cat.png';
import emblemDog from '../assets/emblem_dog.png';


// 2. 아래 목록에 추가합니다.
const presetEmblems = [
    { id: 'tokki', src: emblemTokki },
    { id: 'tiger', src: emblemTiger },
    { id: 'lion', src: emblemLion },
    { id: 'pig', src: emblemPig },
    { id: 'daramjui', src: emblemDaramjui },
    { id: 'cat', src: emblemCat },
    { id: 'dog', src: emblemDog },
    { id: 'default', src: defaultEmblem } // 기본 엠블럼
];
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

// --- Styled Components ---

const Wrapper = styled.div`
  max-width: 900px;
  margin: 2rem auto;
  padding: 2rem;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 2rem;
  margin-bottom: 3rem;
  padding-bottom: 2rem;
  border-bottom: 2px solid #eee;
`;

const TeamEmblem = styled.img`
  width: 120px;
  height: 120px;
  border-radius: 50%;
  object-fit: cover;
  background-color: #fff;
  border: 4px solid #fff;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  cursor: pointer; /* [추가] 클릭 가능하도록 커서 변경 */
`;

const TeamInfo = styled.div`
  flex-grow: 1;
`;

const TeamNameContainer = styled.div`
    display: flex;
    align-items: center;
    gap: 1rem;
`;

const TeamName = styled.h1`
  margin: 0 0 0.5rem 0;
  font-size: 2.5rem;
`;

const Record = styled.p`
  margin: 0;
  font-size: 1.2rem;
  color: #495057;
  font-weight: 500;
`;

const EditButton = styled.button`
    padding: 0.4rem 0.8rem;
    font-size: 0.9rem;
    font-weight: bold;
    background-color: #6c757d;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    &:hover {
        background-color: #5a6268;
    }
`;

const EditForm = styled.div`
    margin-top: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
`;

const InputGroup = styled.div`
    display: flex;
    align-items: center;
    gap: 0.5rem;
`;

const ContentGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
`;

const Section = styled.div`
  background-color: #f8f9fa;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.07);
`;

const SectionTitle = styled.h2`
  margin-top: 0;
  margin-bottom: 1.5rem;
`;

const MemberList = styled.ul`
  list-style: none;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 1.5rem;
`;

const MemberCard = styled(Link)`
  text-align: center;
  text-decoration: none;
  color: inherit;
  display: block;
`;

const AvatarDisplay = styled.div`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background-color: #e9ecef;
  margin: 0 auto 0.5rem;
  position: relative;
  overflow: hidden;
  border: 3px solid #fff;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
`;

const PartImage = styled.img`
  position: absolute; top: 0; left: 0;
  width: 100%; height: 100%; object-fit: contain;
`;

const PlayerName = styled.span`
  font-weight: 500;
  display: block;
`;

const CaptainBadge = styled.span`
    font-size: 1.2rem;
    font-weight: bold;
    color: #007bff;
`;

const ButtonContainer = styled.div`
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-top: 3rem;
`;

const ExitButton = styled.button`
  padding: 0.8rem 2.5rem;
  font-size: 1.1rem;
  font-weight: bold;
  color: #fff;
  background-color: #6c757d;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
  &:hover { background-color: #5a6268; }
`;

const MatchHistoryList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const MatchHistoryItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background-color: #fff;
  border-radius: 6px;
  font-size: 0.9rem;
`;

const MatchResult = styled.span`
    font-weight: bold;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    color: white;
    width: 2.5rem;
    text-align: center;
    background-color: ${props => {
        if (props.result === 'W') return '#28a745';
        if (props.result === 'L') return '#dc3545';
        return '#6c757d';
    }};
`;

const PresetEmblemContainer = styled.div`
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    margin-top: 1rem;
`;

const PresetEmblem = styled.img`
    width: 60px;
    height: 60px;
    border-radius: 50%;
    cursor: pointer;
    border: 3px solid ${props => props.$isSelected ? '#007bff' : 'transparent'};
    transition: border-color 0.2s;
`;

// ▼▼▼ [추가] 엠블럼 확대 모달 스타일 ▼▼▼
const ModalBackground = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
`;

const ModalEmblem = styled.img`
    max-width: 80vw;
    max-height: 80vh;
    border-radius: 50%;
    object-fit: contain;
`;
// ▲▲▲ 여기까지 추가 ▲▲▲

function TeamDetailPage() {
    const { teamId } = useParams();
    const navigate = useNavigate();
    const { teams, players, matches, avatarParts, currentSeason, fetchInitialData } = useLeagueStore();
    const currentUser = auth.currentUser;

    const [isEditing, setIsEditing] = useState(false);
    const [newTeamName, setNewTeamName] = useState('');
    const [newEmblemUrl, setNewEmblemUrl] = useState('');
    const [newEmblemFile, setNewEmblemFile] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isEmblemModalOpen, setIsEmblemModalOpen] = useState(false); // [추가]

    const teamData = useMemo(() => teams.find(t => t.id === teamId), [teams, teamId]);
    const isCaptain = useMemo(() => currentUser && teamData && teamData.captainId === players.find(p => p.authUid === currentUser.uid)?.id, [currentUser, teamData, players]);

    const canEditTeam = useMemo(() => currentSeason?.status !== 'completed', [currentSeason]);

    const teamMembers = useMemo(() => {
        if (!teamData?.members) return [];
        return teamData.members.map(id => {
            const player = players.find(p => p.id === id);
            if (!player) return null;

            const RENDER_ORDER = ['shoes', 'bottom', 'top', 'hair', 'face', 'eyes', 'nose', 'mouth'];
            const urls = [baseAvatar];
            const config = player.avatarConfig || {};

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

            return { ...player, avatarUrls: urls };
        }).filter(Boolean);
    }, [teamData, players, avatarParts]);

    const { teamStats, teamMatches } = useMemo(() => {
        if (!teamData || !currentSeason) return { teamStats: { wins: 0, draws: 0, losses: 0 }, teamMatches: [] };
        const seasonMatches = matches.filter(match =>
            match.seasonId === currentSeason.id &&
            (match.teamA_id === teamId || match.teamB_id === teamId)
        );
        const completedMatches = seasonMatches.filter(m => m.status === '완료');
        const stats = { wins: 0, draws: 0, losses: 0 };
        completedMatches.forEach(match => {
            const isTeamA = match.teamA_id === teamId;
            const myScore = isTeamA ? match.teamA_score : match.teamB_score;
            const opponentScore = isTeamA ? match.teamB_score : match.teamA_score;
            if (myScore > opponentScore) stats.wins++;
            else if (myScore < opponentScore) stats.losses++;
            else stats.draws++;
        });
        return { teamStats: stats, teamMatches: seasonMatches };
    }, [teamData, matches, currentSeason, teamId]);

    const handleEditClick = () => {
        setNewTeamName(teamData.teamName);
        setNewEmblemUrl(teamData.emblemUrl || defaultEmblem);
        setIsEditing(true);
    };

    const handleSave = async () => {
        if (!newTeamName.trim()) return alert('팀 이름을 입력해주세요.');
        setIsSaving(true);
        try {
            let finalEmblemUrl = newEmblemUrl;
            if (newEmblemFile) {
                finalEmblemUrl = await uploadTeamEmblem(teamId, newEmblemFile);
            }
            await updateTeamInfo(teamId, newTeamName, finalEmblemUrl);
            alert('팀 정보가 성공적으로 수정되었습니다.');
            await fetchInitialData();
            setIsEditing(false);
            setNewEmblemFile(null);
        } catch (error) {
            console.error("팀 정보 저장 오류:", error);
            alert('정보 저장 중 오류가 발생했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleGoBack = () => {
        navigate('/league', { state: { defaultTab: 'teamInfo' } });
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setNewEmblemFile(file);
            setNewEmblemUrl(URL.createObjectURL(file));
        }
    }

    if (!teamData) {
        return (
            <Wrapper>
                <h1>팀 정보를 찾을 수 없습니다.</h1>
                <ExitButton onClick={handleGoBack}>팀 목록으로</ExitButton>
            </Wrapper>
        );
    }

    return (
        <>
            <Wrapper>
                <Header>
                    <TeamEmblem
                        src={isEditing ? newEmblemUrl : (teamData.emblemUrl || defaultEmblem)}
                        alt={`${teamData.teamName} 엠블럼`}
                        onClick={() => setIsEmblemModalOpen(true)}
                    />
                    <TeamInfo>
                        <TeamNameContainer>
                            <TeamName>{teamData.teamName}</TeamName>
                            {isCaptain && canEditTeam && !isEditing && (
                                <EditButton onClick={handleEditClick}>팀 정보 수정</EditButton>
                            )}
                        </TeamNameContainer>
                        <Record>시즌 기록: {teamStats.wins}승 {teamStats.draws}무 {teamStats.losses}패</Record>

                        {isEditing && (
                            <EditForm>
                                <InputGroup>
                                    <label htmlFor="teamName">팀 이름:</label>
                                    <input id="teamName" type="text" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} />
                                </InputGroup>
                                <InputGroup>
                                    <label htmlFor="emblem">엠블럼 직접 올리기:</label>
                                    <input id="emblem" type="file" accept="image/*" onChange={handleFileChange} />
                                </InputGroup>
                                <div>
                                    <label>프리셋에서 선택:</label>
                                    <PresetEmblemContainer>
                                        {presetEmblems.map(emblem => (
                                            <PresetEmblem
                                                key={emblem.id}
                                                src={emblem.src}
                                                $isSelected={newEmblemUrl === emblem.src}
                                                onClick={() => {
                                                    setNewEmblemUrl(emblem.src);
                                                    setNewEmblemFile(null);
                                                }}
                                            />
                                        ))}
                                    </PresetEmblemContainer>
                                </div>
                                <div>
                                    <button onClick={handleSave} disabled={isSaving}>{isSaving ? '저장 중...' : '저장'}</button>
                                    <button onClick={() => setIsEditing(false)} disabled={isSaving}>취소</button>
                                </div>
                            </EditForm>
                        )}

                    </TeamInfo>
                </Header>

                <ContentGrid>
                    <Section>
                        <SectionTitle>팀원 목록</SectionTitle>
                        <MemberList>
                            {teamMembers.map(player => (
                                <MemberCard key={player.id} to={`/profile/${player.id}`}>
                                    <AvatarDisplay>
                                        {player.avatarUrls.map((url, index) => (
                                            <PartImage key={`${url}-${index}`} src={url} alt={`player-avatar-part-${index}`} />
                                        ))}
                                    </AvatarDisplay>
                                    <PlayerName>{player.name}</PlayerName>
                                    {teamData.captainId === player.id && <CaptainBadge>Ⓒ</CaptainBadge>}
                                </MemberCard>
                            ))}
                        </MemberList>
                    </Section>
                    <Section>
                        <SectionTitle>경기 기록</SectionTitle>
                        <MatchHistoryList>
                            {teamMatches.length > 0 ? teamMatches.map(match => {
                                const isTeamA = match.teamA_id === teamId;
                                const opponentId = isTeamA ? match.teamB_id : match.teamA_id;
                                const opponent = teams.find(t => t.id === opponentId);
                                let result = 'D';
                                if (match.status === '완료') {
                                    const myScore = isTeamA ? match.teamA_score : match.teamB_score;
                                    const opponentScore = isTeamA ? match.teamB_score : match.teamA_score;
                                    if (myScore > opponentScore) result = 'W';
                                    else if (myScore < opponentScore) result = 'L';
                                }
                                return (
                                    <MatchHistoryItem key={match.id}>
                                        <span>vs {opponent?.teamName || 'N/A'}</span>
                                        {match.status === '완료' ? (
                                            <>
                                                <span>{match.teamA_score} : {match.teamB_score}</span>
                                                <MatchResult result={result}>{result}</MatchResult>
                                            </>
                                        ) : <span>예정</span>}
                                    </MatchHistoryItem>
                                )
                            }) : <p>경기 기록이 없습니다.</p>}
                        </MatchHistoryList>
                    </Section>
                </ContentGrid>

                <ButtonContainer>
                    <ExitButton onClick={handleGoBack}>팀 목록으로</ExitButton>
                    <ExitButton onClick={() => navigate(-1)}>나가기</ExitButton>
                </ButtonContainer>
            </Wrapper>

            {/* ▼▼▼ [추가] 엠블럼 확대 모달 렌더링 ▼▼▼ */}
            {isEmblemModalOpen && (
                <ModalBackground onClick={() => setIsEmblemModalOpen(false)}>
                    <ModalEmblem
                        src={isEditing ? newEmblemUrl : (teamData.emblemUrl || defaultEmblem)}
                        alt="확대된 엠블럼"
                    />
                </ModalBackground>
            )}
        </>
    );
}

export default TeamDetailPage;