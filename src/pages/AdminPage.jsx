// src/pages/AdminPage.jsx

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useLeagueStore, useClassStore } from '../store/leagueStore';
import { auth, db, adminCleanupZombieBattles } from '../api/firebase.js';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import ImageModal from '../components/ImageModal';
import QuizManager from '../components/QuizManager';

// --- 분리된 탭 컴포넌트 임포트 ---
import MissionTab from './admin/tabs/MissionTab';
import StudentTab from './admin/tabs/StudentTab';
import SocialTab from './admin/tabs/SocialTab';
import ShopTab from './admin/tabs/ShopTab';
import LeagueTab from './admin/tabs/LeagueTab';
import TitleTab from './admin/tabs/TitleTab';
import ClassTab from './admin/tabs/ClassTab';

// --- Styled Components ---
const AdminWrapper = styled.div`
  display: flex; gap: 2rem; padding: 2rem; max-width: 1400px; margin: 0 auto; font-family: sans-serif; align-items: flex-start;
  @media (max-width: 768px) { flex-direction: column; padding: 1rem; gap: 1.5rem; }
`;
const Sidebar = styled.nav`
  width: 220px; flex-shrink: 0; background-color: #f9f9f9; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); position: sticky; top: 2rem;
  @media (max-width: 768px) { width: 100%; position: static; top: auto; }
`;
const MainContent = styled.main`flex-grow: 1;`;
const NavList = styled.ul`list-style: none; padding: 0; margin: 0;`;
const NavItem = styled.li`margin-bottom: 0.5rem;`;
const NavButton = styled.button`
  width: 100%; padding: 0.75rem 1rem; background-color: ${props => props.$active ? '#007bff' : 'transparent'}; color: ${props => props.$active ? 'white' : 'black'}; border: none; border-radius: 6px; text-align: left; font-size: 1rem; font-weight: bold; cursor: pointer; transition: all 0.2s ease-in-out;
  &:hover { background-color: ${props => props.$active ? '#0056b3' : '#e9ecef'}; }
`;
const SubNavList = styled.ul`list-style: none; padding-left: 1rem; margin-top: 0.5rem;`;
const SubNavItem = styled.li`margin-bottom: 0.25rem;`;
const SubNavButton = styled.button`
  width: 100%; padding: 0.5rem 1rem; background-color: ${props => props.$active ? '#6c757d' : 'transparent'}; color: ${props => props.$active ? 'white' : '#343a40'}; border: none; border-radius: 4px; text-align: left; font-size: 0.9rem; cursor: pointer;
  &:hover { background-color: #e9ecef; }
`;
const Title = styled.h1`margin-top: 0; margin-bottom: 2rem; text-align: center;`;
const BroadcastButton = styled(Link)`
  display: block; width: 100%; padding: 0.75rem 1rem; margin-bottom: 1rem; background-color: #dc3545; color: white; text-decoration: none; border-radius: 6px; text-align: center; font-size: 1rem; font-weight: bold; transition: background-color 0.2s;
  &:hover { background-color: #c82333; }
`;

