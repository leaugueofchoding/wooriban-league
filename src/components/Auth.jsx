// src/components/Auth.jsx

import React from 'react';
import { Link, useNavigate } from 'react-router-dom'; // useNavigate 추가
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { auth, updateUserProfile } from '../api/firebase.js';
import { useLeagueStore } from '../store/leagueStore.js'; // store 추가
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
  gap: 1rem; // 간격 조정

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

// [추가] 알림 버튼 스타일
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

function Auth({ user }) {
    // [수정] store에서 알림 상태와 액션을 가져옵니다.
    const { unreadNotificationCount, markAsRead } = useLeagueStore();
    const navigate = useNavigate();

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
        if (unreadNotificationCount > 0) {
            markAsRead();
        }
        navigate('/'); // 클릭 시 대시보드로 이동
    }

    return (
        <AuthWrapper>
            {user ? (
                <UserProfile>
                    {/* [추가] 알림 버튼 */}
                    <NotificationButton onClick={handleNotificationClick}>
                        🔔
                        {unreadNotificationCount > 0 && <NotificationBadge />}
                    </NotificationButton>

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