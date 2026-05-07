import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useClassStore, useLeagueStore } from '../store/leagueStore';
import { auth } from '../api/firebase';

// --- Styled Components (중복 제거 및 통합) ---
const QuizWrapper = styled.div`
  display: flex; flex-direction: column; gap: 1rem;
`;
const QuestionText = styled.p`
  font-size: 1.1rem; font-weight: 500; margin: 0; line-height: 1.5;
`;
const AnswerInput = styled.input`
  width: 100%; padding: 0.75rem; border: 1px solid #ced4da; border-radius: 8px; font-size: 1rem;
  box-sizing: border-box;
`;
const SubmitButton = styled.button`
  padding: 0.75rem 1.5rem; border: none; border-radius: 8px; background-color: #007bff; color: white; font-weight: bold; font-size: 1rem; cursor: pointer;
  &:disabled { background-color: #6c757d; cursor: not-allowed; }
`;
const FeedbackText = styled.p`
  font-weight: bold; font-size: 1.1rem; text-align: center; padding: 1rem; border-radius: 8px;
  background-color: ${props => props.$isCorrect ? '#eaf7f0' : '#fbe9eb'};
  color: ${props => props.$isCorrect ? '#28a745' : '#dc3545'};
`;
const RemainingQuizCount = styled.p`
  text-align: right; font-size: 0.9rem; color: #6c757d; margin: -0.5rem 0 0.5rem;
`;
const OptionButton = styled.button`
  padding: 0.8rem; border: 1px solid #dee2e6; border-radius: 8px; background: white; cursor: pointer; text-align: left; font-size: 1rem; transition: background 0.2s;
  &:hover { background: #f8f9fa; border-color: #007bff; }
`;
const OptionsGrid = styled.div`
  display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;
`;

// --- Main Component ---
function QuizWidget() {
    const { classId } = useClassStore();
    const currentUser = auth.currentUser;

    // 스토어 상태 및 액션
    const myPlayerData = useLeagueStore(state => currentUser ? state.players.find(p => p.authUid === currentUser.uid) : null);
    const submitQuizAnswer = useLeagueStore(state => state.submitQuizAnswer);
    const quizHistory = useLeagueStore(state => state.quizHistory || []);
    const dailyQuiz = useLeagueStore(state => state.dailyQuiz);
    const fetchDailyQuiz = useLeagueStore(state => state.fetchDailyQuiz);

    // 로컬 상태
    const [userAnswer, setUserAnswer] = useState('');
    const [feedback, setFeedback] = useState(null); // { isCorrect, msg }
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // 1. 초기 데이터 로딩
    useEffect(() => {
        const loadInitialData = async () => {
            if (myPlayerData?.id) {
                setIsLoading(true);
                try {
                    await fetchDailyQuiz(myPlayerData.id);
                } catch (error) {
                    console.error("퀴즈 로딩 실패:", error);
                } finally {
                    setIsLoading(false);
                }
            }
        };
        loadInitialData();
    }, [myPlayerData?.id, fetchDailyQuiz]);

    // 2. 정답 제출 핸들러
    const handleSubmit = async (answerOverride) => {
        const finalAnswer = (answerOverride ?? userAnswer).toString().trim();

        if (!finalAnswer || !dailyQuiz || isSubmitting) return;

        setIsSubmitting(true);
        try {
            // 서버에 제출 및 정답 여부 확인
            const isCorrect = await submitQuizAnswer(dailyQuiz.id, finalAnswer);

            if (isCorrect) {
                setFeedback({ isCorrect: true, msg: `정답입니다! 50P를 획득했습니다. 🎉` });
            } else {
                setFeedback({ isCorrect: false, msg: `아쉽네요. 정답은 '${dailyQuiz.answer}' 입니다.` });
            }

            setUserAnswer('');

            // 2.5초 후 피드백 초기화 및 다음 문제로 갱신
            setTimeout(async () => {
                setFeedback(null);
                setIsSubmitting(false);
                // 다음 퀴즈를 가져옴 (submitQuizAnswer 내부 로직에 따라 갱신됨)
                if (myPlayerData?.id) {
                    await fetchDailyQuiz(myPlayerData.id);
                }
            }, 2500);
        } catch (error) {
            console.error("제출 중 오류 발생:", error);
            setIsSubmitting(false);
        }
    };

    // 렌더링 분기
    if (!myPlayerData) return <p>퀴즈를 풀려면 로그인이 필요합니다.</p>;
    if (isLoading) return <p>오늘의 퀴즈를 가져오는 중... ⏳</p>;

    const remainingQuizzes = 5 - quizHistory.length;

    if (remainingQuizzes <= 0) {
        return (
            <QuizWrapper>
                <p style={{ textAlign: 'center', fontSize: '1.1rem', fontWeight: 'bold', color: '#007bff' }}>
                    오늘의 퀴즈 5개를 모두 완료했습니다! 👏👏<br />
                    내일 또 도전해주세요.
                </p>
            </QuizWrapper>
        );
    }

    if (!dailyQuiz) {
        return <p>현재 출제된 퀴즈가 없습니다. 선생님께 문의해주세요. 😎</p>;
    }

    return (
        <QuizWrapper>
            <RemainingQuizCount>오늘 남은 기회: {remainingQuizzes}회</RemainingQuizCount>
            <QuestionText>Q. {dailyQuiz.question}</QuestionText>

            {feedback ? (
                <FeedbackText $isCorrect={feedback.isCorrect}>
                    {feedback.msg}
                </FeedbackText>
            ) : (
                <>
                    {/* 문제 유형: 객관식 */}
                    {dailyQuiz.type === 'multiple' && dailyQuiz.options && (
                        <OptionsGrid>
                            {dailyQuiz.options.map((opt, idx) => (
                                <OptionButton key={idx} onClick={() => handleSubmit(opt)} disabled={isSubmitting}>
                                    {opt}
                                </OptionButton>
                            ))}
                        </OptionsGrid>
                    )}

                    {/* 문제 유형: OX */}
                    {dailyQuiz.type === 'ox' && (
                        <OptionsGrid>
                            <OptionButton onClick={() => handleSubmit('O')} disabled={isSubmitting} style={{ textAlign: 'center', fontSize: '1.5rem' }}>⭕ O</OptionButton>
                            <OptionButton onClick={() => handleSubmit('X')} disabled={isSubmitting} style={{ textAlign: 'center', fontSize: '1.5rem' }}>❌ X</OptionButton>
                        </OptionsGrid>
                    )}

                    {/* 문제 유형: 주관식 */}
                    {(!dailyQuiz.type || dailyQuiz.type === 'subjective') && (
                        <>
                            <AnswerInput
                                type="text"
                                value={userAnswer}
                                onChange={(e) => setUserAnswer(e.target.value)}
                                placeholder="정답을 입력하세요"
                                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                                disabled={isSubmitting}
                                autoFocus
                            />
                            <SubmitButton onClick={() => handleSubmit()} disabled={isSubmitting || !userAnswer.trim()}>
                                {isSubmitting ? '채점 중...' : '제출하기'}
                            </SubmitButton>
                        </>
                    )}
                </>
            )}
        </QuizWrapper>
    );
}

export default QuizWidget;