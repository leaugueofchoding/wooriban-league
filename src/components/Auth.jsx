// src/components/Auth.jsx

import React, { useState } from 'react'; // useState 추가
import { Link, useNavigate } from 'react-router-dom';
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { auth, updateUserProfile } from '../api/firebase.js';
import { useLeagueStore } from '../store/leagueStore.js';
import styled from 'styled-components';

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

// --- ▼▼▼ [추가] 알림 관련 스타일 ▼▼▼ ---
const NotificationContainer = styled.div`
    position: relative;
`;

const NotificationButton = styled.button`
    position: relative;
    background: none;
    border: none;
    font-size: 1.8rem;
    cursor: pointer;
    color: #495057;
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
    width: 300px;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    border: 1px solid #dee2e6;
    z-index: 100;
    max-height: 400px;
    overflow-y: auto;
`;

const NotificationItem = styled.div`
    padding: 1rem;
    border-bottom: 1px solid #f1f3f5;
    text-align: left;

    &:last-child {
        border-bottom: none;
    }

    h5 {
        margin: 0 0 0.25rem 0;
        font-size: 0.9rem;
    }

    p {
        margin: 0;
        font-size: 0.85rem;
        color: #495057;
    }
`;
// --- ▲▲▲ [추가] 여기까지 ---


function Auth({ user }) {
    const { notifications, unreadNotificationCount, markAsRead } = useLeagueStore();
    const navigate = useNavigate();
    const [showNotifications, setShowNotifications] = useState(false); // 알림 목록 표시 상태

    const handleGoogleLogin = () => {
        const provider = new GoogleAuthProvider();
        signInWithPopup(auth, provider)
            .then((result) => {
                updateUserProfile(result.user);
            })
            .catch((error) => {
                console.error("Google 로그인 오류:", error);
                alert(`로그인 중 오류가 발생했습니다: ${error.message}`);
            });
    };

    const handleLogout = () => {
        signOut(auth);
    };

    // --- ▼▼▼ [수정] 알림 버튼 클릭 핸들러 ▼▼▼ ---
    const handleNotificationClick = () => {
        setShowNotifications(prev => !prev); // 목록 보이기/숨기기 토글
        if (unreadNotificationCount > 0) {
            markAsRead(); // 읽음 처리
        }
    }
    // --- ▲▲▲ [수정] 여기까지 ---

    return (
        <AuthWrapper>
            {user ? (
                <UserProfile>
                    {/* --- ▼▼▼ [수정] 알림 UI 렌더링 로직 추가 ▼▼▼ --- */}
                    <NotificationContainer>
                        <NotificationButton onClick={handleNotificationClick}>
                            🔔
                            {unreadNotificationCount > 0 && <NotificationBadge />}
                        </NotificationButton>
                        {showNotifications && (
                            <NotificationList>
                                {notifications.length > 0 ? (
                                    notifications.map(notif => (
                                        <NotificationItem key={notif.id}>
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
                    {/* --- ▲▲▲ [수정] 여기까지 --- */}

                    <Link to="/profile">
                        <img src={user.photoURL} alt="프로필 사진" />
                        <span>{user.displayName}</span>
                    </Link>
                    <Button onClick={handleLogout}>로그아웃</Button>
                </UserProfile>
            ) : (
                <Button onClick={handleGoogleLogin}>Google 로그인</Button>
            )}
        </AuthWrapper>
    );
}

export default Auth;