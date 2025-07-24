// src/components/QuizWidget.jsx

import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { auth } from '../api/firebase';
import missionsData from '../assets/missions.json';

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
    // 필요한 상태와 함수들을 store에서 가져옵니다.
    const { myPlayerData, dailyQuiz, fetchDailyQuiz, submitQuizAnswer, quizHistory } = useLeagueStore(state => {
        const currentUser = auth.currentUser;
        return {
            myPlayerData: currentUser ? state.players.find(p => p.authUid === currentUser.uid) : null,
            dailyQuiz: state.dailyQuiz,
            fetchDailyQuiz: state.fetchDailyQuiz,
            submitQuizAnswer: state.submitQuizAnswer,
            quizHistory: state.quizHistory
        }
    });

    const [userAnswer, setUserAnswer] = useState('');
    const [feedback, setFeedback] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (myPlayerData && !dailyQuiz) {
            fetchDailyQuiz(myPlayerData.id);
        }
    }, [myPlayerData, fetchDailyQuiz, dailyQuiz]);

    const handleSubmit = async () => {
        if (!userAnswer.trim() || !dailyQuiz) return;

        setIsSubmitting(true);
        const isCorrect = await submitQuizAnswer(dailyQuiz.id, userAnswer);

        if (isCorrect) {
            setFeedback('정답입니다! 30P를 획득했습니다.');
        } else {
            setFeedback(`오답입니다. 정답은 '${dailyQuiz.answer}' 입니다.`);
        }

        setUserAnswer('');
        // 피드백을 보여준 후 잠시 뒤에 다음 문제로 넘어갑니다.
        setTimeout(() => {
            setFeedback('');
            fetchDailyQuiz(myPlayerData.id);
            setIsSubmitting(false);
        }, 2000); // 2초 후에 다음 문제로
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