// src/components/Auth.jsx

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom'; // useNavigate 추가
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
    
    /* 👇 [수정] 링크가 있을 때만 커서 변경 및 호버 효과 적용 */
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
    }

    p {
        margin: 0;
        font-size: 0.85rem;
        color: #495057;
    }
`;


function Auth({ user }) {
    const { notifications, unreadNotificationCount, markAsRead } = useLeagueStore();
    const navigate = useNavigate(); // 👈 [추가] useNavigate 훅 사용
    const [showNotifications, setShowNotifications] = useState(false);

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

    const handleNotificationClick = () => {
        setShowNotifications(prev => !prev);
        if (unreadNotificationCount > 0) {
            markAsRead();
        }
    }

    return (
        <AuthWrapper>
            {user ? (
                <UserProfile>
                    <NotificationContainer>
                        <NotificationButton onClick={handleNotificationClick}>
                            🔔
                            {unreadNotificationCount > 0 && <NotificationBadge />}
                        </NotificationButton>
                        {showNotifications && (
                            <NotificationList>
                                {notifications.length > 0 ? (
                                    notifications.map(notif => (
                                        <NotificationItem
                                            key={notif.id}
                                            $hasLink={!!notif.link} // 👈 [추가] link 존재 여부 전달
                                            onClick={() => {
                                                // 👈 [추가] 클릭 시 링크로 이동하는 로직
                                                if (notif.link) {
                                                    navigate(notif.link);
                                                    setShowNotifications(false); // 이동 후 알림 창 닫기
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