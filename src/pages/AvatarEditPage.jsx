import React, { useState } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';

const EditWrapper = styled.div`
  max-width: 500px;
  margin: 2rem auto;
  padding: 2rem;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
`;

const Title = styled.h2`
  text-align: center;
  margin-top: 0;
  margin-bottom: 2rem;
`;

const AvatarCanvas = styled.div`
  width: 250px;
  height: 250px;
  border-radius: 50%;
  background-color: #e9ecef;
  margin: 0 auto 2rem;
  position: relative;
  border: 4px solid #fff;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
`;

const Inventory = styled.div`
  border: 1px solid #dee2e6;
  border-radius: 8px;
  overflow: hidden;
`;

const TabContainer = styled.div`
  display: flex;
  background-color: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  overflow-x: auto;
`;

const Tab = styled.div`
  padding: 10px 15px;
  cursor: pointer;
  font-weight: 500;
  border-bottom: 3px solid transparent;
  white-space: nowrap;
  
  &.active {
    border-bottom-color: #007bff;
    color: #007bff;
  }
`;

const PartGrid = styled.div`
  padding: 1rem;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
  gap: 10px;
  
  /* --- 핵심 수정: 스크롤 기능 추가 --- */
  max-height: 200px; /* 아이템 목록의 최대 높이 지정 */
  overflow-y: auto;  /* 아이템이 많아지면 세로 스크롤 생성 */
`;

const PartItem = styled.div`
  width: 60px;
  height: 60px;
  border: 2px solid #ccc;
  border-radius: 8px;
  cursor: pointer;
  background-color: white;
  
  &.selected {
    border-color: #007bff;
    box-shadow: 0 0 0 2px #007bff;
  }
`;

const ButtonGroup = styled.div`
  margin-top: 2rem;
  display: flex;
  justify-content: center;
  gap: 1rem;
`;

const Button = styled.button`
  padding: 0.8em 1.5em;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
`;

function AvatarEditPage() {
    const navigate = useNavigate();

    // 아이템이 많아진 상황을 가정하기 위해 임시로 데이터 양을 늘림
    const partCategories = {
        '얼굴': [1, 2],
        '눈': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], // 눈 아이템을 10개로 가정
        '코': [1, 2],
        '입': [1, 2, 3],
        '머리': [1, 2, 3, 4],
        '상의': [1, 2, 3],
        '하의': [1, 2],
        '신발': [1, 2],
        '액세서리': [1, 2, 3]
    };

    const [activeTab, setActiveTab] = useState('얼굴');

    return (
        <EditWrapper>
            <Title>아바타 꾸미기</Title>

            <AvatarCanvas>
                {/* 선택된 파츠들이 여기에 이미지로 겹쳐서 표시될 예정 */}
            </AvatarCanvas>

            <Inventory>
                <TabContainer>
                    {Object.keys(partCategories).map(category => (
                        <Tab
                            key={category}
                            className={activeTab === category ? 'active' : ''}
                            onClick={() => setActiveTab(category)}
                        >
                            {category}
                        </Tab>
                    ))}
                </TabContainer>

                <PartGrid>
                    {partCategories[activeTab].map(partId => (
                        <PartItem key={partId}>
                            {/* 각 파츠의 썸네일 이미지가 표시될 예정 */}
                        </PartItem>
                    ))}
                </PartGrid>
            </Inventory>

            <ButtonGroup>
                <Button onClick={() => navigate(-1)} style={{ backgroundColor: '#6c757d', color: 'white' }}>취소</Button>
                <Button style={{ backgroundColor: '#28a745', color: 'white' }}>저장하기</Button>
            </ButtonGroup>
        </EditWrapper>
    );
}

export default AvatarEditPage;