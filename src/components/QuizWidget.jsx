import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useLeagueStore, useClassStore } from '../store/leagueStore';
import { db, getActiveQuizSets } from '../api/firebase';
import { doc, collection, addDoc, runTransaction, increment, serverTimestamp } from 'firebase/firestore';

const WidgetContainer = styled.div`
  display: flex; flex-direction: column; gap: 1rem; height: 100%; justify-content: center;
`;

const QuizHeader = styled.div`
  display: flex; justify-content: space-between; align-items: center;
  font-size: 0.9rem; font-weight: 800; color: #868e96;
`;

const QuestionText = styled.div`
  font-size: 1.1rem; font-weight: 800; color: #343a40; line-height: 1.4; word-break: keep-all;
`;

const AnswerInput = styled.input`
  padding: 0.8rem; border: 2px solid #dee2e6; border-radius: 12px; font-size: 1rem; font-weight: 700;
  outline: none; transition: border-color 0.2s; text-align: center;
  &:focus { border-color: #20c997; box-shadow: 0 0 0 3px rgba(32, 201, 151, 0.1); }
`;

const OptionGrid = styled.div`
  display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem;
`;

const OptionBtn = styled.button`
  padding: 0.8rem; background: #f8f9fa; border: 2px solid #dee2e6; border-radius: 10px;
  font-weight: 800; cursor: pointer; transition: all 0.2s; color: #495057; font-size: 0.95rem;
  &:hover:not(:disabled) { background: #e6fcf5; border-color: #20c997; color: #0ca678; transform: translateY(-2px); }
  &:active:not(:disabled) { transform: translateY(0); }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
`;

const SubmitBtn = styled.button`
  padding: 0.8rem; background: #20c997; color: white; border: none; border-radius: 12px;
  font-weight: 900; cursor: pointer; transition: all 0.2s; font-size: 1rem; margin-top: 0.5rem;
  &:hover:not(:disabled) { background: #12b886; transform: translateY(-2px); }
  &:disabled { background: #adb5bd; cursor: not-allowed; transform: none; }
`;

const ResultText = styled.div`
  font-weight: 800; text-align: center; font-size: 1.1rem; padding: 1rem 0;
  color: ${props => props.$isCorrect ? '#20c997' : '#fa5252'};
  animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  
  @keyframes popIn {
    0% { transform: scale(0.8); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }
`;

