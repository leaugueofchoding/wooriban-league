// src/pages/AdminPage.jsx

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { useClassStore } from '../store/leagueStore';
import { auth, db, listenCommentReports } from '../api/firebase.js';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import ImageModal from '../components/ImageModal';
import QuizManager from '../components/QuizManager';
import RecorderDashboardPage from './RecorderDashboardPage';

// --- 분리된 탭 컴포넌트 임포트 ---
import MissionTab from './admin/tabs/MissionTab';
import StudentTab from './admin/tabs/StudentTab';
import SocialTab from './admin/tabs/SocialTab';
import ShopTab from './admin/tabs/ShopTab';
import LeagueTab from './admin/tabs/LeagueTab';
import TitleTab from './admin/tabs/TitleTab';
import ClassTab from './admin/tabs/ClassTab';
import ReportTab from './admin/tabs/ReportTab'; // [추가] 댓글 신고 탭

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

function AdminPage() {
    const { players } = useLeagueStore();
    const { classId } = useClassStore();
    const { tab } = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    // 초기값을 쿼리파라미터에서 바로 읽어 미션 탭으로 잘못 시작되는 문제 방지
    const getInitialMenu = () => {
        const params = new URLSearchParams(location.search);
        if (params.get('tab') === 'messages') return 'social';
        if (params.get('tab') === 'reports') return 'social'; // 소셜 하위 탭으로 변경됨
        return tab || 'mission';
    };

    const getInitialStudentSubMenu = () => {
        const params = new URLSearchParams(location.search);
        const sub = params.get('sub');
        if (sub && ['point', 'list', 'attendance'].includes(sub)) return sub;
        return 'point';
    };

    const [activeMenu, setActiveMenu] = useState(getInitialMenu);
    const [activeSubMenu, setActiveSubMenu] = useState('messages');
    const [studentSubMenu, setStudentSubMenu] = useState(getInitialStudentSubMenu);
    const [shopSubMenu, setShopSubMenu] = useState('avatar');
    const [preselectedStudentId, setPreselectedStudentId] = useState(null);
    const [modalImageSrc, setModalImageSrc] = useState(null);

    // 미션 초기 서브메뉴를 'creation'(미션 출제)으로 변경
    const [missionSubMenu, setMissionSubMenu] = useState('creation');
    const [preselectedMissionId, setPreselectedMissionId] = useState(null);
    const [pendingReportCount, setPendingReportCount] = useState(0);

    // 신고 수 실시간 구독 (사이드바 배지용)
    useEffect(() => {
        if (!classId) return;
        const unsub = listenCommentReports(classId, (reports) => {
            setPendingReportCount(reports.filter(r => r.status === 'pending').length);
        });
        return () => unsub();
    }, [classId]);

    useEffect(() => {
        const studentIdFromState = location.state?.preselectedStudentId;
        if (studentIdFromState) {
            setActiveMenu('social');
            setActiveSubMenu('messages');
            setPreselectedStudentId(studentIdFromState);
            window.history.replaceState({}, document.title);
        }
        // 알림 클릭을 통한 강제 탭 전환
        if (location.state?.forceTab === 'messages') {
            setActiveMenu('social');
            setActiveSubMenu('messages');
            window.history.replaceState({}, document.title);
        }
        // 신고 알림 클릭 시 소셜 탭의 댓글 신고로 이동
        if (location.state?.forceTab === 'reports') {
            setActiveMenu('social');
            setActiveSubMenu('reports');
            window.history.replaceState({}, document.title);
        }
        // [추가] 퀘스트/미션 승인 알림 클릭 시 미션 승인 탭으로 이동
        if (location.state?.subMenu === 'approval') {
            setActiveMenu('mission');
            setMissionSubMenu('approval');
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    // ?tab=xxx URL 파라미터로 직접 탭 진입
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tabParam = params.get('tab');
        if (tabParam === 'messages') {
            setActiveMenu('social');
            setActiveSubMenu('messages');
        }
        if (tabParam === 'reports') {
            setActiveMenu('social');
            setActiveSubMenu('reports');
        }
    }, [location.search]);

    // 브라우저 뒤로가기/앞으로가기 시 URL :tab 파라미터로 activeMenu 동기화
    useEffect(() => {
        if (!tab) return;
        const validTabs = ['mission', 'social', 'student', 'shop', 'league', 'title', 'quiz', 'class'];
        if (validTabs.includes(tab)) {
            setActiveMenu(tab);
        }
        if (tab === 'student') {
            const params = new URLSearchParams(location.search);
            const sub = params.get('sub');
            if (sub && ['point', 'list', 'attendance'].includes(sub)) {
                setStudentSubMenu(sub);
            }
        }
    }, [tab, location.search]);

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
            if (activeSubMenu === 'reports') return <ReportTab />;
            return <SocialTab activeSubMenu={activeSubMenu} preselectedStudentId={preselectedStudentId} onStudentSelect={setPreselectedStudentId} />;
        }
        if (activeMenu === 'student') {
            return <StudentTab studentSubMenu={studentSubMenu} onSendMessage={handleSendMessageClick} />;
        }
        if (activeMenu === 'shop') {
            return <ShopTab shopSubMenu={shopSubMenu} />;
        }
        if (activeMenu === 'league') {
            if (activeSubMenu === 'recorder') return <RecorderDashboardPage />;
            return <LeagueTab activeSubMenu={activeSubMenu} />;
        }
        if (activeMenu === 'title') {
            return <TitleTab />;
        }
        if (activeMenu === 'quiz') {
            const myPlayer = players.find(p => p.authUid === auth.currentUser?.uid);
            return <QuizManager userRole={myPlayer?.role} />;
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
        } else if (menu === 'mission') {
            if (activeMenu !== 'mission') setMissionSubMenu('creation');
        } else {
            setActiveSubMenu('');
        }
        // URL을 업데이트해서 브라우저 뒤로가기가 올바르게 동작하도록 함
        navigate(`/admin/${menu}`, { replace: false });
    };

    const handleStudentSubMenuClick = (subMenu) => {
        setStudentSubMenu(subMenu);
        navigate(`/admin/student?sub=${subMenu}`, { replace: false });
    };

    return (
        <>
            <ImageModal src={modalImageSrc?.src} rotation={modalImageSrc?.rotation} onClose={() => setModalImageSrc(null)} />
            <AdminWrapper>
                <Sidebar>
                    <NavList>
                        <NavItem>
                            <NavButton $active={activeMenu === 'mission'} onClick={() => handleMenuClick('mission')}>미션/퀘스트 관리</NavButton>
                            {activeMenu === 'mission' && (
                                <SubNavList>
                                    <SubNavItem><SubNavButton $active={missionSubMenu === 'creation'} onClick={() => setMissionSubMenu('creation')}>출제</SubNavButton></SubNavItem>
                                    <SubNavItem><SubNavButton $active={missionSubMenu === 'approval'} onClick={() => setMissionSubMenu('approval')}>승인</SubNavButton></SubNavItem>
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
                                    {/* 댓글 신고 탭을 소셜 관리 맨 하단으로 이동 */}
                                    <SubNavItem>
                                        <SubNavButton
                                            $active={activeSubMenu === 'reports'}
                                            onClick={() => setActiveSubMenu('reports')}
                                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                        >
                                            <span>🚨 댓글 신고</span>
                                            {pendingReportCount > 0 && (
                                                <span style={{
                                                    background: '#e03131', color: '#fff', borderRadius: '50%',
                                                    width: '20px', height: '20px', fontSize: '0.72rem', fontWeight: 700,
                                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                    flexShrink: 0
                                                }}>{pendingReportCount}</span>
                                            )}
                                        </SubNavButton>
                                    </SubNavItem>
                                </SubNavList>
                            )}
                        </NavItem>
                        <NavItem>
                            <NavButton $active={activeMenu === 'student'} onClick={() => handleMenuClick('student')}>학생 관리</NavButton>
                            {activeMenu === 'student' && (
                                <SubNavList>
                                    <SubNavItem><SubNavButton $active={studentSubMenu === 'point'} onClick={() => handleStudentSubMenuClick('point')}>포인트/역할</SubNavButton></SubNavItem>
                                    <SubNavItem><SubNavButton $active={studentSubMenu === 'list'} onClick={() => handleStudentSubMenuClick('list')}>학생 목록</SubNavButton></SubNavItem>
                                    <SubNavItem><SubNavButton $active={studentSubMenu === 'attendance'} onClick={() => handleStudentSubMenuClick('attendance')}>출석 확인</SubNavButton></SubNavItem>
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
                                    {/* 기록원 화면 및 방송 송출 화면을 하위 탭으로 이동 */}
                                    <SubNavItem><SubNavButton $active={activeSubMenu === 'recorder'} onClick={() => setActiveSubMenu('recorder')}>📝 기록원 화면</SubNavButton></SubNavItem>
                                    <SubNavItem>
                                        <SubNavButton as={Link} to="/broadcast" target="_blank" style={{ textDecoration: 'none', display: 'block', color: 'inherit' }}>
                                            📺 방송 송출 화면
                                        </SubNavButton>
                                    </SubNavItem>
                                </SubNavList>
                            )}
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

export default AdminPage;