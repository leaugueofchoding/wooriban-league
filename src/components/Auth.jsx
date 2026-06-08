// src/components/Auth.jsx

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { auth, updateUserProfile, db, rejectBattleChallenge, listenNotices, listenClassSchedules } from '../api/firebase.js';
import { useLeagueStore, useClassStore } from '../store/leagueStore.js';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc } from "firebase/firestore";
import styled from 'styled-components';
import { petImageMap } from '../utils/petImageMap'; // [추가] 이미지 맵 import

// ... (기존 상단 스타일: AuthWrapper, UserProfile, Button, IconContainer 등 유지) ...
const AuthWrapper = styled.div`
  padding: 0.7rem 1rem;
  text-align: right;
  background-color: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  position: sticky;
  top: 0;
  z-index: 8000;
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: flex-end;

  @media (max-width: 768px) {
    padding: 0.5rem 0.8rem;
    min-height: 56px;
  }
`;

const UserProfile = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.6rem;
  flex-wrap: nowrap;

  img {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  
  a {
    text-decoration: none;
    color: inherit;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px;
    border-radius: 18px;
    transition: background-color 0.2s ease-in-out;

    &:hover {
        background-color: #e9ecef;
    }
  }
`;

const Button = styled.button`
  padding: 0.5rem 1rem;
  border-radius: 5px;
  border: 1px solid #ccc;
  cursor: pointer;
  background-color: white;
  white-space: nowrap;
  flex-shrink: 0;

  @media (max-width: 768px) {
    padding: 0.4rem 0.6rem;
    font-size: 0.8rem;
  }
`;

const IconContainer = styled.div`
    display: flex;
    align-items: center;
    gap: 0.5rem;

    @media (max-width: 768px) {
      gap: 0.3rem;
    }
`;

const NotificationContainer = styled.div`
    position: relative;
`;

const IconButton = styled.button`
    position: relative;
    background: none;
    border: none;
    font-size: 1.8rem;
    cursor: pointer;
    color: #495057;
    padding: 0;
    line-height: 1;

    @media (max-width: 768px) {
      font-size: 1.5rem;
    }
`;

const IconLink = styled(Link)`
    font-size: 1.8rem;
    text-decoration: none;
    color: #495057;
    line-height: 1;
    transition: transform 0.2s;
    &:hover {
        transform: scale(1.1);
    }

    @media (max-width: 768px) {
      font-size: 1.5rem;
    }
`;

const NotificationBadge = styled.div`
    position: absolute;
    top: -2px;
    right: -2px;
    width: 10px;
    height: 10px;
    background-color: #dc3545;
    border-radius: 50%;
    border: 1px solid white;
`;

const NotificationList = styled.div`
    position: absolute;
    top: 120%;
    right: 0;
    width: 350px;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    border: 1px solid #dee2e6;
    z-index: 100;
    max-height: 400px;
    overflow-y: auto;
`;

const NotificationHeader = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid #f1f3f5;
`;


// ─── 시계 + 수업 알림 스타일 ─────────────────────────────
const ClockDisplay = styled.div`
    display: flex; align-items: center; gap: 0.4rem;
    font-size: 0.9rem; font-weight: 700; color: #495057;
    background: #f1f3f5; border-radius: 20px;
    padding: 0.3rem 0.85rem; cursor: default; user-select: none;
    letter-spacing: 0.03em; flex-shrink: 0;

    @media (max-width: 600px) { font-size: 0.78rem; padding: 0.25rem 0.6rem; }
`;

const ClassAlertOverlay = styled.div`
    position: fixed; inset: 0; background: rgba(0,0,0,0.45);
    display: flex; align-items: center; justify-content: center;
    z-index: 99999;
    animation: fadeInBg 0.2s ease;
    @keyframes fadeInBg { from { opacity: 0; } to { opacity: 1; } }
`;
const ClassAlertBox = styled.div`
    background: #fff; border-radius: 20px; padding: 2.5rem 2rem;
    text-align: center; max-width: 340px; width: 90%;
    box-shadow: 0 24px 60px rgba(0,0,0,0.25);
    animation: popIn 0.25s cubic-bezier(0.34,1.56,0.64,1);
    @keyframes popIn { from { opacity:0; transform:scale(0.85); } to { opacity:1; transform:scale(1); } }
`;
const ClassAlertEmoji = styled.div`font-size: 3.5rem; margin-bottom: 0.75rem;`;
const ClassAlertTitle = styled.h3`margin: 0 0 0.5rem; font-size: 1.3rem; font-weight: 900; color: #212529;`;
const ClassAlertBody = styled.p`margin: 0 0 1.5rem; color: #495057; font-size: 0.97rem; line-height: 1.6;`;
const ClassAlertBtn = styled.button`
    padding: 0.7rem 2rem; background: #339af0; color: #fff; border: none;
    border-radius: 12px; font-size: 1rem; font-weight: 800; cursor: pointer;
    &:hover { background: #1c7ed6; }
`;

const ClearButton = styled.button`
    background: none;
    border: none;
    color: #007bff;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: bold;
`;

const NotificationItem = styled.div`
    padding: 0.85rem 1rem;
    border-bottom: 1px solid #f1f3f5;
    text-align: left;
    cursor: ${props => (props.$hasLink ? 'pointer' : 'default')};
    display: flex; align-items: flex-start; gap: 0.5rem;
    transition: background 0.15s;

    &:hover {
        background-color: ${props => (props.$hasLink ? '#f0f8ff' : 'white')};
    }

    &:last-child {
        border-bottom: none;
    }

    .notif-body { flex: 1; min-width: 0; }

    h5 {
        margin: 0 0 0.2rem 0;
        font-size: 0.88rem;
        font-weight: 800;
        color: #212529;
    }

    p {
        margin: 0;
        font-size: 0.82rem;
        color: #868e96;
        line-height: 1.4;
    }

    .arrow {
        font-size: 0.8rem; color: #adb5bd; flex-shrink: 0; margin-top: 2px;
        opacity: ${props => props.$hasLink ? 1 : 0};
    }
`;

const BonusNotificationItem = styled(NotificationItem)`
    background-color: #e7f5ff;
    border-bottom: 2px solid #bce0fd;
`;

// ▼▼▼ [추가] 펫 페이지 디자인 이식 ▼▼▼
const ModalBackground = styled.div`
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex; justify-content: center; align-items: center;
  z-index: 3000;
`;

const ModalContent = styled.div`
  padding: 2rem; background: white; border-radius: 15px;
  text-align: center; max-width: 400px; width: 90%;
  display: flex; flex-direction: column;
`;

const OpponentItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  background-color: #fff;
  padding: 1rem;
  border-radius: 12px;
  border: 1px solid #ddd;
  box-shadow: none;
  margin-bottom: 1rem;

  .user-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    text-align: center;
    width: 100%;
    
    img {
      width: 80px; height: 80px;
      border-radius: 50%;
      border: 3px solid #f8f9fa;
      object-fit: cover;
      background-color: #fff;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    strong { font-size: 1.1rem; color: #333; margin-top: 5px; display: block; }
    span { font-size: 0.9rem; color: #888; background-color: #f1f3f5; padding: 2px 8px; border-radius: 10px; margin-top: 4px;}
  }
`;

const StyledButton = styled.button`
  padding: 0.8rem; font-size: 1rem; font-weight: bold;
  border: none; border-radius: 8px; cursor: pointer;
  transition: background-color 0.2s; color: white;
  &:disabled { background-color: #6c757d; cursor: not-allowed; }
`;
// ▲▲▲ 추가 끝 ▲▲▲

function Auth({ user }) {
    const { players, notifications, unreadNotificationCount, markAsRead, approvalBonus, removeAllNotifications } = useLeagueStore();
    const { classId } = useClassStore();
    const navigate = useNavigate();
    const [showNotifications, setShowNotifications] = useState(false);
    const [battleChallenge, setBattleChallenge] = useState(null);
    const notificationRef = useRef(null);

    // ─── 시계 + 수업시간 알림 ───────────────────────────────
    const [currentTime, setCurrentTime] = useState(new Date());
    const [classSchedules, setClassSchedules] = useState([]);
    const [classAlert, setClassAlert] = useState(null); // { label, minutesLeft, start }
    const alertedRef = useRef(new Set()); // 이미 알림 보낸 키 (중복 방지)

    // 1분마다 tick
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // 수업 시간표 구독
    useEffect(() => {
        if (!classId) return;
        return listenClassSchedules(classId, setClassSchedules);
    }, [classId]);

    // 수업 시작 1분 전 감지
    useEffect(() => {
        if (!classSchedules.length) return;
        const now = currentTime;
        const hhmm = (h, m) => h * 60 + m;
        const nowMins = hhmm(now.getHours(), now.getMinutes());
        const nowSec = now.getSeconds();

        classSchedules.forEach(sched => {
            const [sh, sm] = (sched.start || '').split(':').map(Number);
            if (isNaN(sh) || isNaN(sm)) return;
            const startMins = hhmm(sh, sm);
            const diff = startMins - nowMins; // 양수면 아직 시작 전

            // 정확히 1분 전(초 0~4 구간)에만 알림 (중복 방지용 key)
            const alertKey = `${sched.label}-${sched.start}-${now.toDateString()}`;
            if (diff === 1 && nowSec < 5 && !alertedRef.current.has(alertKey)) {
                alertedRef.current.add(alertKey);
                setClassAlert({ label: sched.label || '수업', minutesLeft: 1, start: sched.start });
            }
        });
    }, [currentTime, classSchedules]);
    // ─────────────────────────────────────────────────────────

    // ▼▼▼ [추가] 공지사항 미열람 배지 ▼▼▼
    const [hasUnreadNotice, setHasUnreadNotice] = useState(false);
    const currentLocation = useLocation();
    useEffect(() => {
        if (!classId) return;
        const STORAGE_KEY = `lastSeenNotice_${classId}`;
        const unsub = listenNotices(classId, (notices) => {
            if (!notices || notices.length === 0) { setHasUnreadNotice(false); return; }
            const latest = notices[0];
            if (!latest.createdAt) { setHasUnreadNotice(false); return; }
            const latestMs = latest.createdAt.toMillis ? latest.createdAt.toMillis() : new Date(latest.createdAt).getTime();
            const lastSeen = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
            setHasUnreadNotice(latestMs > lastSeen);
        });
        return () => unsub();
    }, [classId]);

    // 공지사항 페이지 진입 시 열람 시각 기록 → 배지 제거
    useEffect(() => {
        if (currentLocation.pathname === '/notices' && classId) {
            localStorage.setItem(`lastSeenNotice_${classId}`, Date.now().toString());
            setHasUnreadNotice(false);
        }
    }, [currentLocation.pathname, classId]);
    // ▲▲▲ [추가 끝] ▲▲▲

    const myPlayerData = useMemo(() => {
        if (!user) return null;
        return players.find(p => p.authUid === user.uid);
    }, [players, user]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setShowNotifications(false);
            }
        };

        if (showNotifications) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showNotifications]);

    // 실시간으로 배틀 신청을 감지하는 리스너
    useEffect(() => {
        if (!myPlayerData?.id || !classId) return;

        const battlesRef = collection(db, 'classes', classId, 'battles');
        const q = query(battlesRef, where("opponent.id", "==", myPlayerData.id), where("status", "==", "pending"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const challengeDoc = snapshot.docs[0];
                setBattleChallenge({ id: challengeDoc.id, ...challengeDoc.data() });
            } else {
                setBattleChallenge(null);
            }
        });

        return () => unsubscribe();
    }, [myPlayerData, classId]);


    const isRecorderOrAdmin = myPlayerData && ['admin', 'recorder'].includes(myPlayerData.role);

    const groupedNotifications = useMemo(() => {
        if (!notifications) return [];

        const missionRequests = {};
        const otherNotifications = [];

        // ▼▼▼ [추가] 알림 타입별 기본 이동 경로 ▼▼▼
        const DEFAULT_LINKS = {
            'mission_request': '/admin/mission',
            'mission_approved': '/missions',
            'mission_rejected': '/missions',
            'battle_request': null,
            'pet_levelup': '/pet',
            'pet_evolve': '/pet',
            'point': '/profile',
            'quiz': '/quiz',
            'social': '/gallery',
            'heart': '/gallery',
            'notice': '/notices',
            'suggestion_admin': null,  // state로 전달 (아래 클릭 핸들러에서 처리)
            'suggestion_reply': '/suggestions',
        };
        // ▲▲▲ [추가 끝] ▲▲▲

        notifications.forEach(notif => {
            // link가 null이면 타입 기반 기본 경로 보정
            const resolvedLink = notif.link || DEFAULT_LINKS[notif.type] || null;
            const notifWithLink = { ...notif, link: resolvedLink };

            if (notif.type === 'mission_request') {
                const missionTitle = notif.body.split(']')[0] + ']';
                if (!missionRequests.hasOwnProperty(missionTitle)) {
                    missionRequests[missionTitle] = { count: 0, link: resolvedLink, latestCreatedAt: notif.createdAt };
                }
                missionRequests[missionTitle].count += 1;
                missionRequests[missionTitle].latestCreatedAt = notif.createdAt > missionRequests[missionTitle].latestCreatedAt ? notif.createdAt : missionRequests[missionTitle].latestCreatedAt;
            } else if (notif.type === 'mission_reward' && isRecorderOrAdmin) {
                // 기록원의 보상 알림은 별도 처리하므로 목록에서 제외
            } else {
                otherNotifications.push(notifWithLink);
            }
        });

        const requestSummaries = Object.entries(missionRequests).map(([title, data]) => ({
            id: title, isGrouped: true, title: `승인 요청 (${data.count}건)`,
            body: `${title} 미션의 승인 요청이 ${data.count}건 있습니다.`,
            link: data.link, createdAt: data.latestCreatedAt
        }));

        const sortedNotifications = [...requestSummaries, ...otherNotifications].sort((a, b) => {
            const dateA = a.createdAt ? a.createdAt.toMillis() : 0;
            const dateB = b.createdAt ? b.createdAt.toMillis() : 0;
            return dateB - dateA;
        });

        return sortedNotifications;

    }, [notifications, isRecorderOrAdmin]);

    const handleGoogleLogin = () => {
        const provider = new GoogleAuthProvider();
        signInWithPopup(auth, provider)
            .then((result) => updateUserProfile(result.user))
            .catch((error) => console.error("Google 로그인 오류:", error));
    };

    const handleLogout = () => signOut(auth);

    const handleNotificationClick = () => {
        setShowNotifications(prev => !prev);
        if (!showNotifications && unreadNotificationCount > 0) {
            markAsRead();
        }
    }

    const handleClearAll = () => {
        removeAllNotifications(user.uid);
    };

    const handleAcceptBattle = async () => {
        if (!battleChallenge || !classId) return;

        // [수정] 내 펫 기절 상태 체크 (안전하게 처리)
        const myPet = myPlayerData.pets.find(p => p.id === myPlayerData.partnerPetId) || myPlayerData.pets[0];

        if (!myPet || myPet.hp <= 0) {
            alert("나의 펫이 기절 상태라 대결을 수락할 수 없습니다.\n펫 센터에서 치료해주세요.");
            return;
        }

        try {
            const battleRef = doc(db, 'classes', classId, 'battles', battleChallenge.id);
            const todayStr = new Date().toLocaleDateString();

            // 배틀 카운트 증가 헬퍼 (challenger / opponent 공통)
            const incrementBattleCount = async (playerId) => {
                const playerRef = doc(db, 'classes', classId, 'players', playerId);
                const snap = await getDoc(playerRef);
                if (!snap.exists()) return;
                const data = snap.data();
                const pets = JSON.parse(JSON.stringify(data.pets || []));
                const idx = pets.findIndex(p => p.id === data.partnerPetId);
                if (idx === -1) return;
                const pet = pets[idx];
                const count = pet.lastBattleDate === todayStr ? (pet.dailyBattleCount || 0) : 0;
                pets[idx] = { ...pet, lastBattleDate: todayStr, dailyBattleCount: count + 1 };
                await updateDoc(playerRef, { pets });
            };

            // ★ 신청자(challenger) + 수락자(opponent) 모두 배틀 횟수 증가
            await Promise.all([
                incrementBattleCount(battleChallenge.challenger.id),
                incrementBattleCount(myPlayerData.id),
            ]);

            // DB 상태를 starting으로 전환 → 게임 시작
            await updateDoc(battleRef, { "opponent.accepted": true, status: 'starting' });
            navigate(`/battle/${battleChallenge.challenger.id}`);
            setBattleChallenge(null);
        } catch (error) {
            console.error("수락 처리 중 오류:", error);
            alert("대결 수락 중 오류가 발생했습니다.");
        }
    };

    const handleRejectBattle = async () => {
        if (!battleChallenge || !classId) return;
        await rejectBattleChallenge(classId, battleChallenge.id);
        setBattleChallenge(null);
    };

    // 시계 포맷
    const timeStr = currentTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

    return (
        <>
            {/* 수업 시작 알림 팝업 */}
            {classAlert && (
                <ClassAlertOverlay>
                    <ClassAlertBox>
                        <ClassAlertEmoji>🔔</ClassAlertEmoji>
                        <ClassAlertTitle>{classAlert.label} 1분 전!</ClassAlertTitle>
                        <ClassAlertBody>
                            <strong>{classAlert.start}</strong>에 {classAlert.label}이(가) 시작됩니다.<br />
                            지금 바로 수업 준비를 해주세요! 📚
                        </ClassAlertBody>
                        <ClassAlertBtn onClick={() => setClassAlert(null)}>알겠어요!</ClassAlertBtn>
                    </ClassAlertBox>
                </ClassAlertOverlay>
            )}
            <AuthWrapper>
                {user ? (
                    <UserProfile>
                        {/* 시계 표시 */}
                        <ClockDisplay>🕐 {timeStr}</ClockDisplay>
                        <IconContainer>
                            <IconLink to="/">🏠</IconLink>
                            {(myPlayerData?.role === 'admin' || myPlayerData?.role === 'recorder') && (
                                <IconLink to="/recorder-dashboard" title="기록원 대시보드">📝</IconLink>
                            )}
                            {myPlayerData?.role === 'admin' && <IconLink to="/admin">👑</IconLink>}
                            <div style={{ position: 'relative', display: 'inline-flex' }}>
                                <IconLink to="/notices" title="공지사항">📢</IconLink>
                                {hasUnreadNotice && (
                                    <span style={{
                                        position: 'absolute', top: '2px', right: '2px',
                                        width: '8px', height: '8px', borderRadius: '50%',
                                        background: '#fa5252', border: '1.5px solid white',
                                        pointerEvents: 'none',
                                    }} />
                                )}
                            </div>
                            <NotificationContainer ref={notificationRef}>
                                <IconButton data-bell-btn onClick={handleNotificationClick}>
                                    🔔
                                    {unreadNotificationCount > 0 && <NotificationBadge />}
                                </IconButton>
                                {showNotifications && (
                                    <NotificationList>
                                        <NotificationHeader>
                                            <h5 style={{ margin: 0 }}>알림</h5>
                                            <ClearButton onClick={handleClearAll}>전체 삭제</ClearButton>
                                        </NotificationHeader>

                                        {isRecorderOrAdmin && approvalBonus > 0 && (
                                            <BonusNotificationItem>
                                                <h5>💰 오늘의 기록 보너스</h5>
                                                <p>미션 승인 및 경기 기록 보너스로 총 {approvalBonus}P를 획득했습니다.</p>
                                            </BonusNotificationItem>
                                        )}

                                        {groupedNotifications.length > 0 ? (
                                            groupedNotifications.map(notif => (
                                                <NotificationItem
                                                    key={notif.id}
                                                    $hasLink={!!notif.link}
                                                    onClick={() => {
                                                        if (notif.type === 'suggestion_admin') {
                                                            // state로 전달해야 재마운트 없이 탭이 바뀜
                                                            navigate('/admin', { state: { forceTab: 'messages' } });
                                                            setShowNotifications(false);
                                                            return;
                                                        }
                                                        // [추가] 댓글 신고 알림 → 관리자 신고 탭으로 이동
                                                        if (notif.type === 'comment_report') {
                                                            navigate('/admin', { state: { forceTab: 'reports' } });
                                                            setShowNotifications(false);
                                                            return;
                                                        }
                                                        if (notif.link) {
                                                            navigate(notif.link);
                                                            setShowNotifications(false);
                                                        }
                                                    }}
                                                >
                                                    <div className="notif-body">
                                                        <h5>{notif.title}</h5>
                                                        <p>{notif.body}</p>
                                                    </div>
                                                    <span className="arrow">›</span>
                                                </NotificationItem>
                                            ))
                                        ) : (
                                            <NotificationItem>
                                                <div className="notif-body"><p>새로운 알림이 없습니다.</p></div>
                                            </NotificationItem>
                                        )}
                                    </NotificationList>
                                )}
                            </NotificationContainer>
                        </IconContainer>
                        <Link to="/profile">
                            <img src={user.photoURL} alt="프로필 사진" />
                            <span>{user.displayName}</span>
                        </Link>
                        <Button onClick={handleLogout}>로그아웃</Button>
                    </UserProfile>
                ) : (
                    <Button onClick={handleGoogleLogin}>Google 로그인</Button>
                )}

                {/* ▼▼▼ [수정] 모달 디자인을 신버전으로 교체 ▼▼▼ */}
                {battleChallenge && (() => {
                    // [버그 수정] 내 파트너펫 기절 상태 미리 확인
                    const myPetForBattle = myPlayerData?.pets?.find(p => p.id === myPlayerData?.partnerPetId) || myPlayerData?.pets?.[0];
                    const myPetFainted = !myPetForBattle || myPetForBattle.hp <= 0;
                    return (
                        <ModalBackground>
                            <ModalContent>
                                <h2 style={{ color: '#dc3545', margin: '0 0 1rem 0' }}>📢 도전장이 도착했습니다!</h2>

                                <OpponentItem>
                                    <div className="user-info">
                                        <img
                                            src={petImageMap[`${battleChallenge.challenger?.pet?.appearanceId}_idle`] || petImageMap['slime_lv1_idle']}
                                            alt="도전자 펫"
                                        />
                                        <div>
                                            <strong>{battleChallenge.challenger?.name}</strong>
                                            <span>{battleChallenge.challenger?.pet?.name} (Lv.{battleChallenge.challenger?.pet?.level})</span>
                                        </div>
                                    </div>
                                </OpponentItem>

                                {myPetFainted && (
                                    <div style={{ background: '#fff5f5', border: '1px solid #ffc9c9', borderRadius: '8px', padding: '0.6rem 0.8rem', marginBottom: '0.8rem', fontSize: '0.9rem', color: '#c92a2a', textAlign: 'center' }}>
                                        ⚠️ 내 펫이 기절 상태입니다. 펫 센터에서 치료 후 수락할 수 있습니다.
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <StyledButton
                                        onClick={handleAcceptBattle}
                                        disabled={myPetFainted}
                                        style={{ flex: 1, backgroundColor: myPetFainted ? '#adb5bd' : '#20c997', padding: '10px', fontSize: '1.1rem', cursor: myPetFainted ? 'not-allowed' : 'pointer' }}
                                    >
                                        ⚔️ 수락
                                    </StyledButton>
                                    <StyledButton
                                        onClick={handleRejectBattle}
                                        style={{ flex: 1, backgroundColor: '#adb5bd', padding: '10px', fontSize: '1.1rem' }}
                                    >
                                        거절
                                    </StyledButton>
                                </div>
                            </ModalContent>
                        </ModalBackground>
                    );
                })()}
            </AuthWrapper>
        </>
    );
}

export default Auth;