import React, { useState, useEffect, useMemo, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import { useParams, useNavigate } from 'react-router-dom';
import { useLeagueStore } from '../../store/leagueStore';
import { auth } from '../../api/firebase';
import allQuizzesData from '../../assets/missions.json';

// --- Styled Components ---
const Arena = styled.div`
  max-width: 900px;
  margin: 2rem auto;
  padding: 2rem;
  background-color: #f0f8ff;
  border-radius: 12px;
  border: 5px solid #add8e6;
`;

const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
`;

const BattleField = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 2rem;
`;

const PetContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: ${props => props.$isHit ? shake : 'none'} 0.3s;
`;

const PetImage = styled.img`
  width: 200px;
  height: 200px;
`;

const InfoBox = styled.div`
  width: 220px;
  padding: 0.75rem;
  border: 3px solid #333;
  border-radius: 8px;
  background-color: #fff;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const StatBar = styled.div`
  width: 100%;
  height: 20px;
  background-color: #e9ecef;
  border-radius: 10px;
  overflow: hidden;
  font-size: 0.8rem;
  line-height: 20px;
  color: #fff;
  text-shadow: 1px 1px 1px rgba(0,0,0,0.5);
`;

const BarFill = styled.div`
  width: ${props => props.percent}%;
  height: 100%;
  background-color: ${props => props.color};
  transition: width 0.5s ease;
  text-align: center;
`;

const QuizArea = styled.div`
  padding: 1.5rem;
  background-color: #fff;
  border: 3px solid #333;
  border-radius: 8px;
  display: grid;
  grid-template-columns: 1fr 220px;
  gap: 2rem;
  min-height: 200px;
`;

const LogText = styled.p`
  font-size: 1.2rem;
  font-weight: bold;
  min-height: 50px;
  margin: 0;
`;

const AnswerInput = styled.input`
  width: 100%;
  padding: 0.75rem;
  font-size: 1.1rem;
  text-align: center;
  border: 2px solid #ccc;
  border-radius: 8px;
  margin-top: 1rem;
`;

const ActionMenu = styled.div`
  border-left: 2px solid #eee;
  padding-left: 2rem;
`;

const MenuItem = styled.div`
  font-size: 1.5rem;
  font-weight: bold;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 8px;
  background-color: ${props => props.$isSelected ? '#ddd' : 'transparent'};
`;


// --- 임시 이미지 및 데이터 ---
const myPetImg = 'https://via.placeholder.com/200/90ee90/000000?Text=My+Pet+(Back)';
const opponentPetImg = 'https://via.placeholder.com/200/f08080/000000?Text=Opponent+Pet';


function BattlePage() {
    const { opponentId } = useParams();
    const navigate = useNavigate();
    const { players } = useLeagueStore();

    const allQuizzes = useMemo(() => Object.values(allQuizzesData).flat(), []);
    const myPlayerData = useMemo(() => players.find(p => p.authUid === auth.currentUser?.uid), [players]);
    const opponentPlayerData = useMemo(() => players.find(p => p.id === opponentId), [players, opponentId]);

    // --- 상태 관리 ---
    const [gameState, setGameState] = useState('PREPARING'); // PREPARING, QUIZ, ACTION, FINISHED
    const [myPet, setMyPet] = useState(null);
    const [opponentPet, setOpponentPet] = useState(null);
    const [log, setLog] = useState("");
    const [question, setQuestion] = useState(null);
    const [answer, setAnswer] = useState("");
    const [actionMenu, setActionMenu] = useState({ view: 'main', selectedIndex: 0 }); // 'main' or 'skills'

    // --- 메뉴 아이템 정의 ---
    const mainMenuItems = ['기본 공격', '특수 공격'];
    const skillMenuItems = myPet ? [myPet.skillId || '몸통박치기', '돌아가기'] : [];

    // --- 키보드 조작 핸들러 ---
    const handleKeyDown = useCallback((e) => {
        if (gameState !== 'ACTION') return;

        const currentMenu = actionMenu.view === 'main' ? mainMenuItems : skillMenuItems;

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActionMenu(prev => ({ ...prev, selectedIndex: Math.max(0, prev.selectedIndex - 1) }));
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActionMenu(prev => ({ ...prev, selectedIndex: Math.min(currentMenu.length - 1, prev.selectedIndex + 1) }));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            handleMenuSelect(actionMenu.selectedIndex);
        }
    }, [gameState, actionMenu, mainMenuItems, skillMenuItems]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    // --- 배틀 준비 로직 ---
    useEffect(() => {
        if (!myPlayerData || !opponentPlayerData) {
            navigate('/league');
            return;
        }
        const myPetData = myPlayerData.pet || { name: '나의 임시펫', level: 1, hp: 100, maxHp: 100, sp: 50, maxSp: 50, isHit: false };
        const opponentPetData = opponentPlayerData.pet || { name: '상대 임시펫', level: 1, hp: 100, maxHp: 100, sp: 50, maxSp: 50, isHit: false };

        setMyPet(myPetData);
        setOpponentPet(opponentPetData);
        setLog(`${opponentPlayerData.name}에게 대결을 신청합니다!`);

        setTimeout(() => {
            fetchNewQuestion();
            setGameState('QUIZ');
        }, 2000);

    }, [myPlayerData, opponentPlayerData]);

    // --- 핵심 로직 함수들 ---
    const fetchNewQuestion = () => {
        const randomIndex = Math.floor(Math.random() * allQuizzes.length);
        setQuestion(allQuizzes[randomIndex]);
        setLog("문제를 보고 정답을 입력하세요!");
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (gameState !== 'QUIZ' || !question) return;
        const isCorrect = answer.trim().toLowerCase() === question.answer.toLowerCase();

        if (isCorrect) {
            setLog("정답! 행동을 선택하세요!");
            setGameState('ACTION');
            setActionMenu({ view: 'main', selectedIndex: 0 });
        } else {
            setLog("오답입니다! 상대방의 턴!");
            setTimeout(() => fetchNewQuestion(), 2000);
        }
        setAnswer("");
    };

    const handleMenuSelect = (index) => {
        const { view } = actionMenu;
        if (view === 'main') {
            if (index === 0) { // 기본 공격
                handleAttack('기본 공격');
            } else { // 특수 공격
                setActionMenu({ view: 'skills', selectedIndex: 0 });
            }
        } else if (view === 'skills') {
            if (index === skillMenuItems.length - 1) { // 돌아가기
                setActionMenu({ view: 'main', selectedIndex: 0 });
            } else {
                handleAttack(skillMenuItems[index]);
            }
        }
    };

    const handleAttack = (type) => {
        console.log(`${type} 공격 실행!`);
        setLog(`'${type}' 공격!`);

        setTimeout(() => {
            setGameState('QUIZ');
            fetchNewQuestion();
        }, 2000);
    };

    if (!myPet || !opponentPet) {
        return <Arena><p>플레이어 정보를 불러오는 중...</p></Arena>;
    }

    return (
        <Arena>
            <BattleField>
                <PetContainer $isHit={opponentPet.isHit}>
                    <InfoBox>
                        <span>{opponentPet.name} (Lv.{opponentPet.level})</span>
                        <StatBar>
                            <BarFill percent={(opponentPet.hp / opponentPet.maxHp) * 100} color="#28a745">HP</BarFill>
                        </StatBar>
                        <StatBar>
                            <BarFill percent={(opponentPet.sp / opponentPet.maxSp) * 100} color="#007bff">SP</BarFill>
                        </StatBar>
                    </InfoBox>
                    <PetImage src={opponentPetImg} alt="상대 펫" />
                </PetContainer>
                <PetContainer $isHit={myPet.isHit}>
                    <PetImage src={myPetImg} alt="나의 펫" />
                    <InfoBox>
                        <span>{myPet.name} (Lv.{myPet.level})</span>
                        <StatBar>
                            <BarFill percent={(myPet.hp / myPet.maxHp) * 100} color="#28a745">HP</BarFill>
                        </StatBar>
                        <StatBar>
                            <BarFill percent={(myPet.sp / myPet.maxSp) * 100} color="#007bff">SP</BarFill>
                        </StatBar>
                    </InfoBox>
                </PetContainer>
            </BattleField>
            <QuizArea>
                <div>
                    <LogText>{log}</LogText>

                    {gameState === 'QUIZ' && question && (
                        <>
                            <h3>Q. {question.question}</h3>
                            <form onSubmit={handleSubmit}>
                                <AnswerInput
                                    type="text"
                                    value={answer}
                                    onChange={(e) => setAnswer(e.target.value)}
                                    placeholder="정답을 입력하세요"
                                />
                            </form>
                        </>
                    )}
                </div>

                <ActionMenu>
                    {gameState === 'ACTION' && actionMenu.view === 'main' && (
                        mainMenuItems.map((item, index) => (
                            <MenuItem
                                key={item}
                                $isSelected={actionMenu.selectedIndex === index}
                                onClick={() => handleMenuSelect(index)}
                            >
                                {actionMenu.selectedIndex === index && '▶ '} {item}
                            </MenuItem>
                        ))
                    )}
                    {gameState === 'ACTION' && actionMenu.view === 'skills' && (
                        skillMenuItems.map((item, index) => (
                            <MenuItem
                                key={item}
                                $isSelected={actionMenu.selectedIndex === index}
                                onClick={() => handleMenuSelect(index)}
                            >
                                {actionMenu.selectedIndex === index && '▶ '} {item}
                            </MenuItem>
                        ))
                    )}
                </ActionMenu>
            </QuizArea>
        </Arena>
    );
}

export default BattlePage;