function AdminPage() {
    const { players } = useLeagueStore();
    const { tab } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const [activeMenu, setActiveMenu] = useState(tab || 'mission');
    const [activeSubMenu, setActiveSubMenu] = useState('messages');
    const [studentSubMenu, setStudentSubMenu] = useState('point');
    const [shopSubMenu, setShopSubMenu] = useState('avatar');
    const [preselectedStudentId, setPreselectedStudentId] = useState(null);
    const [modalImageSrc, setModalImageSrc] = useState(null);
    const [missionSubMenu, setMissionSubMenu] = useState('approval');
    const [preselectedMissionId, setPreselectedMissionId] = useState(null);

    useEffect(() => {
        const studentIdFromState = location.state?.preselectedStudentId;
        if (studentIdFromState) {
            setActiveMenu('social');
            setActiveSubMenu('messages');
            setPreselectedStudentId(studentIdFromState);
            window.history.replaceState({}, document.title)
        }
    }, [location.state]);

    const handleSendMessageClick = (studentId) => {
        navigate('/admin', { state: { preselectedStudentId: studentId } });
    };

    const handleNavigateToHistory = (missionId) => {
        setActiveMenu('mission');
        setMissionSubMenu('history');
        setPreselectedMissionId(missionId);
    };

    const renderContent = () => {
        if (activeMenu === 'mission') {
            return <MissionTab missionSubMenu={missionSubMenu} setModalImageSrc={setModalImageSrc} onNavigateToHistory={handleNavigateToHistory} preselectedMissionId={preselectedMissionId} />;
        }
        if (activeMenu === 'social') {
            return <SocialTab activeSubMenu={activeSubMenu} preselectedStudentId={preselectedStudentId} onStudentSelect={setPreselectedStudentId} />;
        }
        if (activeMenu === 'student') {
            return <StudentTab studentSubMenu={studentSubMenu} onSendMessage={handleSendMessageClick} />;
        }
        if (activeMenu === 'shop') {
            return <ShopTab shopSubMenu={shopSubMenu} />;
        }
        if (activeMenu === 'league') {
            return <LeagueTab activeSubMenu={activeSubMenu} />;
        }
        if (activeMenu === 'title') {
            return <TitleTab />;
        }
        if (activeMenu === 'quiz') {
            const myPlayer = players.find(p => p.authUid === auth.currentUser?.uid);
            return <QuizManager userRole={myPlayer?.role} />;
        }
        if (activeMenu === 'battle') {
            return <BattleAdminPanel />;
        }
        if (activeMenu === 'class') {
            return <ClassTab />;
        }
        return null;
    };

    const handleMenuClick = (menu) => {
        setActiveMenu(menu);
        if (menu === 'social') {
            if (activeMenu !== 'social') setActiveSubMenu('messages');
        } else if (menu === 'student') {
            if (activeMenu !== 'student') setStudentSubMenu('point');
        } else if (menu === 'league') {
            if (activeMenu !== 'league') setActiveSubMenu('league_manage');
        } else if (menu === 'quiz') {
            setActiveSubMenu('');
        } else if (menu === 'class') {
            setActiveSubMenu('');
        } else {
            setActiveSubMenu('');
        }
    };

    return (
        <>
            <ImageModal src={modalImageSrc?.src} rotation={modalImageSrc?.rotation} onClose={() => setModalImageSrc(null)} />
            <AdminWrapper>
                <Sidebar>
                    <BroadcastButton to="/broadcast" target="_blank">📺 방송 송출 화면</BroadcastButton>
                    <NavList>
                        <NavItem>
                            <NavButton $active={activeMenu === 'mission'} onClick={() => handleMenuClick('mission')}>미션 관리</NavButton>
                            {activeMenu === 'mission' && (
                                <SubNavList>
                                    <SubNavItem><SubNavButton $active={missionSubMenu === 'approval'} onClick={() => setMissionSubMenu('approval')}>미션 승인</SubNavButton></SubNavItem>
                                    <SubNavItem><SubNavButton $active={missionSubMenu === 'creation'} onClick={() => setMissionSubMenu('creation')}>미션 출제</SubNavButton></SubNavItem>
                                    <SubNavItem><SubNavButton $active={missionSubMenu === 'history'} onClick={() => setMissionSubMenu('history')}>기록 확인</SubNavButton></SubNavItem>
                                </SubNavList>
                            )}
                        </NavItem>
                        <NavItem>
                            <NavButton $active={activeMenu === 'quiz'} onClick={() => handleMenuClick('quiz')}>퀴즈 관리</NavButton>
                        </NavItem>
                        <NavItem>
                            <NavButton $active={activeMenu === 'social'} onClick={() => handleMenuClick('social')}>소셜 관리</NavButton>
                            {activeMenu === 'social' && (
                                <SubNavList>
                                    <SubNavItem><SubNavButton $active={activeSubMenu === 'messages'} onClick={() => setActiveSubMenu('messages')}>1:1 메시지</SubNavButton></SubNavItem>
                                    <SubNavItem><SubNavButton $active={activeSubMenu === 'myroom_comments'} onClick={() => setActiveSubMenu('myroom_comments')}>마이룸 댓글</SubNavButton></SubNavItem>
                                    <SubNavItem><SubNavButton $active={activeSubMenu === 'mission_comments'} onClick={() => setActiveSubMenu('mission_comments')}>미션 갤러리 댓글</SubNavButton></SubNavItem>
                                </SubNavList>
                            )}
                        </NavItem>
                        <NavItem>
                            <NavButton $active={activeMenu === 'student'} onClick={() => handleMenuClick('student')}>학생 관리</NavButton>
                            {activeMenu === 'student' && (
                                <SubNavList>
                                    <SubNavItem><SubNavButton $active={studentSubMenu === 'point'} onClick={() => setStudentSubMenu('point')}>포인트/역할</SubNavButton></SubNavItem>
                                    <SubNavItem><SubNavButton $active={studentSubMenu === 'list'} onClick={() => setStudentSubMenu('list')}>학생 목록</SubNavButton></SubNavItem>
                                    <SubNavItem><SubNavButton $active={studentSubMenu === 'attendance'} onClick={() => setStudentSubMenu('attendance')}>출석 확인</SubNavButton></SubNavItem>
                                </SubNavList>
                            )}
                        </NavItem>
                        <NavItem>
                            <NavButton $active={activeMenu === 'shop'} onClick={() => handleMenuClick('shop')}>상점 관리</NavButton>
                            {activeMenu === 'shop' && (
                                <SubNavList>
                                    <SubNavItem><SubNavButton $active={shopSubMenu === 'avatar'} onClick={() => setShopSubMenu('avatar')}>아바타 아이템</SubNavButton></SubNavItem>
                                    <SubNavItem><SubNavButton $active={shopSubMenu === 'myroom'} onClick={() => setShopSubMenu('myroom')}>마이룸 아이템</SubNavButton></SubNavItem>
                                </SubNavList>
                            )}
                        </NavItem>
                        <NavItem>
                            <NavButton $active={activeMenu === 'league'} onClick={() => handleMenuClick('league')}>가가볼 리그 관리</NavButton>
                            {activeMenu === 'league' && (
                                <SubNavList>
                                    <SubNavItem><SubNavButton $active={activeSubMenu === 'league_manage'} onClick={() => setActiveSubMenu('league_manage')}>시즌/팀/경기 관리</SubNavButton></SubNavItem>
                                </SubNavList>
                            )}
                        </NavItem>
                        <NavItem>
                            <NavButton $active={activeMenu === 'battle'} onClick={() => handleMenuClick('battle')}>⚔️ 배틀 관리</NavButton>
                        </NavItem>
                        <NavItem>
                            <NavButton $active={activeMenu === 'title'} onClick={() => handleMenuClick('title')}>칭호 관리</NavButton>
                        </NavItem>
                        <NavItem>
                            <NavButton $active={activeMenu === 'class'} onClick={() => handleMenuClick('class')}>학급 관리</NavButton>
                        </NavItem>
                    </NavList>
                </Sidebar>
                <MainContent>
                    <Title>👑 관리자 대시보드</Title>
                    {renderContent()}
                </MainContent>
            </AdminWrapper>
        </>
    );
}

