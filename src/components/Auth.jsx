import React from 'react';
import { Link } from 'react-router-dom';
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { auth, updateUserProfile } from '../api/firebase.js';
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
  gap: 10px;

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

function Auth({ user }) {

    const handleGoogleLogin = () => {
        const provider = new GoogleAuthProvider();
        signInWithPopup(auth, provider)
            .then((result) => {
                // 로그인이 성공하면, result.user 정보를 'users' 컬렉션에 저장합니다.
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

    return (
        <AuthWrapper>
            {user ? (
                <UserProfile>
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