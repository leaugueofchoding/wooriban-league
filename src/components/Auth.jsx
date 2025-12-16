// src/components/Auth.jsx

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { auth, updateUserProfile, db, rejectBattleChallenge } from '../api/firebase.js';
import { useLeagueStore, useClassStore } from '../store/leagueStore.js';
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore";
import styled from 'styled-components';
import { petImageMap } from '../utils/petImageMap'; // [추가] 이미지 맵 import

// ... (기존 상단 스타일: AuthWrapper, UserProfile, Button, IconContainer 등 유지) ...
const AuthWrapper = styled.div`
  padding: 1rem;
  text-align: right;
  background-color: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
`;

const UserProfile = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1rem;

  img {
    width: 32px;
    height: 32px;
    border-radius: 50%;
  }
  
  a {
    text-decoration: none;
    color: inherit;
    display: flex;
    align-items: center;
    gap: 10px;
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
`;

const IconContainer = styled.div`
    display: flex;
    align-items: center;
    gap: 0.75rem;
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

const ClearButton = styled.button`
    background: none;
    border: none;
    color: #007bff;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: bold;
`;

const NotificationItem = styled.div`
    padding: 1rem;
    border-bottom: 1px solid #f1f3f5;
    text-align: left;
    
    cursor: ${props => (props.$hasLink ? 'pointer' : 'default')};
    
    &:hover {
        background-color: ${props => (props.$hasLink ? '#f8f9fa' : 'white')};
    }

    &:last-child {
        border-bottom: none;
    }

    h5 {
        margin: 0 0 0.25rem 0;
        font-size: 0.9rem;
        font-weight: bold;
    }

    p {
        margin: 0;
        font-size: 0.85rem;
        color: #495057;
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

        notifications.forEach(notif => {
            if (notif.type === 'mission_request') {
                const missionTitle = notif.body.split(']')[0] + ']';
                if (!missionRequests.hasOwnProperty(missionTitle)) {
                    missionRequests[missionTitle] = { count: 0, link: notif.link, latestCreatedAt: notif.createdAt };
                }
                missionRequests[missionTitle].count += 1;
                missionRequests[missionTitle].latestCreatedAt = notif.createdAt > missionRequests[missionTitle].latestCreatedAt ? notif.createdAt : missionRequests[missionTitle].latestCreatedAt;
            } else if (notif.type === 'mission_reward' && isRecorderOrAdmin) {
                // 기록원의 보상 알림은 별도 처리하므로 목록에서 제외
            }
            else {
                otherNotifications.push(notif);
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
            // ★ 여기가 핵심: DB 상태를 starting으로 바꿔야 게임이 시작됨 ★
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

    return (
        <AuthWrapper>
            {user ? (
                <UserProfile>
                    <IconContainer>
                        <IconLink to="/">🏠</IconLink>
                        {myPlayerData?.role === 'admin' && <IconLink to="/admin">👑</IconLink>}
                        {myPlayerData?.role === 'recorder' && <IconLink to="/recorder-dashboard">📋</IconLink>}
                        <NotificationContainer ref={notificationRef}>
                            <IconButton onClick={handleNotificationClick}>
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
                                                    if (notif.link) {
                                                        navigate(notif.link);
                                                        setShowNotifications(false);
                                                    }
                                                }}
                                            >
                                                <h5>{notif.title}</h5>
                                                <p>{notif.body}</p>
                                            </NotificationItem>
                                        ))
                                    ) : (
                                        <NotificationItem>
                                            <p>새로운 알림이 없습니다.</p>
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
            {battleChallenge && (
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

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <StyledButton
                                onClick={handleAcceptBattle}
                                style={{ flex: 1, backgroundColor: '#20c997', padding: '10px', fontSize: '1.1rem' }}
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
            )}
        </AuthWrapper>
    );
}

export default Auth;