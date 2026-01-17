// src/pages/TeamDetailPage.jsx

import React, { useMemo, useState } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { useLeagueStore, useClassStore } from '../store/leagueStore';
import { useParams, useNavigate, Link } from 'react-router-dom';
import baseAvatar from '../assets/base-avatar.png';
import { auth, updateTeamInfo, uploadTeamEmblem } from '../api/firebase';
import { emblemMap, presetEmblems } from '../utils/emblemMap';
import defaultEmblem from '../assets/default-emblem.png';

// --- Animations ---
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

// --- Styled Components ---

const PageContainer = styled.div`
  min-height: 100vh;
  padding: 3rem 1rem;
  font-family: 'Pretendard', sans-serif;
  background-color: #f8f9fa;
  display: flex;
  justify-content: center;
`;

const ContentWrapper = styled.div`
  width: 100%;
  max-width: 1000px;
  background: white;
  border-radius: 24px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.05);
  overflow: hidden;
  animation: ${fadeIn} 0.5s ease-out;
`;

const HeaderSection = styled.div`
  background: linear-gradient(135deg, #e7f5ff 0%, #ffffff 100%);
  padding: 3rem 2rem;
  display: flex;
  align-items: center;
  gap: 2rem;
  border-bottom: 1px solid #e9ecef;

  @media (max-width: 768px) {
    flex-direction: column;
    text-align: center;
    padding: 2rem 1rem;
  }
`;

const EmblemWrapper = styled.div`
  position: relative;
  width: 140px;
  height: 140px;
  
  &:hover::after {
    content: '🔍';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.3);
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 2rem;
    color: white;
    cursor: pointer;
  }
`;

const TeamEmblem = styled.img`
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  background-color: white;
  border: 4px solid white;
  box-shadow: 0 8px 20px rgba(0,0,0,0.1);
`;

const TeamInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
  
  @media (max-width: 768px) {
    justify-content: center;
    flex-direction: column;
    gap: 0.5rem;
  }
`;

const TeamName = styled.h1`
  font-size: 2.5rem;
  font-weight: 900;
  color: #343a40;
  margin: 0;
  line-height: 1.2;
`;

const RecordBadge = styled.span`
  background: #339af0;
  color: white;
  padding: 0.4rem 1rem;
  border-radius: 20px;
  font-weight: 700;
  font-size: 1rem;
  box-shadow: 0 4px 10px rgba(51, 154, 240, 0.3);
`;

const EditButton = styled.button`
  background: white;
  border: 1px solid #dee2e6;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-weight: 700;
  color: #495057;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: #f1f3f5;
    color: #339af0;
    border-color: #339af0;
  }
`;

const ContentBody = styled.div`
  padding: 2rem;
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 2rem;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const SectionTitle = styled.h3`
  font-size: 1.4rem;
  font-weight: 800;
  color: #343a40;
  margin: 0 0 1.5rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  &::before {
    content: '';
    display: block;
    width: 6px;
    height: 24px;
    background: #339af0;
    border-radius: 3px;
  }
`;

const MemberGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 1.5rem;
`;

const MemberCard = styled(Link)`
  background: white;
  border: 1px solid #f1f3f5;
  border-radius: 16px;
  padding: 1.5rem 1rem;
  text-align: center;
  text-decoration: none;
  color: inherit;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(0,0,0,0.03);
  position: relative;
  overflow: hidden;

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 16px rgba(0,0,0,0.08);
    border-color: #339af0;
  }
`;

const AvatarContainer = styled.div`
  width: 90px;
  height: 90px;
  margin: 0 auto 1rem;
  position: relative;
  border-radius: 50%;
  background: #f8f9fa;
  overflow: hidden;
  border: 3px solid white;
  box-shadow: 0 4px 10px rgba(0,0,0,0.05);

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  
  /* 파츠 렌더링용 스타일 */
  .part-img {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    object-fit: contain;
  }
`;

const PlayerName = styled.div`
  font-weight: 700;
  font-size: 1.1rem;
  color: #343a40;
  margin-bottom: 0.3rem;
`;

const MemberTitle = styled.div`
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 12px;
  background: #f1f3f5;
  color: ${props => props.color || '#868e96'};
  border: 1px solid #dee2e6;
`;

const CaptainMark = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 1.2rem;
  filter: drop-shadow(0 2px 2px rgba(0,0,0,0.1));
`;

const MatchList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  max-height: 500px;
  overflow-y: auto;
`;

const MatchItem = styled.div`
  background: white;
  border: 1px solid #f1f3f5;
  padding: 1rem;
  border-radius: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.03);
`;

const MatchResultBadge = styled.span`
  font-size: 0.8rem;
  font-weight: 800;
  padding: 4px 8px;
  border-radius: 6px;
  color: white;
  min-width: 32px;
  text-align: center;
  
  ${props => props.$result === 'W' && css`background: #20c997;`}
  ${props => props.$result === 'L' && css`background: #ff6b6b;`}
  ${props => props.$result === 'D' && css`background: #adb5bd;`}
`;

const OpponentName = styled.span`
  font-weight: 600;
  color: #495057;
  font-size: 0.95rem;