// ─── 배틀 관리 패널 ────────────────────────────────────────────────
const BattleAdminPanelWrapper = styled.div`
  padding: 1.5rem;
  max-width: 700px;
`;
const BattleSection = styled.div`
  background: white;
  border-radius: 16px;
  padding: 1.5rem;
  margin-bottom: 1.2rem;
  box-shadow: 0 2px 12px rgba(0,0,0,0.07);
  border: 1px solid #f1f3f5;
`;
const BattleTitle = styled.h3`
  margin: 0 0 0.8rem;
  font-size: 1.05rem;
  color: #343a40;
  display: flex;
  align-items: center;
  gap: 0.4rem;
`;
const BattleBtn = styled.button`
  padding: 0.75rem 1.5rem;
  background: ${p => p.$danger ? 'linear-gradient(135deg,#f03e3e,#c92a2a)' : 'linear-gradient(135deg,#339af0,#1c7ed6)'};
  color: white;
  border: none;
  border-radius: 10px;
  font-weight: 800;
  font-size: 0.95rem;
  cursor: pointer;
  transition: opacity 0.2s;
  &:disabled { opacity: 0.5; cursor: not-allowed; }
  &:hover:not(:disabled) { opacity: 0.88; }
`;
const ResultBox = styled.div`
  margin-top: 0.8rem;
  padding: 0.8rem 1rem;
  background: #f8f9fa;
  border-radius: 10px;
  font-size: 0.88rem;
  color: #495057;
  white-space: pre-wrap;
  line-height: 1.6;
`;

function BattleAdminPanel() {
    const { classId } = useClassStore();
    const [cleaning, setCleaning] = React.useState(false);
    const [result, setResult] = React.useState(null);

    const handleCleanup = async () => {
        if (!window.confirm('진행 중인 배틀 중 5분(pending) / 3분(진행 중) 이상 무활동 상태인 배틀을 모두 취소 처리합니다.\n계속하시겠습니까?')) return;
        setCleaning(true);
        setResult(null);
        try {
            const res = await adminCleanupZombieBattles(classId);
            if (res.cleaned === 0) {
                setResult('✅ 정리할 좀비 배틀이 없습니다. 모든 배틀이 정상 상태입니다.');
            } else {
                const detail = res.details.map(d =>
                    `• [${d.status}] ${d.challenger} vs ${d.opponent}`
                ).join('\n');
                setResult(`✅ ${res.cleaned}개의 좀비 배틀을 취소 처리했습니다:\n\n${detail}`);
            }
        } catch (e) {
            setResult(`❌ 오류 발생: ${e.message}`);
        } finally {
            setCleaning(false);
        }
    };

    return (
        <BattleAdminPanelWrapper>
            <BattleSection>
                <BattleTitle>⏰ 좀비 배틀 정리</BattleTitle>
                <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: '#868e96', lineHeight: '1.6' }}>
                    비정상 종료 등으로 <strong>pending / 진행 중 상태가 멈춰버린 배틀</strong>을 일괄 취소합니다.<br />
                    특정 학생이 "상대방이 배틀 중"이라는 오류로 신청이 안 될 때 실행하세요.<br />
                    <span style={{ color: '#f03e3e' }}>※ 실제 진행 중인 배틀은 영향 없습니다 (무활동 기준으로만 판정).</span>
                </p>
                <BattleBtn onClick={handleCleanup} disabled={cleaning || !classId}>
                    {cleaning ? '정리 중...' : '🧹 좀비 배틀 정리 실행'}
                </BattleBtn>
                {result && <ResultBox>{result}</ResultBox>}
            </BattleSection>
        </BattleAdminPanelWrapper>
    );
}

export default AdminPage;