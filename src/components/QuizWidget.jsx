// src/components/QuizWidget.jsx

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { auth } from '../api/firebase';

const QuizWrapper = styled.div`
    display: flex;
    flex-direction: column;
    gap: 1rem;
`;

const QuestionText = styled.p`
    font-size: 1.1rem;
    font-weight: 500;
    margin: 0;
    line-height: 1.5;
`;

const AnswerInput = styled.input`
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ced4da;
    border-radius: 8px;
    font-size: 1rem;
`;

const SubmitButton = styled.button`
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 8px;
    background-color: #007bff;
    color: white;
    font-weight: bold;
    font-size: 1rem;
    cursor: pointer;
    &:disabled {
        background-color: #6c757d;
    }
`;

const FeedbackText = styled.p`
    font-weight: bold;
    font-size: 1.1rem;
    text-align: center;
    padding: 1rem;
    border-radius: 8px;
    background-color: ${props => props.$isCorrect ? '#eaf7f0' : '#fbe9eb'};
    color: ${props => props.$isCorrect ? '#28a745' : '#dc3545'};
`;

const RemainingQuizCount = styled.p`
    text-align: right;
    font-size: 0.9rem;
    color: #6c757d;
    margin: -0.5rem 0 0.5rem;
`;

function QuizWidget() {
    // ▼▼▼ [수정] 무한 루프를 유발하던 스토어 호출 방식을 원래대로 되돌렸습니다. ▼▼▼
    const currentUser = auth.currentUser;
    const myPlayerData = useLeagueStore(state =>
        currentUser ? state.players.find(p => p.authUid === currentUser.uid) : null
    );
    const dailyQuiz = useLeagueStore(state => state.dailyQuiz);
    const fetchDailyQuiz = useLeagueStore(state => state.fetchDailyQuiz);
    const submitQuizAnswer = useLeagueStore(state => state.submitQuizAnswer);
    const quizHistory = useLeagueStore(state => state.quizHistory);
    // ▲▲▲ 여기까지 수정 ▲▲▲

    const [userAnswer, setUserAnswer] = useState('');
    const [feedback, setFeedback] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (myPlayerData?.id) {
            fetchDailyQuiz(myPlayerData.id);
        }
    }, [myPlayerData?.id, fetchDailyQuiz]);

    const handleSubmit = async () => {
        if (!userAnswer.trim() || !dailyQuiz) return;

        setIsSubmitting(true);
        const currentQuizAnswer = dailyQuiz.answer;
        const isCorrect = await submitQuizAnswer(dailyQuiz.id, userAnswer);

        if (isCorrect) {
            setFeedback('정답입니다! 50P를 획득했습니다.');
        } else {
            setFeedback(`오답입니다. 정답은 '${currentQuizAnswer}' 입니다.`);
        }

        setUserAnswer('');

        setTimeout(() => {
            setFeedback('');
            setIsSubmitting(false);
        }, 2000);
    };

    if (!myPlayerData) {
        return <p>퀴즈를 풀려면 리그에 참가해야 합니다.</p>
    }

    const remainingQuizzes = 5 - quizHistory.length;

    return (
        <QuizWrapper>
            {remainingQuizzes > 0 && dailyQuiz ? (
                <>
                    <RemainingQuizCount>오늘 남은 퀴즈: {remainingQuizzes}개</RemainingQuizCount>
                    <QuestionText>Q. {dailyQuiz.question}</QuestionText>

                    {feedback ? (
                        <FeedbackText $isCorrect={feedback.startsWith('정답')}>
                            {feedback}
                        </FeedbackText>
                    ) : (
                        <>
                            <AnswerInput
                                type="text"
                                value={userAnswer}
                                onChange={(e) => setUserAnswer(e.target.value)}
                                placeholder="정답을 입력하세요"
                                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                                disabled={isSubmitting}
                            />
                            <SubmitButton onClick={handleSubmit} disabled={isSubmitting || !userAnswer.trim()}>
                                {isSubmitting ? '채점 중...' : '정답 제출'}
                            </SubmitButton>
                        </>
                    )}
                </>
            ) : (
                <p>오늘의 퀴즈를 모두 풀었습니다. 내일 다시 도전해주세요! 👍</p>
            )}
        </QuizWrapper>
    );
}

export default QuizWidget;