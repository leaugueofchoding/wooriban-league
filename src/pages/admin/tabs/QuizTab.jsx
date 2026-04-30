// src/pages/admin/tabs/QuizTab.jsx

import React from 'react';
import { useLeagueStore } from '../../../store/leagueStore';
import { auth } from '../../../api/firebase';
import QuizManager from '../../../components/QuizManager'; // 기존 컴포넌트 재활용
import { FullWidthSection, Section, SectionTitle } from '../Admin.style';

function QuizTab() {
    const { players } = useLeagueStore();
    const myPlayer = players.find(p => p.authUid === auth.currentUser?.uid);

    return (
        <FullWidthSection>
            <Section>
                <SectionTitle>퀴즈 관리 ❓</SectionTitle>
                {/* userRole을 넘겨주어 관리자 권한 확인 */}
                <QuizManager userRole={myPlayer?.role} />
            </Section>
        </FullWidthSection>
    );
}

export default QuizTab;