function QuizWidget() {
    const { classId } = useClassStore();
    const { players, currentUser } = useLeagueStore();
    const myPlayerData = players.find(p => p.authUid === currentUser?.uid);

    const [quizPool, setQuizPool] = useState([]);
    const [currentQuiz, setCurrentQuiz] = useState(null);
    const [answer, setAnswer] = useState('');
    const [status, setStatus] = useState('idle'); // idle, correct, wrong
    const [isProcessing, setIsProcessing] = useState(false);

    const todayStr = new Date().toLocaleDateString();
    const dailyQuizCount = myPlayerData?.lastQuizDate === todayStr ? (myPlayerData?.dailyQuizCount || 0) : 0;
    const isLimitReached = dailyQuizCount >= 5;

    useEffect(() => {
        const loadQuizzes = async () => {
            if (!classId) return;
            const activeSets = await getActiveQuizSets(classId);
            let allQuestions = [];

            activeSets.forEach(set => {
                if (Array.isArray(set.questions)) {
                    allQuestions = [...allQuestions, ...set.questions];
                }
            });

            setQuizPool(allQuestions);

            if (allQuestions.length > 0) {
                setCurrentQuiz(allQuestions[Math.floor(Math.random() * allQuestions.length)]);
            }
        };
        loadQuizzes();
    }, [classId]);

    // 2. 정답/오답 제출 및 공통 다음 문제 로직
    const handleSubmit = async (submittedAnswer) => {
        if (!currentQuiz || !myPlayerData || isProcessing || status === 'correct' || status === 'wrong') return;
        if (isLimitReached) {
            alert("오늘의 퀴즈 도전 횟수(5회)를 모두 사용했습니다!");
            return;
        }

        setIsProcessing(true);
        const isCorrect = submittedAnswer.trim().toLowerCase() === currentQuiz.answer.toLowerCase();

        try {
            const playerRef = doc(db, 'classes', classId, 'players', myPlayerData.id);
            const rewardPoints = 50;

            // ▼ 정답/오답 상관없이 횟수는 무조건 차감(증가)하도록 트랜잭션 하나로 묶었습니다.
            await runTransaction(db, async (transaction) => {
                const docSnap = await transaction.get(playerRef);
                if (!docSnap.exists()) return;

                const data = docSnap.data();
                const newDailyCount = data.lastQuizDate === todayStr ? (data.dailyQuizCount || 0) + 1 : 1;

                const updates = {
                    dailyQuizCount: newDailyCount,
                    lastQuizDate: todayStr
                };

                // 정답일 때만 포인트와 지식인 칭호 스택을 올려줍니다.
                if (isCorrect) {
                    updates.points = increment(rewardPoints);
                    updates.correctQuizCount = increment(1);
                }

                transaction.update(playerRef, updates);
            });

            if (isCorrect) {
                setStatus('correct');
                const historyRef = collection(db, 'classes', classId, 'pointHistory');
                await addDoc(historyRef, {
                    authUid: myPlayerData.authUid,
                    playerName: myPlayerData.name,
                    amount: rewardPoints,
                    description: "일일 퀴즈 정답 보상",
                    createdAt: serverTimestamp()
                });
            } else {
                setStatus('wrong');
            }

            // ▼ 정답이든 오답이든 2초 뒤에 다음 문제로 넘어갑니다.
            setTimeout(() => {
                const nextQuizzes = quizPool.filter(q => q.question !== currentQuiz.question);
                const poolToUse = nextQuizzes.length > 0 ? nextQuizzes : quizPool;
                const nextQuiz = poolToUse[Math.floor(Math.random() * poolToUse.length)];

                setCurrentQuiz(nextQuiz);
                setAnswer('');
                setStatus('idle');
                setIsProcessing(false);
            }, 2000);

        } catch (error) {
            console.error("퀴즈 처리 오류:", error);
            setIsProcessing(false);
        }
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        handleSubmit(answer);
    };

    if (quizPool.length === 0) {
        return <WidgetContainer><p style={{ color: '#adb5bd', textAlign: 'center', fontWeight: 'bold' }}>출제된 퀴즈가 없습니다.<br />선생님께 요청해보세요!</p></WidgetContainer>;
    }

    if (isLimitReached) {
        return (
            <WidgetContainer>
                <ResultText $isCorrect={true}>
                    🎉 오늘의 퀴즈 완료!<br />
                    <span style={{ fontSize: '0.9rem', color: '#495057' }}>내일 다시 도전해주세요. (5/5)</span>
                </ResultText>
            </WidgetContainer>
        );
    }

    if (!currentQuiz) return null;
    const isObjective = currentQuiz.options && currentQuiz.options.length > 0;

    return (
        <WidgetContainer>
            <QuizHeader>
                <span>📝 오늘의 퀴즈 도전</span>
                <span style={{ color: '#20c997' }}>{dailyQuizCount} / 5</span>
            </QuizHeader>

            <QuestionText>Q. {currentQuiz.question}</QuestionText>

            {status === 'correct' ? (
                <ResultText $isCorrect={true}>🎉 정답입니다!<br /><span style={{ fontSize: '0.9rem', color: '#495057' }}>50P 획득! 다음 문제 준비 중...</span></ResultText>
            ) : status === 'wrong' ? (
                <ResultText $isCorrect={false}>
                    앗, 틀렸어요!<br />
                    {/* ▼ 오답 시 정답을 친절하게 보여줍니다 */}
                    <span style={{ fontSize: '0.95rem', color: '#495057' }}>정답: <strong style={{ color: '#f03e3e' }}>{currentQuiz.answer}</strong></span><br />
                    <span style={{ fontSize: '0.8rem', color: '#868e96' }}>다음 문제 준비 중...</span>
                </ResultText>
            ) : (
                isObjective ? (
                    <OptionGrid>
                        {currentQuiz.options.map((opt, idx) => (
                            <OptionBtn
                                key={idx}
                                onClick={() => handleSubmit(opt)}
                                disabled={isProcessing}
                            >
                                {opt}
                            </OptionBtn>
                        ))}
                    </OptionGrid>
                ) : (
                    <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
                        <AnswerInput
                            value={answer}
                            onChange={(e) => setAnswer(e.target.value)}
                            placeholder="정답을 입력하세요"
                            disabled={isProcessing}
                        />
                        <SubmitBtn type="submit" disabled={isProcessing || !answer.trim()}>
                            제출하기
                        </SubmitBtn>
                    </form>
                )
            )}
        </WidgetContainer>
    );
}

export default QuizWidget;