// src/components/dashboard/DashboardGameMode.jsx

import React, { useState, useEffect, useRef } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { Link, useNavigate } from 'react-router-dom';
import baseAvatar from '../../assets/base-avatar.png';
import { petImageMap } from '../../utils/petImageMap';
import QuizWidget from '../QuizWidget';

// ... (기존 애니메이션, 펫 대사 목록 유지) ...
const float = keyframes` 0% { transform: translateY(0px); } 50% { transform: translateY(-10px); } 100% { transform: translateY(0px); } `;
const pulse = keyframes` 0% { box-shadow: 0 0 0 0 rgba(32, 201, 151, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(32, 201, 151, 0); } 100% { box-shadow: 0 0 0 0 rgba(32, 201, 151, 0); } `;
const PET_MESSAGES = ["대결할까?", "오늘도 파이팅!", "배고파요~", "심심해 놀아줘!", "산책 가고 싶다", "내가 최고야!", "우승하러 가자!", "킁킁...", "Zzz...", "숙제는 다 했어?", "너만 믿을게!", "달리고 싶어!", "간식 줘!", "오늘 기분 최고!"];

// ... (기존 스타일 컴포넌트들: LobbyWrapper, DraggableDiv, TopHUD 등 모두 유지) ...
const LobbyWrapper = styled.div` min-height: 100vh; background: url(${props => props.$bgUrl}) no-repeat center center fixed; background-size: cover; position: relative; overflow: hidden; user-select: none; &::before { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.15); pointer-events: none; z-index: 0; } `;
const DraggableDiv = styled.div` position: absolute; cursor: grab; z-index: 10; &:active { cursor: grabbing; z-index: 100; transform: scale(1.02); transition: transform 0.2s; } `;
const TopHUD = styled.div` position: absolute; top: 0; left: 0; width: 100%; display: flex; justify-content: space-between; align-items: flex-start; padding: 1.5rem; z-index: 100; pointer-events: none; & > * { pointer-events: auto; } @media (max-width: 768px) { flex-direction: column; gap: 1rem; margin-top: 3rem; } `;
const PlayerStatus = styled(Link)` text-decoration: none; display: flex; alignItems: center; gap: 1rem; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(8px); padding: 0.5rem 1.5rem 0.5rem 0.5rem; border-radius: 50px; border: 2px solid rgba(255, 255, 255, 0.3); transition: transform 0.2s; box-shadow: 0 4px 10px rgba(0,0,0,0.3); &:hover { transform: scale(1.05); border-color: white; background: rgba(0,0,0,0.7); } `;
const AvatarCircle = styled.div` width: 54px; height: 54px; border-radius: 50%; background: #fff; overflow: hidden; border: 2px solid #fff; position: relative; `;
const StatusInfo = styled.div`display: flex; flexDirection: column;`;
const PlayerName = styled.div` color: white; fontWeight: 800; fontSize: 1.1rem; display: flex; alignItems: center; gap: 0.5rem; text-shadow: 0 2px 4px rgba(0,0,0,0.8); `;
const CurrencyBar = styled.div`display: flex; gap: 0.8rem; margin-top: 0.2rem; fontSize: 0.9rem; fontWeight: 700; color: #ffec99; text-shadow: 0 1px 2px rgba(0,0,0,0.8);`;
const GoalWidget = styled.div` background: rgba(255, 255, 255, 0.95); padding: 0.8rem 1.2rem; border-radius: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); display: flex; flexDirection: column; gap: 0.5rem; min-width: 200px; h4 { margin: 0; fontSize: 0.9rem; color: #495057; fontWeight: 800; } `;
const ProgressBar = styled.div` width: 100%; height: 8px; background: #e9ecef; border-radius: 4px; overflow: hidden; div { height: 100%; background: linear-gradient(90deg, #fab005, #fd7e14); width: ${props => props.$percent}%; transition: width 1s; } `;
const CharacterGroup = styled.div` width: 300px; height: 400px; display: flex; justifyContent: center; animation: ${float} 4s ease-in-out infinite; pointer-events: none; @media (max-width: 768px) { transform: scale(0.8); } `;
const MyAvatar = styled.div` width: 100%; height: 100%; position: relative; filter: drop-shadow(0 10px 20px rgba(0,0,0,0.4)); img { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; pointer-events: none; } `;
const MyPet = styled(Link)` position: absolute; bottom: 30px; right: -50px; width: 130px; height: 130px; filter: drop-shadow(0 5px 10px rgba(0,0,0,0.3)); animation: ${float} 3s ease-in-out infinite reverse; cursor: pointer; transition: transform 0.2s; display: block; pointer-events: auto; &:hover { transform: scale(1.1); } img { width: 100%; height: 100%; object-fit: contain; pointer-events: none; } `;
const PetBubble = styled.div` position: absolute; top: -45px; right: 10px; background: white; padding: 0.6rem 1.2rem; border-radius: 20px; font-weight: 800; fontSize: 0.9rem; color: #343a40; box-shadow: 0 4px 15px rgba(0,0,0,0.2); white-space: nowrap; animation: ${float} 2s ease-in-out infinite; pointer-events: none; &::after { content: ''; position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); border-width: 8px 8px 0; border-style: solid; border-color: white transparent transparent transparent; } `;
const PanelCard = styled.div` background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(12px); padding: 1.2rem; border-radius: 24px; box-shadow: 0 8px 32px rgba(0,0,0,0.1); transition: transform 0.2s; border: 1px solid rgba(255,255,255,0.6); width: 280px; &:hover { background: rgba(255,255,255,0.95); } .panel-header { text-decoration: none; color: #495057; display: flex; alignItems: center; gap: 0.5rem; margin-bottom: 0.8rem; cursor: pointer; h3 { margin: 0; fontSize: 1rem; font-weight: 800; } } `;
const MissionRow = styled.div` display: flex; justifyContent: space-between; alignItems: center; fontSize: 0.9rem; color: #343a40; padding: 0.5rem 0; border-bottom: 1px dashed #dee2e6; &:last-child { border-bottom: none; } span.reward { color: #f59f00; font-weight: 800; } `;
const BottomDock = styled.div` position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%); background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(20px); padding: 1rem 2rem; border-radius: 30px; display: flex; gap: 1.5rem; box-shadow: 0 10px 40px rgba(0,0,0,0.25), inset 0 1px 1px rgba(255,255,255,0.6); border: 1px solid rgba(255,255,255,0.4); z-index: 200; width: max-content; max-width: 95%; overflow-x: auto; @media (max-width: 768px) { bottom: 1rem; padding: 0.8rem 1rem; gap: 1rem; } `;
const DockItem = styled.div` display: flex; flex-direction: column; align-items: center; gap: 0.4rem; text-decoration: none; color: #495057; min-width: 65px; transition: all 0.2s; cursor: pointer; &:hover { transform: translateY(-10px); color: #20c997; .icon-box { background: #20c997; color: white; box-shadow: 0 5px 15px rgba(32, 201, 151, 0.5); } } `;
const IconBox = styled.div` width: 55px; height: 55px; background: white; border-radius: 22px; display: flex; justifyContent: center; alignItems: center; font-size: 2rem; transition: all 0.2s; box-shadow: 0 4px 10px rgba(0,0,0,0.08); ${props => props.$active && css`background: #ffec99; animation: ${pulse} 2s infinite;`} `;
const QuizOverlay = styled.div` position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(5px); z-index: 1000; display: flex; justify-content: center; align-items: center; `;
const QuizModalContent = styled.div` background: white; width: 90%; max-width: 500px; padding: 2rem; border-radius: 24px; box-shadow: 0 20px 50px rgba(0,0,0,0.3); position: relative; `;
const CloseButton = styled.button` position: absolute; top: 1rem; right: 1rem; background: #f1f3f5; border: none; border-radius: 50%; width: 32px; height: 32px; font-size: 1.2rem; cursor: pointer; &:hover { background: #dee2e6; } `;
const StarContainer = styled.span` display: inline-flex; align-items: center; gap: 2px; font-size: 0.6em; margin-left: 6px; vertical-align: middle; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.2)); `;

