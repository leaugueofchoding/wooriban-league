import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useClassStore, useLeagueStore } from '../store/leagueStore';
import { getActiveQuizSets, auth } from '../api/firebase';

const QuizWrapper = styled.div`
  display: flex; flex-direction: column; gap: 1rem;
`;
const QuestionText = styled.p`
  font-size: 1.1rem; font-weight: 500; margin: 0; line-height: 1.5;
`;
const AnswerInput = styled.input`
  width: 100%; padding: 0.75rem; border: 1px solid #ced4da; border-radius: 8px; font-size: 1rem;
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

function QuizWidget() {
    const { classId } = useClassStore();
    const currentUser = auth.currentUser;

    // 내 정보 및 퀴즈 관련 상태
    const myPlayerData = useLeagueStore(state => currentUser ? state.players.find(p => p.authUid === currentUser.uid) : null);
    const submitQuizAnswer = useLeagueStore(state => state.submitQuizAnswer);
    const quizHistory = useLeagueStore(state => state.quizHistory); // 오늘 푼 문제 기록

    // 로컬 상태
    const [quizList, setQuizList] = useState([]);
    const [currentQuiz, setCurrentQuiz] = useState(null);
    const [userAnswer, setUserAnswer] = useState('');
    const [feedback, setFeedback] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // 1. 출제된 퀴즈 목록 가져오기
    useEffect(() => {
        const loadQuizzes = async () => {
            if (!classId || !myPlayerData) return;
            setIsLoading(true);

            try {
                // 선생님이 출제한 퀴즈 세트들 가져오기
                const activeSets = await getActiveQuizSets(classId);

                if (activeSets.length > 0) {
                    // 모든 문제집의 문제들을 하나로 합치기 (Flat)
                    let allQuestions = [];
                    activeSets.forEach(set => {
                        if (Array.isArray(set.questions)) {
                            allQuestions = [...allQuestions, ...set.questions];
                        }
                    });

                    // 이미 푼 문제는 제외 (중복 풀이 방지)
                    // (단, quizHistory에는 문제 ID가 저장되어 있다고 가정)
                    // 현재 quizHistory 구조가 단순 횟수만 카운트하는지, ID를 저장하는지에 따라 다름.
                    // 일단은 전체 목록에서 랜덤으로 뽑는 로직 사용.

                    // 랜덤 셔플
                    allQuestions.sort(() => Math.random() - 0.5);
                    setQuizList(allQuestions);
                } else {
                    setQuizList([]);
                }
            } catch (error) {
                console.error("퀴즈 로딩 실패:", error);
            } finally {
                setIsLoading(false);
            }
        };

        loadQuizzes();
    }, [classId, myPlayerData]);

    // 2. 새 문제 출제 (목록이 있거나 갱신되었을 때)
    useEffect(() => {
        if (quizList.length > 0 && !currentQuiz && quizHistory.length < 5) {
            // 아직 안 푼 문제 중 하나 선택 (단순화를 위해 리스트의 첫 번째 사용)
            // 실제로는 quizHistory에 푼 문제 ID가 있다면 filter 해야 함.
            // 여기서는 리스트가 이미 셔플되었으므로 순서대로 꺼내되, 매번 랜덤하게 섞이므로 중복 가능성은 있음.
            // 완벽한 중복 방지를 위해서는 백엔드나 로컬스토리지에 '오늘 푼 문제 ID 목록'을 저장해야 함.
            setCurrentQuiz(quizList[0]);
        }
    }, [quizList, quizHistory.length, currentQuiz]);

    // 정답 제출 핸들러
    const handleSubmit = async (answerOverride) => {
        const finalAnswer = answerOverride || userAnswer;

        if (!finalAnswer.toString().trim() || !currentQuiz || isSubmitting) return;

        setIsSubmitting(true);

        // 정답 비교 (대소문자 무시, 공백 제거)
        // 객관식/OX는 정확히 일치, 주관식은 포함 여부 등 유연하게? -> 일단 정확 일치로
        const isCorrect = finalAnswer.toString().trim().toLowerCase() === currentQuiz.answer.toString().trim().toLowerCase();

        // 결과 서버 전송 (점수 획득 등)
        // 기존 함수 재사용: submitQuizAnswer(quizId, answer) -> 내부적으로 포인트 지급 처리됨
        await submitQuizAnswer(currentQuiz.id, finalAnswer);

        if (isCorrect) {
            setFeedback(`정답입니다! 50P를 획득했습니다. 🎉`);
        } else {
            setFeedback(`아쉽네요. 정답은 '${currentQuiz.answer}' 입니다.`);
        }

        setUserAnswer('');

        // 다음 문제 준비 (2초 후)
        setTimeout(() => {
            setFeedback('');
            setIsSubmitting(false);

            // 다음 문제로 교체 (현재 문제를 리스트에서 제거하거나 새로 셔플)
            if (quizHistory.length < 4) { // 방금 푼거 포함하면 5개가 됨
                setQuizList(prev => prev.slice(1)); // 맨 앞 문제 제거
                setCurrentQuiz(null); // useEffect가 다음 문제 설정함
            } else {
                // 오늘 할당량 끝
                setCurrentQuiz(null);
            }
        }, 2000);
    };

    // 렌더링 시작
    if (!myPlayerData) return <p>퀴즈를 풀려면 로그인이 필요합니다.</p>;
    if (isLoading) return <p>오늘의 퀴즈를 가져오는 중... ⏳</p>;

    const remainingQuizzes = 5 - quizHistory.length;
    const isQuizFinished = remainingQuizzes <= 0;

    if (isQuizFinished) {
        return (
            <QuizWrapper>
                <p style={{ textAlign: 'center', fontSize: '1.1rem', fontWeight: 'bold', color: '#007bff' }}>
                    오늘의 퀴즈 5개를 모두 완료했습니다! 👏👏<br />
                    내일 또 도전해주세요.
                </p>
            </QuizWrapper>
        );
    }

    if (!currentQuiz) {
        return <p>현재 출제된 퀴즈가 없습니다. 선생님께 문의해주세요. 😎</p>;
    }

    return (
        <QuizWrapper>
            <RemainingQuizCount>오늘 남은 기회: {remainingQuizzes}회</RemainingQuizCount>
            <QuestionText>Q. {currentQuiz.question}</QuestionText>

            {feedback ? (
                <FeedbackText $isCorrect={feedback.startsWith('정답')}>
                    {feedback}
                </FeedbackText>
            ) : (
                <>
                    {/* 문제 유형에 따른 입력 UI 분기 */}

                    {/* 1. 객관식 (Multiple Choice) */}
                    {currentQuiz.type === 'multiple' && currentQuiz.options && (
                        <OptionsGrid>
                            {currentQuiz.options.map((opt, idx) => (
                                <OptionButton key={idx} onClick={() => handleSubmit(opt)} disabled={isSubmitting}>
                                    {opt}
                                </OptionButton>
                            ))}
                        </OptionsGrid>
                    )}

                    {/* 2. OX 퀴즈 */}
                    {currentQuiz.type === 'ox' && (
                        <OptionsGrid>
                            <OptionButton onClick={() => handleSubmit('O')} disabled={isSubmitting} style={{ textAlign: 'center', fontSize: '1.5rem' }}>⭕ O</OptionButton>
                            <OptionButton onClick={() => handleSubmit('X')} disabled={isSubmitting} style={{ textAlign: 'center', fontSize: '1.5rem' }}>❌ X</OptionButton>
                        </OptionsGrid>
                    )}

                    {/* 3. 주관식 (Subjective) - 기존 입력창 방식 */}
                    {(!currentQuiz.type || currentQuiz.type === 'subjective') && (
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