`;

const MatchScore = styled.span`
  font-weight: 800;
  color: #343a40;
  font-size: 1.1rem;
  margin: 0 0.5rem;
`;

// 수정 모드 스타일
const EditPanel = styled.div`
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 16px;
  margin-top: 1.5rem;
  animation: ${fadeIn} 0.3s ease-out;
`;

const InputLabel = styled.label`
  display: block;
  font-weight: 700;
  margin-bottom: 0.5rem;
  color: #495057;
`;

const StyledInput = styled.input`
  width: 100%;
  padding: 0.8rem;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  font-size: 1rem;
  margin-bottom: 1rem;
  
  &:focus { outline: none; border-color: #339af0; }
`;

const PresetGrid = styled.div`
  display: flex;
  gap: 0.8rem;
  overflow-x: auto;
  padding-bottom: 0.5rem;
  
  img {
    width: 60px; height: 60px;
    border-radius: 50%;
    cursor: pointer;
    border: 3px solid transparent;
    transition: all 0.2s;
    
    &.selected { border-color: #339af0; transform: scale(1.1); }
    &:hover { transform: scale(1.1); }
  }
`;

const ActionButtons = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
`;

const SaveBtn = styled.button`
  background: #20c997;
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
  &:disabled { background: #adb5bd; cursor: not-allowed; }
`;

const CancelBtn = styled.button`
  background: #e9ecef;
  color: #495057;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
`;

const ModalBackground = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.8);
  display: flex; justify-content: center; align-items: center;
  z-index: 2000;
  backdrop-filter: blur(5px);
`;

const ModalEmblem = styled.img`
  max-width: 80vw;
  max-height: 80vh;
  object-fit: contain;
  animation: ${fadeIn} 0.3s ease-out;
`;

// [추가] 통일된 스타일의 버튼 컨테이너 및 버튼
const ButtonContainer = styled.div`
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-top: 3rem;
  flex-wrap: wrap;
`;

const NavButton = styled.button`
  background: #f1f3f5;
  color: #495057;
  border: none;
  padding: 0.8rem 2rem;
  border-radius: 12px;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);

  &:hover {
    background: #e9ecef;
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  }
`;

function TeamDetailPage() {
    const { classId } = useClassStore();
    const { teamId } = useParams();
    const navigate = useNavigate();
    const { teams, players, matches, avatarParts, currentSeason, fetchInitialData, titles } = useLeagueStore();
    const currentUser = auth.currentUser;

    const [isEditing, setIsEditing] = useState(false);
    const [newTeamName, setNewTeamName] = useState('');
    const [newEmblemFile, setNewEmblemFile] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isEmblemModalOpen, setIsEmblemModalOpen] = useState(false);
    const [newEmblemId, setNewEmblemId] = useState('');

    const teamData = useMemo(() => teams.find(t => t.id === teamId), [teams, teamId]);
    const isCaptain = useMemo(() => currentUser && teamData && teamData.captainId === players.find(p => p.authUid === currentUser.uid)?.id, [currentUser, teamData, players]);
    const canEditTeam = useMemo(() => currentSeason?.status !== 'completed', [currentSeason]);

    const teamMembers = useMemo(() => {
        if (!teamData?.members) return [];
        return teamData.members.map(id => {
            const player = players.find(p => p.id === id);
            if (!player) return null;

            const equippedTitle = player.equippedTitle ? titles.find(t => t.id === player.equippedTitle) : null;

            // [수정] 아바타 스냅샷 우선 로드 로직을 위해 전체 데이터 전달
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

            return {
                ...player,
                avatarUrls: urls,
                equippedTitle,
                avatarSnapshotUrl: player.avatarSnapshotUrl // 스냅샷 URL 포함
            };
        }).filter(Boolean);
    }, [teamData, players, avatarParts, titles]);

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
        setNewEmblemId(teamData.emblemId || 'default');
        setNewEmblemFile(null);
        setIsEditing(true);
    };

    const handleSave = async () => {
        if (!classId) return;
        if (!newTeamName.trim()) return alert('팀 이름을 입력해주세요.');
        setIsSaving(true);
        try {
            let finalEmblemId = newEmblemId;
            let finalEmblemUrl = null;

            if (newEmblemFile) {
                finalEmblemUrl = await uploadTeamEmblem(classId, teamId, newEmblemFile);
                finalEmblemId = null;
            }

            await updateTeamInfo(classId, teamId, newTeamName, finalEmblemId, finalEmblemUrl);
            alert('팀 정보가 수정되었습니다.');
            await fetchInitialData();
            setIsEditing(false);
            setNewEmblemFile(null);
        } catch (error) {
            console.error(error);
            alert('저장 중 오류가 발생했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setNewEmblemFile(file);
            setNewEmblemId('');
        }
    };

    const selectedEmblemSrc = useMemo(() => {
        if (newEmblemFile) return URL.createObjectURL(newEmblemFile);
        const emblem = presetEmblems.find(e => e.id === newEmblemId);
        return emblem ? emblem.src : defaultEmblem;
    }, [newEmblemFile, newEmblemId]);

    if (!teamData) return <PageContainer><div>팀 정보를 불러오는 중...</div></PageContainer>;

    return (
        <PageContainer>
            <div style={{ width: '100%', maxWidth: '1000px' }}>
                <ContentWrapper>
                    <HeaderSection>
                        <EmblemWrapper onClick={() => setIsEmblemModalOpen(true)}>
                            <TeamEmblem src={isEditing ? selectedEmblemSrc : (emblemMap[teamData.emblemId] || teamData.emblemUrl || defaultEmblem)} />
                        </EmblemWrapper>

                        <TeamInfo>
                            {isEditing ? (
                                <EditPanel>
                                    <InputLabel>팀 이름 수정</InputLabel>
                                    <StyledInput type="text" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} />

                                    <InputLabel>엠블럼 변경</InputLabel>
                                    <StyledInput type="file" accept="image/*" onChange={handleFileChange} />

                                    <InputLabel>또는 프리셋 선택</InputLabel>
                                    <PresetGrid>
                                        {presetEmblems.map(emblem => (
                                            <img
                                                key={emblem.id}
                                                src={emblem.src}
                                                className={!newEmblemFile && newEmblemId === emblem.id ? 'selected' : ''}
                                                onClick={() => { setNewEmblemId(emblem.id); setNewEmblemFile(null); }}
                                                alt="preset"
                                            />
                                        ))}
                                    </PresetGrid>

                                    <ActionButtons>
                                        <CancelBtn onClick={() => setIsEditing(false)} disabled={isSaving}>취소</CancelBtn>
                                        <SaveBtn onClick={handleSave} disabled={isSaving}>{isSaving ? '저장 중...' : '저장'}</SaveBtn>
                                    </ActionButtons>
                                </EditPanel>
                            ) : (
                                <>
                                    <TitleRow>
                                        <TeamName>{teamData.teamName}</TeamName>
                                        {isCaptain && canEditTeam && <EditButton onClick={handleEditClick}>설정</EditButton>}
                                    </TitleRow>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <RecordBadge>{teamStats.wins}승 {teamStats.draws}무 {teamStats.losses}패</RecordBadge>
                                    </div>
                                </>
                            )}
                        </TeamInfo>
                    </HeaderSection>

                    <ContentBody>
                        <div>
                            <SectionTitle>팀원 목록</SectionTitle>
                            <MemberGrid>
                                {teamMembers.map(player => (
                                    <MemberCard key={player.id} to={`/profile/${player.id}`}>
                                        {teamData.captainId === player.id && <CaptainMark>👑</CaptainMark>}
                                        <AvatarContainer>
                                            {/* [수정] 스냅샷 우선 로드 */}
                                            {player.avatarSnapshotUrl ? (
                                                <img
                                                    src={player.avatarSnapshotUrl}
                                                    alt={player.name}
                                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                />
                                            ) : (
                                                player.avatarUrls.map((url, i) => <img key={i} src={url} className="part-img" style={{ zIndex: i }} alt="part" />)
                                            )}
                                        </AvatarContainer>
                                        <PlayerName>{player.name}</PlayerName>
                                        {player.equippedTitle && (
                                            <MemberTitle color={player.equippedTitle.color}>
                                                {player.equippedTitle.icon} {player.equippedTitle.name}
                                            </MemberTitle>
                                        )}
                                    </MemberCard>
                                ))}
                            </MemberGrid>
                        </div>

                        <div>
                            <SectionTitle>최근 경기</SectionTitle>
                            <MatchList>
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
                                        <MatchItem key={match.id}>
                                            <OpponentName>vs {opponent?.teamName || '?'}</OpponentName>
                                            {match.status === '완료' ? (
                                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                                    <MatchScore>{match.teamA_score}:{match.teamB_score}</MatchScore>
                                                    <MatchResultBadge $result={result}>{result}</MatchResultBadge>
                                                </div>
                                            ) : (
                                                <span style={{ color: '#adb5bd', fontSize: '0.85rem' }}>예정</span>
                                            )}
                                        </MatchItem>
                                    );
                                }) : <div style={{ color: '#adb5bd', textAlign: 'center' }}>경기 기록이 없습니다.</div>}
                            </MatchList>
                        </div>
                    </ContentBody>
                </ContentWrapper>

                {/* [추가] 통일된 스타일의 하단 버튼 */}
                <ButtonContainer>
                    <NavButton onClick={() => navigate('/league')}>📋 팀 목록으로</NavButton>
                    <NavButton onClick={() => navigate('/')}>🏠 홈으로</NavButton>
                </ButtonContainer>
            </div>

            {isEmblemModalOpen && (
                <ModalBackground onClick={() => setIsEmblemModalOpen(false)}>
                    <ModalEmblem
                        src={isEditing ? selectedEmblemSrc : (emblemMap[teamData.emblemId] || teamData.emblemUrl || defaultEmblem)}
                        onClick={e => e.stopPropagation()}
                    />
                </ModalBackground>
            )}
        </PageContainer>
    );
}

export default TeamDetailPage;