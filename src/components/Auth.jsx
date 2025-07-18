import React from 'react';
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { auth } from '../api/firebase.js'; // .js 확장자 명시
import styled from 'styled-components';
import { updateUserProfile } from '../api/firebase.js'; // 새로 만든 함수 import


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
                // 로그인이 성공하면, result.user에 사용자 정보가 담겨옵니다.
                // 이 정보를 'users' 컬렉션에 저장합니다.
                updateUserProfile(result.user);
            })
            .catch((error) => {
                console.error("Google 로그인 오류:", error);
            });
    };

    const handleLogout = () => {
        signOut(auth);
    };

    return (
        <AuthWrapper>
            {user ? (
                <UserProfile>
                    <img src={user.photoURL} alt="프로필 사진" />
                    <span>{user.displayName}</span>
                    <Button onClick={handleLogout}>로그아웃</Button>
                </UserProfile>
            ) : (
                <Button onClick={handleGoogleLogin}>Google 로그인</Button>
            )}
        </AuthWrapper>
    );
}



// 이 부분이 가장 중요합니다!
export default Auth;