const getWinningStars = (count) => {
  if (!count || count <= 0) return null;
  const purpleStars = Math.floor(count / 5);
  const yellowStars = count % 5;
  const stars = [];
  for (let i = 0; i < purpleStars; i++) { stars.push(<span key={`p-${i}`} style={{ color: '#7950f2', textShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>★</span>); }
  for (let i = 0; i < yellowStars; i++) { stars.push(<span key={`y-${i}`} style={{ color: '#fcc419', textShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>★</span>); }
  return <StarContainer>{stars}</StarContainer>;
};

// ... (DraggableWidget 유지) ...
const DraggableWidget = ({ id, initialX, initialY, children, onSavePos }) => {
  const [position, setPosition] = useState({ x: initialX, y: initialY });
  const isDragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  useEffect(() => { setPosition({ x: initialX, y: initialY }); }, [initialX, initialY]);

  const handleMouseDown = (e) => {
    if (e.target.closest('a') || e.target.closest('button')) return;
    isDragging.current = true;
    const rect = e.currentTarget.getBoundingClientRect();
    offset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging.current) return;
      const newX = e.clientX - offset.current.x;
      const newY = e.clientY - offset.current.y;
      setPosition({ x: newX, y: newY });
    };
    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        onSavePos(id, position.x, position.y);
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [id, onSavePos, position]);

  return (
    <DraggableDiv onMouseDown={handleMouseDown} style={{ left: position.x, top: position.y }}>
      {children}
    </DraggableDiv>
  );
};

// --- Main Component ---
function DashboardGameMode({
  myPlayerData, myAvatarUrls, myPartnerPet, todaysFriend, friendAvatarUrls,
  activeGoal, activeMissions, recentMissions, bgUrl, onDonate
}) {
  const navigate = useNavigate();
  const [donationAmount, setDonationAmount] = useState('');
  const [petMessage, setPetMessage] = useState("대결할까?");

  useEffect(() => {
    const randomMsg = PET_MESSAGES[Math.floor(Math.random() * PET_MESSAGES.length)];
    setPetMessage(randomMsg);
  }, []);

  const [widgetPositions, setWidgetPositions] = useState(() => {
    const saved = localStorage.getItem('gameDashboardLayout');
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const rightSide = window.innerWidth - 350;
    return saved ? JSON.parse(saved) : {
      character: { x: centerX - 150, y: centerY - 200 },
      missions: { x: rightSide > 0 ? rightSide : 20, y: 100 },
      friend: { x: rightSide > 0 ? rightSide : 20, y: 400 }
    };
  });

  const [showQuiz, setShowQuiz] = useState(false);

  const savePosition = (id, x, y) => {
    setWidgetPositions(prev => {
      const newPositions = { ...prev, [id]: { x, y } };
      localStorage.setItem('gameDashboardLayout', JSON.stringify(newPositions));
      return newPositions;
    });
  };

  const handleDonateClick = () => {
    onDonate(donationAmount);
    setDonationAmount('');
  };

  return (
    <LobbyWrapper $bgUrl={bgUrl}>
      <TopHUD>
        <PlayerStatus to="/profile">
          <AvatarCircle>
            <div style={{ transform: 'scale(1.8) translateY(15px)', width: '100%', height: '100%', position: 'relative' }}>
              {/* [수정] 스냅샷 우선 로드 */}
              {myPlayerData?.avatarSnapshotUrl ? (
                <img src={myPlayerData.avatarSnapshotUrl} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                myAvatarUrls.map((src, i) => (
                  <img key={i} src={src} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain', zIndex: i }} />
                ))
              )}
            </div>
          </AvatarCircle>
          <StatusInfo>
            <PlayerName>
              {myPlayerData.name}
              {getWinningStars(myPlayerData.win_count || 0)}
              <span style={{ fontSize: '0.8rem', opacity: 0.9, marginLeft: '4px' }}>
                Lv.{Math.floor(myPlayerData.points / 100) + 1}
              </span>
            </PlayerName>
            <CurrencyBar>
              <span>💰 {myPlayerData.points?.toLocaleString()}</span>
              <span>❤️ {myPlayerData.totalLikes?.toLocaleString()}</span>
            </CurrencyBar>
          </StatusInfo>
        </PlayerStatus>

        {activeGoal && (
          <GoalWidget>
            <h4>🔥 {activeGoal.title}</h4>
            <ProgressBar $percent={Math.min((activeGoal.currentPoints / activeGoal.targetPoints) * 100, 100)}>
              <div />
            </ProgressBar>
            <div style={{ textAlign: 'right', fontSize: '0.75rem', marginTop: '4px', color: '#495057', fontWeight: '700' }}>
              {activeGoal.currentPoints.toLocaleString()} / {activeGoal.targetPoints.toLocaleString()}
            </div>
            <div className="donate-row" style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
              <input type="number" placeholder="P" value={donationAmount} onChange={e => setDonationAmount(e.target.value)} style={{ flex: 1, padding: '4px', borderRadius: '4px', border: 'none' }} />
              <button onClick={handleDonateClick} disabled={activeGoal.status === 'paused'} style={{ padding: '4px 8px', borderRadius: '4px', border: 'none', background: '#339af0', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>기부</button>
            </div>
          </GoalWidget>
        )}
      </TopHUD>

      {/* (A) 캐릭터 */}
      <DraggableWidget id="character" initialX={widgetPositions.character.x} initialY={widgetPositions.character.y} onSavePos={savePosition}>
        <CharacterGroup>
          <MyAvatar>
            {/* [수정] 스냅샷 우선 로드 */}
            {myPlayerData?.avatarSnapshotUrl ? (
              <img src={myPlayerData.avatarSnapshotUrl} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              myAvatarUrls.map((src, i) => <img key={i} src={src} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain', zIndex: i }} />)
            )}
          </MyAvatar>
          <MyPet to="/pet">
            {myPartnerPet ?
              <>
                <PetBubble>{petMessage}</PetBubble>
                <img src={petImageMap[`${myPartnerPet.appearanceId}_idle`] || baseAvatar} alt="pet" />
              </>
              :
              <>
                <PetBubble>펫 분양받기</PetBubble>
                <div style={{ fontSize: '3rem', textAlign: 'center', marginTop: '30px' }}>🥚</div>
              </>
            }
          </MyPet>
        </CharacterGroup>
      </DraggableWidget>

      {/* (B) 미션 */}
      <DraggableWidget id="missions" initialX={widgetPositions.missions.x} initialY={widgetPositions.missions.y} onSavePos={savePosition}>
        <PanelCard as="div">
          <Link to="/missions" className="panel-header"><h3>📝 오늘의 미션 ({activeMissions.length})</h3></Link>
          {recentMissions.length > 0 ? recentMissions.map(m => <MissionRow key={m.id}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>{m.title}</span><span className="reward">+{m.reward}</span></MissionRow>) : <div style={{ textAlign: 'center', padding: '1rem', color: '#adb5bd', fontSize: '0.9rem' }}>미션 클리어! 🎉</div>}
        </PanelCard>
      </DraggableWidget>

      {/* (C) 오늘의 친구 */}
      {todaysFriend && (
        <DraggableWidget id="friend" initialX={widgetPositions.friend.x} initialY={widgetPositions.friend.y} onSavePos={savePosition}>
          <PanelCard as="div">
            <Link to={`/my-room/${todaysFriend.id}`} className="panel-header"><h3>🌟 오늘의 친구</h3></Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '45px', height: '45px', borderRadius: '50%', background: '#e9ecef', overflow: 'hidden', border: '2px solid #51cf66', flexShrink: 0 }}>
                <div style={{ position: 'relative', width: '100%', height: '100%', transform: 'scale(1.8) translateY(5px)' }}>
                  {/* [수정] 친구 아바타 스냅샷 우선 로드 */}
                  {todaysFriend.avatarSnapshotUrl ? (
                    <img src={todaysFriend.avatarSnapshotUrl} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    friendAvatarUrls.map((src, i) => <img key={i} src={src} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain', zIndex: i }} />)
                  )}
                </div>
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontWeight: '800', color: '#2b8a3e', fontSize: '1.1rem', display: 'flex', alignItems: 'center' }}>
                  {todaysFriend.name} {getWinningStars(todaysFriend.win_count || 0)}
                </div>
                <Link to={`/my-room/${todaysFriend.id}`} style={{ fontSize: '0.8rem', color: '#868e96', textDecoration: 'none' }}>놀러가기 &rarr;</Link>
              </div>
            </div>
          </PanelCard>
        </DraggableWidget>
      )}

      {/* 3. 하단 독 (기존 유지) */}
      <BottomDock>
        <DockItem onClick={() => navigate('/missions')}><IconBox className="icon-box" $active={activeMissions.length > 0}>📝</IconBox><span style={{ fontSize: '0.8rem', fontWeight: '800' }}>미션</span></DockItem>
        <DockItem onClick={() => navigate('/shop')}><IconBox className="icon-box">🛒</IconBox><span style={{ fontSize: '0.8rem', fontWeight: '800' }}>상점</span></DockItem>
        <DockItem onClick={() => setShowQuiz(true)}><IconBox className="icon-box" style={{ background: '#e6fcf5', color: '#0ca678' }}>🧠</IconBox><span style={{ fontSize: '0.8rem', fontWeight: '800' }}>퀴즈</span></DockItem>
        <DockItem onClick={() => navigate('/league')}><IconBox className="icon-box">🏆</IconBox><span style={{ fontSize: '0.8rem', fontWeight: '800' }}>리그</span></DockItem>
        <DockItem onClick={() => navigate('/pet')}><IconBox className="icon-box">🐾</IconBox><span style={{ fontSize: '0.8rem', fontWeight: '800' }}>펫센터</span></DockItem>
        <DockItem onClick={() => navigate('/mission-gallery')}><IconBox className="icon-box">🖼️</IconBox><span style={{ fontSize: '0.8rem', fontWeight: '800' }}>갤러리</span></DockItem>
      </BottomDock>

      {/* 4. 퀴즈 모달 (기존 유지) */}
      {showQuiz && (
        <QuizOverlay onClick={() => setShowQuiz(false)}>
          <QuizModalContent onClick={e => e.stopPropagation()}>
            <CloseButton onClick={() => setShowQuiz(false)}>✕</CloseButton>
            <h2 style={{ marginTop: 0, textAlign: 'center' }}>🧠 오늘의 퀴즈</h2>
            <QuizWidget />
          </QuizModalContent>
        </QuizOverlay>
      )}
    </LobbyWrapper>
  );
}

export default DashboardGameMode;