import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { createQuizSet, getQuizSets, deleteQuizSet, setClassActiveQuizSets, getActiveQuizSets, auth } from '../api/firebase';
import { useClassStore } from '../store/leagueStore';

// --- 스타일 컴포넌트 ---
const Wrapper = styled.div`
  padding: 1rem; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);
`;
const Section = styled.div`
  background: #f8f9fa; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; border: 1px solid #e9ecef;
`;
const TitleInput = styled.input`
  width: 100%; padding: 0.8rem; font-size: 1.2rem; font-weight: bold; border: 2px solid #007bff; border-radius: 8px; margin-bottom: 1rem;
`;
const InputGroup = styled.div`
  margin-bottom: 1rem;
  label { display: block; font-weight: bold; margin-bottom: 0.5rem; color: #495057; }
  input, select, textarea { width: 100%; padding: 0.6rem; border: 1px solid #ced4da; border-radius: 6px; font-size: 0.95rem; }
`;
const Button = styled.button`
  padding: 0.6rem 1.2rem; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; color: white;
  background-color: ${props => props.color || '#007bff'};
  &:hover { opacity: 0.9; }
  &:disabled { background-color: #ccc; cursor: not-allowed; }
`;
const QuizList = styled.div` display: flex; flex-direction: column; gap: 1rem; margin-top: 1rem; `;
const QuizCard = styled.div`
  border: 1px solid #dee2e6; border-radius: 8px; padding: 1rem; background: white; position: relative;
  border-left: 5px solid ${props => props.type === 'ox' ? '#ff6b6b' : (props.type === 'multiple' ? '#51cf66' : '#339af0')};
`;
const Tag = styled.span`
  background: #e9ecef; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; color: #495057; margin-right: 0.5rem;
`;
const SearchBar = styled.div`
  display: flex; gap: 0.5rem; margin-bottom: 1.5rem; flex-wrap: wrap;
  select, input { padding: 0.5rem; border: 1px solid #ced4da; border-radius: 6px; }
  input { flex-grow: 1; }
`;

// ▼▼▼ [대규모 데이터] 기존 퀴즈 모음 ▼▼▼

// 1. 수학 (6학년 2학기)
const DATA_MATH = [
    { type: 'multiple', question: '가로 10cm, 세로 5cm, 높이 4cm인 직육면체의 부피는 몇 cm³인가요?', answer: '200', score: 10, options: ['100', '150', '200', '250'] },
    { type: 'multiple', question: '한 변의 길이가 8cm인 정육면체의 겉넓이는 몇 cm²인가요?', answer: '384', score: 10, options: ['384', '256', '512', '196'] },
    { type: 'multiple', question: '전체 100g에 소금이 20g 들어있는 소금물이 있습니다. 소금의 양의 비율을 백분율로 나타내면 몇 %인가요?', answer: '20', score: 10, options: ['10', '20', '25', '30'] },
    { type: 'multiple', question: '정가 10000원인 학용품을 20% 할인하여 판매할 때, 할인되는 금액은 얼마인가요?', answer: '2000', score: 10, options: ['1000', '1500', '2000', '2500'] },
    { type: 'multiple', question: '밑면의 가로가 6m, 세로 5m이고 높이가 3m인 직육면체 모양 창고의 부피는 몇 m³인가요?', answer: '90', score: 10, options: ['60', '80', '90', '100'] },
    { type: 'multiple', question: '비율 0.75를 백분율로 나타내면 몇 %인가요?', answer: '75', score: 10, options: ['7.5', '75', '750', '0.75'] },
    { type: 'multiple', question: '밑면의 한 변의 길이가 4cm인 정육면체의 부피는 몇 cm³인가요?', answer: '64', score: 10, options: ['16', '32', '64', '128'] },
    { type: 'multiple', question: '어느 마을의 인구는 2500명이고 넓이는 5km²입니다. 이 마을의 인구 밀도는 몇 명/km²인가요?', answer: '500', score: 10, options: ['250', '500', '1000', '1250'] },
    { type: 'multiple', question: '가로 2cm, 세로 5cm, 높이 9cm인 직육면체의 겉넓이는 몇 cm²인가요?', answer: '166', score: 10, options: ['146', '156', '166', '176'] },
    { type: 'multiple', question: '축구 경기에서 5개의 슛을 시도하여 2개의 골을 넣었습니다. 슛 개수에 대한 골 수의 비율을 소수로 나타내면 얼마인가요?', answer: '0.4', score: 10, options: ['0.2', '0.4', '0.5', '0.25'] },
    { type: 'multiple', question: '1m³는 몇 cm³와 같을까요?', answer: '1000000', score: 10, options: ['1000', '10000', '100000', '1000000'] },
    { type: 'multiple', question: '4대 5와 비율이 같은 비를 찾아보세요.', answer: '12:15', score: 10, options: ['8:12', '12:15', '15:20', '16:25'] },
    { type: 'multiple', question: '어느 공장에서 만든 물건 200개 중 불량품이 10개 나왔습니다. 불량률은 몇 %인가요?', answer: '5', score: 10, options: ['2', '5', '10', '20'] },
    { type: 'multiple', question: '가로 3cm, 세로 7cm, 높이가 11cm인 직육면체의 부피가 231cm³일 때, 높이는 몇 cm인가요?', answer: '7', score: 10, options: ['7', '9', '11', '13'] },
    { type: 'multiple', question: '비 3:8에서 기준량은 무엇인가요?', answer: '8', score: 10, options: ['3', '5', '8', '11'] },
    { type: 'multiple', question: '한 모서리의 길이가 10cm인 정육면체의 겉넓이는 몇 cm²인가요?', answer: '600', score: 10, options: ['100', '600', '1000', '60'] },
    { type: 'multiple', question: '어느 학교의 남학생은 300명, 여학생은 200명입니다. 전체 학생 수에 대한 여학생 수의 비율은 얼마인가요?', answer: '2/5', score: 10, options: ['2/3', '3/5', '2/5', '1/2'] },
    { type: 'multiple', question: '부피가 27000cm³인 정육면체의 한 모서리의 길이는 몇 cm인가요?', answer: '30', score: 10, options: ['20', '30', '40', '90'] },
    { type: 'multiple', question: '속력이 80km/h인 자동차가 3시간 동안 달린 거리는 몇 km인가요?', answer: '240', score: 10, options: ['160', '240', '320', '80'] },
    { type: 'multiple', question: '판매 가격이 12000원인 옷을 30% 할인된 가격에 샀습니다. 지불해야 할 금액은 얼마인가요?', answer: '8400', score: 10, options: ['3600', '8000', '8400', '9000'] },
    { type: 'multiple', question: '한 변의 길이가 5cm인 정사각형을 밑면으로 하고 높이가 10cm인 사각기둥의 부피는 몇 cm³인가요?', answer: '250', score: 10, options: ['100', '200', '250', '500'] },
    { type: 'multiple', question: '비 4:9를 비율로 나타낼 때, 분수로 나타내면 얼마인가요?', answer: '4/9', score: 10, options: ['9/4', '4/9', '5/9', '4/5'] },
    { type: 'multiple', question: '가로 6cm, 세로 4cm, 높이 2cm인 직육면체 모양의 상자를 포장하려고 합니다. 필요한 포장지의 최소 넓이(겉넓이)는 몇 cm²인가요?', answer: '88', score: 10, options: ['48', '68', '88', '108'] },
    { type: 'multiple', question: '농구 선수가 자유투 20개를 던져 16개를 성공시켰습니다. 성공률은 몇 %인가요?', answer: '80', score: 10, options: ['70', '75', '80', '85'] },
    { type: 'multiple', question: '밑면의 넓이가 25m²이고 부피가 200m³인 직육면체의 높이는 몇 m인가요?', answer: '8', score: 10, options: ['4', '6', '8', '10'] },
    { type: 'multiple', question: '2500000cm³는 몇 m³와 같나요?', answer: '2.5', score: 10, options: ['0.25', '2.5', '25', '250'] },
    { type: 'multiple', question: '비율 3/4을 백분율로 나타내면 몇 %인가요?', answer: '75', score: 10, options: ['25', '50', '75', '100'] },
    { type: 'subjective', question: '한 모서리의 길이가 6cm인 정육면체 2개를 이어 붙여 만든 직육면체의 겉넓이는 몇 cm²인가요? (숫자만 입력)', answer: '360', score: 10 },
    { type: 'subjective', question: '어떤 일을 하는데 5시간이 걸렸습니다. 전체 일의 40%를 마쳤다면, 몇 시간을 일한 것인가요? (숫자만 입력)', answer: '2', score: 10 },
    { type: 'subjective', question: '두 수의 비가 3:7이고, 비교하는 양이 21일 때 기준량은 얼마인가요? (숫자만 입력)', answer: '49', score: 10 },
    { type: 'subjective', question: '부피가 1m³인 정육면체의 한 모서리의 길이는 몇 cm인가요? (숫자만 입력)', answer: '100', score: 10 },
    { type: 'subjective', question: '지도에서 1cm가 실제 거리 500m를 나타냅니다. 지도에서 4cm 떨어진 두 지점의 실제 거리는 몇 km인가요? (숫자만 입력)', answer: '2', score: 10 },
    { type: 'subjective', question: '어느 가게의 이번 달 매출액은 500만원으로, 지난달보다 25% 증가했습니다. 지난달 매출액은 얼마였을까요? (숫자만 입력)', answer: '4000000', score: 10 },
    { type: 'subjective', question: '가로 8cm, 세로 5cm인 직사각형을 밑면으로 하고 높이가 10cm인 직육면체의 모든 모서리 길이의 합은 몇 cm인가요? (숫자만 입력)', answer: '92', score: 10 },
    { type: 'subjective', question: '타율이 3할(0.3)인 야구선수가 40번 타석에 들어섰을 때, 약 몇 개의 안타를 칠 것으로 기대할 수 있나요? (숫자만 입력)', answer: '12', score: 10 },
    { type: 'subjective', question: '겉넓이가 150cm²인 정육면체의 부피는 몇 cm³인가요? (숫자만 입력)', answer: '125', score: 10 },
    { type: 'subjective', question: 'A 기계는 3시간 동안 180개의 부품을, B 기계는 5시간 동안 250개의 부품을 만듭니다. 시간당 생산량의 비를 가장 간단한 자연수의 비로 나타내면? (예: 1:2)', answer: '6:5', score: 10 },
    { type: 'subjective', question: '가로 20cm, 세로 30cm, 높이 40cm인 직육면체 모양의 수조에 물을 가득 채우려면 몇 L의 물이 필요한가요? (1L=1000cm³, 숫자만 입력)', answer: '24', score: 10 },
    { type: 'subjective', question: '어떤 상품의 원가에 20%의 이익을 붙여 정가를 정했습니다. 정가가 6000원일 때, 원가는 얼마인가요? (숫자만 입력)', answer: '5000', score: 10 },
    { type: 'subjective', question: '가로, 세로, 높이가 각각 2cm, 4cm, 8cm인 직육면체와 부피가 같은 정육면체의 한 모서리의 길이는 몇 cm인가요? (숫자만 입력)', answer: '4', score: 10 },
];

// 2. 기본상식
const DATA_COMMON = [
    { type: 'multiple', question: '대한민국의 수도는?', answer: '서울', score: 10, options: ['부산', '서울', '인천', '대구'] },
    { type: 'multiple', question: '세종대왕이 만든 문자는?', answer: '한글', score: 10, options: ['한자', '이두', '한글', '가림토'] },
    { type: 'multiple', question: '곤충을 세 부분으로 나누면? 머리 OO 배', answer: '가슴', score: 10, options: ['허리', '다리', '가슴', '날개'] },
    { type: 'multiple', question: '사과, 포도, 바나나는 통틀어 무엇이라고 부를까요?', answer: '과일', score: 10, options: ['채소', '곡물', '과일', '견과'] },
    { type: 'multiple', question: '태양계의 첫 번째 행성은?', answer: '수성', score: 10, options: ['금성', '수성', '지구', '화성'] },
    { type: 'multiple', question: '1년은 몇 달인가요?', answer: '12', score: 10, options: ['10', '11', '12', '13'] },
    { type: 'multiple', question: "'OOO'도 밟으면 꿈틀한다. OOO에 들어갈 말은?", answer: '지렁이', score: 10, options: ['개미', '지렁이', '달팽이', '굼벵이'] },
    { type: 'multiple', question: '컴퓨터에서 복사하기 단축키는 Ctrl + ?', answer: 'C', score: 10, options: ['V', 'X', 'C', 'Z'] },
    { type: 'multiple', question: '거북선을 만든 장군은 이순신으로 알려져 있습니다. 실제로는 이순신 휘하의 OOO 인데요. 나씨 성을 가진 이 장수의 이름은?', answer: '나대용', score: 10, options: ['나대용', '나석주', '나운규', '나혜석'] },
    { type: 'multiple', question: '세상에서 가장 높은 산은?', answer: '에베레스트', score: 10, options: ['백두산', '한라산', '후지산', '에베레스트'] },
    { type: 'multiple', question: '1분은 몇 초인가요?', answer: '60', score: 10, options: ['30', '50', '60', '100'] },
    { type: 'multiple', question: '우리나라의 국화는?', answer: '무궁화', score: 10, options: ['장미', '무궁화', '진달래', '개나리'] },
    { type: 'multiple', question: '벌레를 잡아먹는 식물을 총칭하여 무엇이라 할까요?', answer: '식충식물', score: 10, options: ['관엽식물', '다육식물', '식충식물', '수생식물'] },
    { type: 'multiple', question: '달리기 경주에서 2등을 추월하면 몇 등일까요?', answer: '2', score: 10, options: ['1', '2', '3', '4'] },
    { type: 'multiple', question: '우리반 포트폴리오를 책임지는 타공기는 구멍을 몇 개 뜷어줄까요?', answer: '30', score: 10, options: ['20', '26', '30', '34'] },
    { type: 'multiple', question: '북한에선 죽은 지 몇 년동안 성묘를 할 수 있나요?', answer: '3', score: 10, options: ['1', '3', '5', '10'] },
    { type: 'multiple', question: '우리반 여자 부회장 이름은?', answer: '강하윤', score: 10, options: ['김민지', '이서현', '강하윤', '박지민'] },
    { type: 'multiple', question: '김태연 선생님은 강아지와 고양이 중 무엇을 더 좋아할까요?', answer: '고양이', score: 10, options: ['강아지', '고양이', '햄스터', '토끼'] },
    { type: 'multiple', question: '우리반 남자 부회장 이름은?', answer: '김민준', score: 10, options: ['이준호', '김민준', '박서준', '최우식'] },
    { type: 'multiple', question: '축구는 한 팀에 몇 명이 뛰나요?', answer: '11', score: 10, options: ['9', '10', '11', '12'] },
    { type: 'multiple', question: '씨름도를 그린 화가는?', answer: '김홍도', score: 10, options: ['신윤복', '김홍도', '정선', '김정희'] },
    { type: 'subjective', question: '조선을 건국한 태조의 이름은?', answer: '이성계', score: 10 },
    { type: 'subjective', question: '전 세계에서 가장 큰 대양은?', answer: '태평양', score: 10 },
    { type: 'subjective', question: '화창초 교장선생님의 성함은?', answer: '배부자', score: 10 },
    { type: 'subjective', question: '전화기를 발명한 사람은?', answer: '벨', score: 10 },
    { type: 'subjective', question: '피카소는 어느 나라 화가일까요?', answer: '스페인', score: 10 },
    { type: 'subjective', question: '세계에서 가장 인구가 많은 나라는? (2024년 기준)', answer: '인도', score: 10 },
    { type: 'subjective', question: '우리 반 회장의 이름은?', answer: '이성주', score: 10 },
    { type: 'subjective', question: '컴퓨터의 "뇌"에 해당하는 가장 중요한 부품은?', answer: 'CPU', score: 10 },
    { type: 'ox', question: '달리기와 걷기의 차이는 두 발이 모두 땅에서 떨어지는 순간이 있는지 여부다.', answer: 'O', score: 10 },
];

// 3. 과학상식
const DATA_SCIENCE = [
    { type: 'multiple', question: '지구가 스스로 한 바퀴 도는 것을 무엇이라고 할까요?', answer: '자전', score: 10, options: ['자전', '공전', '회전', '반전'] },
    { type: 'multiple', question: '물체가 위로 떠오르게 하는 힘은?', answer: '부력', score: 10, options: ['중력', '마찰력', '부력', '탄성력'] },
    { type: 'multiple', question: '자석의 힘을 자력이라 합니다. 서로 밀어내는 힘은 척력이고 끌어당기는 힘은 OO입니다.', answer: '인력', score: 10, options: ['인력', '중력', '장력', '마찰력'] },
    { type: 'multiple', question: '액체괴물을 영어로 하면?', answer: '슬라임', score: 10, options: ['젤리', '슬라임', '푸딩', '머드'] },
    { type: 'multiple', question: '땅속의 열을 받아 뜨거운 물이나 수증기가 뿜어져 나오는 곳을 무엇이라 하나요?', answer: '온천', score: 10, options: ['화산', '온천', '간헐천', '용암'] },
    { type: 'multiple', question: '물은 몇 도에서 끓기 시작할까요?', answer: '100', score: 10, options: ['80', '90', '100', '120'] },
    { type: 'multiple', question: '소리를 듣는 우리 몸의 기관은?', answer: '귀', score: 10, options: ['눈', '코', '입', '귀'] },
    { type: 'multiple', question: '지구의 위성은 무엇일까요?', answer: '달', score: 10, options: ['태양', '달', '화성', '금성'] },
    { type: 'multiple', question: '식물이 햇빛을 이용해 양분을 만드는 과정은?', answer: '광합성', score: 10, options: ['호흡', '광합성', '증산작용', '발아'] },
    { type: 'multiple', question: '우리 몸에서 가장 큰 뼈는 어디에 있을까요?', answer: '다리', score: 10, options: ['머리', '팔', '다리', '가슴'] },
    { type: 'multiple', question: '공기 중에 가장 많은 기체는 무엇일까요?', answer: '질소', score: 10, options: ['산소', '질소', '이산화탄소', '수소'] },
    { type: 'multiple', question: '개구리는 폐 말고 이곳으로도 숨을 쉽니다. 어디일까요?', answer: '피부', score: 10, options: ['아가미', '피부', '입', '코'] },
    { type: 'multiple', question: '물감의 모든 색을 합치면 무슨 색이 될까요?', answer: '검은색', score: 10, options: ['흰색', '검은색', '보라색', '갈색'] },
    { type: 'multiple', question: '우주에서 지구로 떨어지는 돌을 무엇이라고 할까요?', answer: '운석', score: 10, options: ['혜성', '운석', '별똥별', '인공위성'] },
    { type: 'multiple', question: '태양계에서 가장 큰 행성은 무엇일까요?', answer: '목성', score: 10, options: ['수성', '금성', '목성', '토성'] },
    { type: 'multiple', question: '어떤 애벌레는 성체로 탈바꿈 하기 위해 자신의 몸을 단단한 고치로 감싸 이것으로 만듭니다. 이것은 무엇일까요?', answer: '번데기', score: 10, options: ['애벌레', '번데기', '성체', '알'] },
    { type: 'multiple', question: "온도를 나타내는 단위 '℃'는 무엇이라고 읽을까요?", answer: '섭씨', score: 10, options: ['화씨', '섭씨', '캘빈', '절대온도'] },
    { type: 'multiple', question: '뼈가 부러졌을 때 병원에서 찍는 사진은?', answer: '엑스레이', score: 10, options: ['CT', 'MRI', '엑스레이', '초음파'] },
    { type: 'multiple', question: '민들레 씨앗이 멀리 퍼지도록 도와주는 것은?', answer: '바람', score: 10, options: ['물', '바람', '동물', '사람'] },
    { type: 'ox', question: '물질이 불타고 있을 때 이산화탄소를 뿌리면 불이 더 커진다. ', answer: 'X', score: 10 },
    { type: 'ox', question: '하루살이는 목숨이 1일이다. ', answer: 'X', score: 10 },
    { type: 'subjective', question: '알을 낳는 동물은 난생, 새끼를 낳는 동물은?', answer: '태생', score: 10 },
    { type: 'subjective', question: '우리나라 최초의 우주발사체 이름은?', answer: '나로호', score: 10 },
    { type: 'subjective', question: '맛을 느끼는 혀의 돌기를 무엇이라고 할까요?', answer: '미뢰', score: 10 },
    { type: 'subjective', question: '물건을 확대해서 볼 수 있는 도구는?', answer: '돋보기', score: 10 },
    { type: 'ox', question: '거미는 곤충일까요 아닐까요?', answer: 'X', score: 10 },
    { type: 'subjective', question: '빛의 3원색은 빨강, 초록, 그리고 무슨 색일까요?', answer: '파랑', score: 10 },
    { type: 'subjective', question: '혈액이 우리 몸을 돌게 해주는 우리 몸 기관은 무엇일까요?', answer: '심장', score: 10 },
    { type: 'subjective', question: '사랑니를 제외한 영구치의 갯수는 총 몇 개인가요?', answer: '28', score: 10 },
    { type: 'subjective', question: '가장 가벼운 원소는 무엇일까요?', answer: '수소', score: 10 },
];

// 4. 역사 & 인물
const DATA_HISTORY = [
    { type: 'multiple', question: '우리나라가 일본으로부터 독립한 날은 광복절, 8월 OO일이다.', answer: '15', score: 10, options: ['1', '15', '29', '30'] },
    { type: 'multiple', question: '조선시대의 법궁으로 정도전이 설계한 궁궐의 이름은?', answer: '경복궁', score: 10, options: ['창덕궁', '경복궁', '창경궁', '덕수궁'] },
    { type: 'multiple', question: '훈민정음을 만든 조선시대의 왕은?', answer: '세종대왕', score: 10, options: ['태조', '세종대왕', '영조', '정조'] },
    { type: 'multiple', question: "어린이를 위해 '어린이날'을 만든 사람은?", answer: '방정환', score: 10, options: ['주시경', '방정환', '안창호', '김구'] },
    { type: 'multiple', question: '3.1 운동 때 독립선언서를 낭독한 곳은? OO공원', answer: '탑골', score: 10, options: ['탑골', '장충', '효창', '마로니에'] },
    { type: 'multiple', question: '고구려를 세운 왕의 이름은?', answer: '주몽', score: 10, options: ['온조', '혁거세', '주몽', '왕건'] },
    { type: 'multiple', question: '신라의 수도였던 지금의 도시는 어디일까요?', answer: '경주', score: 10, options: ['공주', '부여', '경주', '김해'] },
    { type: 'multiple', question: "백성을 사랑하는 마음으로 '목민심서'를 쓴 학자는?", answer: '정약용', score: 10, options: ['이황', '이이', '정약용', '박지원'] },
    { type: 'multiple', question: '이토 히로부미를 저격한 독립운동가는?', answer: '안중근', score: 10, options: ['윤봉길', '이봉창', '안중근', '김좌진'] },
    { type: 'multiple', question: '고려시대에 만들어진, 세계적으로 유명한 우리나의 도자기는?', answer: '고려청자', score: 10, options: ['백자', '고려청자', '분청사기', '옹기'] },
    { type: 'multiple', question: '임진왜란 때 거북선을 만들어 왜군을 물리친 장군은?', answer: '이순신', score: 10, options: ['권율', '김시민', '이순신', '곽재우'] },
    { type: 'multiple', question: "일제강점기에 활동했던, '별 헤는 밤'을 쓴 시인은?", answer: '윤동주', score: 10, options: ['김소월', '이육사', '윤동주', '한용운'] },
    { type: 'multiple', question: '조선시대 궁궐로 일제시대 동물원으로 개조되며 창경원으로 격하되었던 아픈 역사를 지닌 이곳은?', answer: '창경궁', score: 10, options: ['경복궁', '창덕궁', '창경궁', '덕수궁'] },
    { type: 'multiple', question: '우리나라의 초대 대통령은?', answer: '이승만', score: 10, options: ['김구', '박정희', '이승만', '김대중'] },
    { type: 'multiple', question: '조선시대에 시간을 알려주던 물시계의 이름은?', answer: '자격루', score: 10, options: ['앙부일구', '자격루', '측우기', '혼천의'] },
    { type: 'multiple', question: '신라시대의 유명한 여왕으로, 첨성대를 만든 왕은?', answer: '선덕여왕', score: 10, options: ['진덕여왕', '선덕여왕', '진성여왕', '명성황후'] },
    { type: 'multiple', question: '고려를 세운 왕의 이름은?', answer: '왕건', score: 10, options: ['궁예', '견훤', '왕건', '이성계'] },
    { type: 'multiple', question: '우리나라 돈 5만원권에 그려진 인물은?', answer: '신사임당', score: 10, options: ['세종대왕', '이황', '이이', '신사임당'] },
    { type: 'multiple', question: '허균이 지은 최초의 한글소설의 등장인물로 활빈당을 만들어 백성을 돕던 의적은?', answer: '홍길동', score: 10, options: ['임꺽정', '장길산', '홍길동', '일지매'] },
    { type: 'multiple', question: '백제시대의 마지막 수도였던 지금의 도시는 어디일까요?', answer: '부여', score: 10, options: ['공주', '익산', '부여', '서울'] },
    { type: 'multiple', question: "조선시대의 대표적인 화가로, '씨름'과 '서당'을 그린 사람은?", answer: '김홍도', score: 10, options: ['신윤복', '김홍도', '안견', '정선'] },
    { type: 'subjective', question: "세계 최초의 금속활자본인 '직지심체요절'이 만들어진 나라는?", answer: '고려', score: 10 },
    { type: 'subjective', question: '독립운동가들이 중국 상하이에서 세운 임시 정부의 이름은?', answer: '대한민국임시정부', score: 10 },
    { type: 'subjective', question: "고구려의 영토를 크게 넓힌 왕. 장수왕의 아버지. 'OOO'대왕", answer: '광개토', score: 10 },
    { type: 'subjective', question: '우리나라의 한글날은 10월 O일이다.', answer: '9', score: 10 },
    { type: 'subjective', question: '단군 신화에 나오는, 쑥과 마늘만 먹고 사람이 된 곰의 이름은?', answer: '웅녀', score: 10 },
    { type: 'subjective', question: "대한민국 임시정부의 주석이었으며, '백범일지'를 쓴 인물은?", answer: '김구', score: 10 },
    { type: 'subjective', question: '고려 말의 장군으로, 위화도 회군을 통해 조선 건국의 기초를 다진 인물은?', answer: '이성계', score: 10 },
    { type: 'subjective', question: "'독도는 우리 땅'이라는 노래 가사에 나오는, 신라 장군 이사부가 복속시킨 섬은?", answer: '우산국', score: 10 },
    { type: 'subjective', question: '퇴계 이황이 그려진 우리나라 지폐는 얼마일까요? (숫자)', answer: '1000', score: 10 },
];

// 5. 넌센스
const DATA_NONSENSE = [
    { type: 'subjective', question: '세상에서 가장 착한 사자는?', answer: '자원봉사자', score: 10 },
    { type: 'subjective', question: '왕이 넘어지면?', answer: '킹콩', score: 10 },
    { type: 'subjective', question: '세상에서 가장 뜨거운 과일은?', answer: '천도복숭아', score: 10 },
    { type: 'subjective', question: '딸기가 회사에서 잘리면?', answer: '딸기시럽', score: 10 },
    { type: 'subjective', question: '자동차를 톡 하고 치면?', answer: '카톡', score: 10 },
    { type: 'subjective', question: '아이스크림이 죽은 이유는?', answer: '차가와서', score: 10 },
    { type: 'subjective', question: '얼음이 죽으면?', answer: '다이빙', score: 10 },
    { type: 'subjective', question: '사람의 몸무게가 가장 많이 나갈 때는?', answer: '철들때', score: 10 },
    { type: 'subjective', question: '아몬드가 죽으면?', answer: '다이아몬드', score: 10 },
    { type: 'subjective', question: '대통령 선거의 반댓말은?', answer: '대통령 앉은거', score: 10 },
    { type: 'subjective', question: '오리가 얼면?', answer: '언덕', score: 10 },
    { type: 'subjective', question: '왕이 궁궐이 맘에 안들때 하는 말은?', answer: '궁시렁', score: 10 },
    { type: 'subjective', question: '할아버지가 가장 좋아하는 돈은?', answer: '할머니', score: 10 },
    { type: 'subjective', question: '붉은 길에 떨어진 동전을 4글자로 하면?', answer: '홍길동전', score: 10 },
    { type: 'subjective', question: '언제나 잘못을 비는 나무는?', answer: '사과나무', score: 10 },
    { type: 'subjective', question: '광부가 가장 많은 나라는?', answer: '케냐', score: 10 },
    { type: 'subjective', question: '김밥이 죽으면 어디로 갈까?', answer: '김밥천국', score: 10 },
    { type: 'subjective', question: '호랑이가 새 차를 뽑고 친구에게 하는 말은?', answer: '타이거', score: 10 },
    { type: 'subjective', question: '소가 불에 타면?', answer: '탄소', score: 10 },
    { type: 'subjective', question: '세상에서 가장 쉬운 숫자는?', answer: '십구만', score: 10 },
    { type: 'subjective', question: '하늘에 있는 개는?', answer: '무지개', score: 10 },
    { type: 'subjective', question: '물고기의 반대말은?', answer: '불고기', score: 10 },
    { type: 'subjective', question: '바나나가 웃으면?', answer: '바나나킥', score: 10 },
    { type: 'subjective', question: '태양을 전문적으로 리포트하는 사람은?', answer: '해리포터', score: 10 },
    { type: 'subjective', question: '전주비빔밥보다 신선한 비빔밥은?', answer: '이번주비빔밥', score: 10 },
    { type: 'subjective', question: '깨뜨리면 칭찬 받는 것은?', answer: '신기록', score: 10 },
    { type: 'subjective', question: '차를 발로 차면?', answer: '카놀라유', score: 10 },
    { type: 'subjective', question: '세상에서 가장 가난한 왕은?', answer: '최저임금', score: 10 },
    { type: 'subjective', question: '신사가 자기소개할 때 하는 말은?', answer: '신사임당', score: 10 },
    { type: 'subjective', question: '곰국을 뒤집어 엎어버리면 무엇이 될까요?', answer: '논문', score: 10 },
];

// 6. 속담
const DATA_PROVERB = [
    { type: 'multiple', question: '발 없는 O이 천 리 간다.', answer: '말', score: 10, options: ['말', '소', '개', '닭'] },
    { type: 'multiple', question: 'O구멍에도 볕들 날 있다.', answer: '쥐', score: 10, options: ['소', '쥐', '개', '닭'] },
    { type: 'multiple', question: '가는 말이 OOO 오는 말이 곱다.', answer: '고와야', score: 10, options: ['고와야', '나빠야', '빨라야', '느려야'] },
    { type: 'multiple', question: 'OO 보고 놀란 가슴 솥뚜껑 보고 놀란다.', answer: '자라', score: 10, options: ['거북', '자라', '뱀', '토끼'] },
    { type: 'multiple', question: 'OO도 약에 쓰려면 없다.', answer: '개똥', score: 10, options: ['소똥', '말똥', '개똥', '닭똥'] },
    { type: 'multiple', question: 'OOO도 제 말 하면 온다.', answer: '호랑이', score: 10, options: ['사자', '호랑이', '곰', '늑대'] },
    { type: 'multiple', question: '백지장도 맞들면 OO.', answer: '낫다', score: 10, options: ['무겁다', '가볍다', '낫다', '아프다'] },
    { type: 'multiple', question: 'O 심은데 O 나고 팥 심은데 팥난다.', answer: '콩', score: 10, options: ['쌀', '보리', '콩', '수수'] },
    { type: 'multiple', question: '원숭이도 OO에서 떨어진다.', answer: '나무', score: 10, options: ['절벽', '나무', '그네', '줄'] },
    { type: 'multiple', question: '소 OO 외양간 고친다.', answer: '잃고', score: 10, options: ['팔고', '사고', '잃고', '죽고'] },
    { type: 'multiple', question: '천 리 길도 한 OO부터.', answer: '걸음', score: 10, options: ['걸음', '달리기', '생각', '마음'] },
    { type: 'multiple', question: 'OO 밑이 어둡다.', answer: '등잔', score: 10, options: ['책상', '침대', '등잔', '가로등'] },
    { type: 'multiple', question: '세 살 OO 여든까지 간다.', answer: '버릇', score: 10, options: ['습관', '버릇', '성격', '기억'] },
    { type: 'multiple', question: '작은 고추가 OO.', answer: '맵다', score: 10, options: ['달다', '짜다', '맵다', '쓰다'] },
    { type: 'multiple', question: '말 한마디로 O냥 빚을 갚는다.', answer: '천', score: 10, options: ['백', '천', '만', '억'] },
    { type: 'multiple', question: 'OO 놈 위에 나는 놈 있다.', answer: '뛰는', score: 10, options: ['걷는', '기는', '뛰는', '자는'] },
    { type: 'multiple', question: '믿는 OO에 발등 찍힌다.', answer: '도끼', score: 10, options: ['친구', '도끼', '망치', '칼'] },
    { type: 'multiple', question: '공든 O이 무너지랴.', answer: '탑', score: 10, options: ['집', '성', '탑', '다리'] },
    { type: 'multiple', question: '될성부른 나무는 OO부터 알아본다.', answer: '떡잎', score: 10, options: ['뿌리', '줄기', '가지', '떡잎'] },
    { type: 'multiple', question: '하늘의 O 따기.', answer: '별', score: 10, options: ['달', '해', '별', '구름'] },
    { type: 'multiple', question: 'OOO도 구르는 재주가 있다.', answer: '굼벵이', score: 10, options: ['지렁이', '달팽이', '굼벵이', '송충이'] },
    { type: 'subjective', question: 'OO가 길면 잡힌다.', answer: '꼬리', score: 10 },
    { type: 'subjective', question: '우물에 가 OO 찾는다.', answer: '숭늉', score: 10 },
    { type: 'subjective', question: '개천에서 O 난다.', answer: '용', score: 10 },
    { type: 'subjective', question: '웃는 OO에 침 못 뱉는다.', answer: '얼굴', score: 10 },
    { type: 'subjective', question: 'O 주고 약 준다.', answer: '병', score: 10 },
    { type: 'subjective', question: '고생 끝에 O이 온다.', answer: '낙', score: 10 },
    { type: 'subjective', question: '죽은 토끼의 반댓말은?', answer: '산토끼', score: 10 },
    { type: 'subjective', question: 'OO가 제 방앗간을 그냥 지나랴.', answer: '참새', score: 10 },
    { type: 'subjective', question: '사공이 많으면 O가 산으로 간다.', answer: '배', score: 10 },
];

// 7. K-POP
const DATA_KPOP = [
    { type: 'multiple', question: "플레디스 소속 6인조 보이그룹으로, '첫 만남은 계획대로 되지 않아'로 데뷔한 팀의 이름은?", answer: '투어스', score: 10, options: ['라이즈', '보이넥스트도어', '투어스', '제로베이스원'] },
    { type: 'multiple', question: '세븐틴은 총 몇 명의 멤버로 구성되어 있나요?', answer: '13', score: 10, options: ['11', '12', '13', '14'] },
    { type: 'multiple', question: "아이브(IVE)의 리더이며 '맑은 눈의 광인'이라는 별명을 가진 멤버는?", answer: '안유진', score: 10, options: ['장원영', '안유진', '가을', '레이'] },
    { type: 'multiple', question: "2006년 'La La La'로 데뷔한 YG엔터테인먼트의 전설적인 보이그룹은?", answer: '빅뱅', score: 10, options: ['샤이니', '2PM', '빅뱅', '동방신기'] },
    { type: 'multiple', question: '스트레이키즈(Stray Kids)는 현재 총 몇 명의 멤버로 구성되어 있나요?', answer: '8', score: 10, options: ['7', '8', '9', '10'] },
    { type: 'multiple', question: "세븐틴의 퍼포먼스팀 리더이며 '호랑이의 시선', '10시 10분' 등의 키워드를 가진 멤버는?", answer: '호시', score: 10, options: ['우지', '호시', '디노', '디에잇'] },
    { type: 'multiple', question: "빅히트 뮤직 소속 5인조 보이그룹으로, '어느날 머리에서 뿔이 자랐다'로 데뷔한 팀의 이름은?", answer: '투모로우바이투게더', score: 10, options: ['엔하이픈', '투모로우바이투게더', '트레저', '더보이즈'] },
    { type: 'multiple', question: '스타쉽엔터테인먼트 소속 6인조 걸그룹 아이브(IVE)의 데뷔년도는?', answer: '2021', score: 10, options: ['2020', '2021', '2022', '2023'] },
    { type: 'multiple', question: "'에라 모르겠다'와 'LAST DANCE'가 수록된 빅뱅의 세번째 정규 앨범 이름은?", answer: 'MADE', score: 10, options: ['ALIVE', 'MADE', 'REMEMBER', 'STILL LIFE'] },
    { type: 'multiple', question: 'KOZ엔터테인먼트 소속 6인조 보이그룹으로, 2023년 데뷔한 팀의 이름은?', answer: '보이넥스트도어', score: 10, options: ['앤팀', '보이넥스트도어', '라이즈', '이븐'] },
    { type: 'multiple', question: "'개방성'과 '확장성'을 주요 특징으로 하며, 여러 유닛(127, DREAM, WayV 등)으로 활동하는 SM엔터테인먼트의 보이그룹은?", answer: 'NCT', score: 10, options: ['EXO', 'NCT', 'SHINee', 'Super Junior'] },
    { type: 'multiple', question: '투모로우바이투게더는 총 몇 명의 멤버로 구성되어 있나요?', answer: '5', score: 10, options: ['4', '5', '6', '7'] },
    { type: 'multiple', question: "아이브(IVE)의 정규 1집 'I've IVE'의 더블 타이틀곡은 'I AM'과 무엇일까요?", answer: '키치', score: 10, options: ['러브다이브', '애프터라이크', '키치', '배디'] },
    { type: 'multiple', question: "2018년 'District 9'으로 데뷔한 JYP엔터테인먼트 소속 보이그룹은?", answer: '스트레이키즈', score: 10, options: ['갓세븐', '스트레이키즈', '데이식스', '엑스디너리히어로즈'] },
    { type: 'multiple', question: "NCT의 여러 유닛에 소속되어 '프로데뷔러'라는 별명을 가진 캐나다 국적의 멤버는?", answer: '마크', score: 10, options: ['쟈니', '마크', '유타', '텐'] },
    { type: 'multiple', question: '세븐틴은 보컬팀, 힙합팀, 그리고 무슨 팀까지 총 3개의 유닛으로 나뉘어 있나요?', answer: '퍼포먼스팀', score: 10, options: ['댄스팀', '퍼포먼스팀', '비주얼팀', '예능팀'] },
    { type: 'multiple', question: "빅뱅의 리더이자 '삐딱하게', '무제' 등 수많은 히트곡을 만든 멤버는?", answer: '지드래곤', score: 10, options: ['태양', '대성', '탑', '지드래곤'] },
    { type: 'multiple', question: "스트레이키즈의 미니 앨범 '樂-STAR'의 타이틀 곡은?", answer: '락', score: 10, options: ['특', '소리꾼', '락', '신메뉴'] },
    { type: 'multiple', question: '투어스(TWS)가 2024년 1월 22일 데뷔하며 발표한 미니 1집 앨범의 이름은?', answer: '스파클링블루', score: 10, options: ['스파클링블루', '샤이닝블루', '트윙클블루', '오션블루'] },
    { type: 'multiple', question: '아이브의 데뷔곡이자 그룹의 정체성을 알린 곡의 제목은?', answer: 'ELEVEN', score: 10, options: ['ELEVEN', 'TWELVE', 'THIRTEEN', 'LOVE DIVE'] },
    { type: 'multiple', question: '멤버 수에 제한이 없는 NCT 시스템의 마지막 유닛으로, 일본을 기반으로 활동하는 팀의 이름은? (띄워쓰기X, 대문자)', answer: 'NCTWISH', score: 10, options: ['NCTJAPAN', 'NCTTOKYO', 'NCTWISH', 'NCTNEW'] },
    { type: 'subjective', question: "세븐틴이 데뷔 앨범 '17 CARAT'에서 선보인 타이틀곡의 제목은?", answer: '아낀다', score: 10 },
    { type: 'subjective', question: '스트레이키즈 내 프로듀싱팀으로, 방찬, 창빈, 한으로 구성된 팀의 이름은?', answer: '쓰리라차', score: 10 },
    { type: 'subjective', question: "빅뱅의 멤버 중 '눈, 코, 입'이라는 솔로곡으로 큰 사랑을 받은 멤버는?", answer: '태양', score: 10 },
    { type: 'ox', question: "투어스는 'TWENTY FOUR SEVEN WITH US'의 약자이다. ", answer: 'O', score: 10 },
    { type: 'ox', question: "보이넥스트도어는 '옆집 소년들'이라는 뜻으로, 프로듀서 지코가 제작한 그룹이다.", answer: 'O', score: 10 },
    { type: 'ox', question: "투모로우바이투게더의 팬덤 이름은 '영원'이다. ", answer: 'X', score: 10 },
    { type: 'ox', question: '아이브의 멤버 장원영과 안유진은 아이즈원 출신이다. ', answer: 'O', score: 10 },
    { type: 'ox', question: 'NCT DREAM은 멤버들이 성인이 되면 졸업하는 로테이션 시스템을 초기에 도입했었다. ', answer: 'O', score: 10 },
    { type: 'ox', question: "빅뱅의 '거짓말'은 원래 다른 가수를 위해 만들어졌던 곡이다. ", answer: 'O', score: 10 },
];

// 8. 우리말 바로 알기
const DATA_KOREAN = [
    { type: 'multiple', question: "'이야기를 듣고 금세 얼굴이 환해졌다.'의 '금세' vs '금새', 올바른 표현은?", answer: '금세', score: 10, options: ['금세', '금새'] },
    { type: 'multiple', question: "'오늘은 왠지 좋은 일이 생길 것 같아.'의 '왠지' vs '웬지', 올바른 표현은?", answer: '왠지', score: 10, options: ['왠지', '웬지'] },
    { type: 'multiple', question: "오늘 며칠이야? 라고 물을 때, '며칠' vs '몇일', 올바른 표현은?", answer: '며칠', score: 10, options: ['며칠', '몇일'] },
    { type: 'multiple', question: "'그렇게 하면 안 돼' 라고 말할 때, '안 돼' vs '안 되', 올바른 표현은?", answer: '안 돼', score: 10, options: ['안 돼', '안 되'] },
    { type: 'multiple', question: "'조금 후에 만나자'는 의미의 '이따가 봐' vs '있다가 봐', 올바른 표현은?", answer: '이따가 봐', score: 10, options: ['이따가 봐', '있다가 봐'] },
    { type: 'multiple', question: "정답이 아닐 때는 '다르다' vs '틀리다', 어떤 표현이 더 정확할까요?", answer: '틀리다', score: 10, options: ['다르다', '틀리다'] },
    { type: 'multiple', question: "'가든지 오든지 마음대로 해' 라고 선택을 나타낼 때, '던지' vs '든지', 올바른 표현은?", answer: '든지', score: 10, options: ['던지', '든지'] },
    { type: 'multiple', question: "'나 이제 어떡해?' 라고 말할 때, '어떡해' vs '어떻게', 올바른 표현은?", answer: '어떡해', score: 10, options: ['어떡해', '어떻게'] },
    { type: 'multiple', question: "오랜만에 만난 친구에게, '오랜만에' vs '오랫만에', 올바른 표현은?", answer: '오랜만에', score: 10, options: ['오랜만에', '오랫만에'] },
    { type: 'multiple', question: "밥을 먹고 그릇을 닦는 '설거지' vs '설겆이', 올바른 표현은?", answer: '설거지', score: 10, options: ['설거지', '설겆이'] },
    { type: 'multiple', question: "'굳이 그렇게까지 할 필요는 없어.' 에서 '굳이' vs '구지', 올바른 표현은?", answer: '굳이', score: 10, options: ['굳이', '구지'] },
    { type: 'multiple', question: "선생님 내일 '봬요' vs '뵈요', 올바른 표현은?", answer: '봬요', score: 10, options: ['봬요', '뵈요'] },
    { type: 'multiple', question: "'이것은 사과예요' 처럼 받침 없는 명사 뒤, '예요' vs '에요', 올바른 표현은?", answer: '예요', score: 10, options: ['예요', '에요'] },
    { type: 'multiple', question: "매콤하고 맛있는 김치 '찌개' vs '찌게', 올바른 표현은?", answer: '찌개', score: 10, options: ['찌개', '찌게'] },
    { type: 'multiple', question: "'웬만하면 용서해 주자.' 에서 '웬만하면' vs '왠만하면', 올바른 표현은?", answer: '웬만하면', score: 10, options: ['웬만하면', '왠만하면'] },
    { type: 'multiple', question: "자신이 맡은 임무나 직책을 뜻하는 '역할' vs '역활', 올바른 표현은?", answer: '역할', score: 10, options: ['역할', '역활'] },
    { type: 'multiple', question: "가게에서 돈을 내는 것은 '결재' vs '결제', 올바른 표현은?", answer: '결제', score: 10, options: ['결재', '결제'] },
    { type: 'multiple', question: "'반드시 숙제를 해야 한다.' 에서 '반드시' vs '반듯이', 올바른 표현은?", answer: '반드시', score: 10, options: ['반드시', '반듯이'] },
    { type: 'multiple', question: "학생들에게 지식을 알려주는 것은 '가르치다' vs '가리키다', 올바른 표현은?", answer: '가르치다', score: 10, options: ['가르치다', '가리키다'] },
    { type: 'multiple', question: "감기나 병이 다 나았을 때, '낫다' vs '낳다', 올바른 표현은?", answer: '낫다', score: 10, options: ['낫다', '낳다'] },
    { type: 'multiple', question: "기억이나 사실을 까먹었을 때 '잊어버리다' vs '잃어버리다', 올바른 표현은?", answer: '잊어버리다', score: 10, options: ['잊어버리다', '잃어버리다'] },
    { type: 'subjective', question: "도구나 수단을 나타낼 때 '함으로써' vs '함으로서' 어떤 것이 맞을까요?", answer: '함으로써', score: 10 },
    { type: 'subjective', question: "퀴즈의 정답을 알아냈을 때 '맞히다' vs '맞추다', 올바른 표현은?", answer: '맞히다', score: 10 },
    { type: 'subjective', question: "기가 막힐 때 쓰는 말 '어이없다' vs '어의없다', 올바른 표현은?", answer: '어이없다', score: 10 },
    { type: 'subjective', question: "얼굴이 창백하고 야윌 때 '핼쑥하다' vs '헬쑥하다', 올바른 표현은?", answer: '핼쑥하다', score: 10 },
    { type: 'subjective', question: "감춰져 있던 사실이 밖으로 알려질 때 '드러나다' vs '들어나다', 올바른 표현은?", answer: '드러나다', score: 10 },
    { type: 'subjective', question: "가만히 생각하는 모양을 나타낼 때 '곰곰이' vs '곰곰히', 올바른 표현은?", answer: '곰곰이', score: 10 },
    { type: 'subjective', question: "가업을 물려받는 것을 '대물림' vs '되물림' 올바른 표현은?", answer: '대물림', score: 10 },
    { type: 'subjective', question: "어깨에 가방을 걸치는 것은 '메다' vs '매다', 올바른 표현은?", answer: '메다', score: 10 },
    { type: 'subjective', question: "자동차에 사람이 부딪혔을 때, '부딪히다' vs '부딪치다', 올바른 표현은?", answer: '부딪히다', score: 10 },
];

// 9. 스포츠
const DATA_SPORTS = [
    { type: 'multiple', question: 'KBO 프로야구에서 한 팀은 총 몇 명의 선수가 경기에 뛰나요?', answer: '9', score: 10, options: ['9', '10', '11', '12'] },
    { type: 'multiple', question: '타자가 친 공이 경기장 밖으로 넘어가면 홈런입니다. 이때 주자가 두 명 나가있는 상태라면 몇 점을 얻게 될까요?', answer: '3', score: 10, options: ['1', '2', '3', '4'] },
    { type: 'multiple', question: '삼성 라이온즈의 홈구장이 있는 도시는 어디일까요?', answer: '대구', score: 10, options: ['부산', '대구', '광주', '대전'] },
    { type: 'multiple', question: "LG 트윈스의 마스코트는 '럭키'와 '스타'라는 이름의 OOO입니다. OOO에 들어갈 말은?", answer: '쌍둥이', score: 10, options: ['형제', '남매', '쌍둥이', '친구'] },
    { type: 'multiple', question: "안양FC의 응원구호인 '수카바티'는 불교용어로 무슨뜻일까요?", answer: '극락', score: 10, options: ['극락', '윤회', '성불', '보살'] },
    { type: 'multiple', question: '투수가 던진 공을 타자가 세 번의 스트라이크 안에 치지 못하면 OO 아웃입니다.', answer: '삼진', score: 10, options: ['일진', '이진', '삼진', '사진'] },
    { type: 'multiple', question: '대한민국 축구 국가대표팀의 주장이자 토트넘 홋스퍼 FC에서 뛰고 있는 선수의 이름은?', answer: '손흥민', score: 10, options: ['박지성', '이강인', '손흥민', '김민재'] },
    { type: 'multiple', question: "'바람의 아들'이라는 별명을 가졌던 KBO의 전설적인 도루왕 선수는?", answer: '이종범', score: 10, options: ['이승엽', '이종범', '양준혁', '선동열'] },
    { type: 'multiple', question: 'FC 안양을 상징하는 색깔은 무슨 색일까요?', answer: '보라', score: 10, options: ['빨강', '파랑', '보라', '초록'] },
    { type: 'multiple', question: "MLB에서 투수와 타자를 모두 완벽하게 소화해 '투타겸업'으로 유명한 일본인 선수는?", answer: '오타니', score: 10, options: ['다르빗슈', '오타니', '이치로', '마쓰이'] },
    { type: 'multiple', question: '농구 경기에서 한 팀은 총 몇 명의 선수가 코트 위에서 뛰나요?', answer: '5', score: 10, options: ['5', '6', '7', '11'] },
    { type: 'multiple', question: "두산 베어스의 마스코트는 '철웅이'라는 O입니다. O에 들어갈 동물은?", answer: '곰', score: 10, options: ['호랑이', '사자', '곰', '독수리'] },
    { type: 'multiple', question: 'FC 안양의 마스코트인 다람쥐 캐릭터의 이름은?', answer: '바티', score: 10, options: ['바티', '안양이', '포도', '수카'] },
    { type: 'multiple', question: "e스포츠 게임 '리그 오브 레전드'에서 주요 공격로(라인)는 탑, 미드, 바텀 그리고 OO이 있습니다.", answer: '정글', score: 10, options: ['서폿', '정글', '로밍', '갱킹'] },
    { type: 'multiple', question: 'KBO 프로야구단 KIA 타이거즈의 마스코트는 어떤 동물일까요?', answer: '호랑이', score: 10, options: ['사자', '곰', '호랑이', '용'] },
    { type: 'multiple', question: '전 세계인의 스포츠 축제인 올림픽은 몇 년에 한 번씩 열릴까요?', answer: '4', score: 10, options: ['2', '3', '4', '5'] },
    { type: 'multiple', question: "KBO 리그의 '국민타자'로 불렸으며, 통산 최다 홈런 기록을 가진 선수는?", answer: '이승엽', score: 10, options: ['이대호', '박병호', '이승엽', '최형우'] },
    { type: 'ox', question: 'FC 안양은 K리그1에 속해있다. (2026년 기준) ', answer: 'O', score: 10 },
    { type: 'multiple', question: 'SSG 랜더스의 홈구장은 어느 지역에 있을까요?', answer: '인천', score: 10, options: ['서울', '부산', '인천', '광주'] },
    { type: 'ox', question: '축구 경기에서 페널티 에어리어 안에 있는 골키퍼는 손을 사용할 수 있다. ', answer: 'O', score: 10 },
    { type: 'multiple', question: '미국 농구리그 NBA의 전설적인 농구선수로 조던이라는 브랜드의 모티브이기도 한 이 사람은?', answer: '마이클 조던', score: 10, options: ['매직 존슨', '코비 브라이언트', '마이클 조던', '르브론 제임스'] },
    { type: 'multiple', question: "메이저리그에서 '코리안 몬스터'라는 별명으로 활약했으며, 현재 KBO 한화 이글스 소속인 투수는?", answer: '류현진', score: 10, options: ['박찬호', '김병현', '류현진', '오승환'] },
    { type: 'multiple', question: 'FC 안양의 전신이었던 팀의 영향으로 불리는 별명은? (힌트: 빠른 동물)', answer: '치타', score: 10, options: ['호랑이', '사자', '치타', '표범'] },
    { type: 'multiple', question: "롯데 자이언츠의 홈 구장은 부산에 있는 'OO 야구장'이다.", answer: '사직', score: 10, options: ['잠실', '고척', '사직', '문학'] },
    { type: 'multiple', question: '한화 이글스의 마스코트는 어떤 새일까요?', answer: '독수리', score: 10, options: ['매', '독수리', '갈매기', '학'] },
    { type: 'multiple', question: '축구 경기 시간은 전반전과 후반전 각각 몇 분씩일까요?', answer: '45', score: 10, options: ['40', '45', '50', '30'] },
    { type: 'multiple', question: '키움 히어로즈의 홈구장은 서울의 구로에 있는 OO 스카이돔이다', answer: '고척', score: 10, options: ['잠실', '상암', '고척', '목동'] },
    { type: 'multiple', question: "야구에서 1루, 2루, 3루에 주자가 모두 있는 '만루' 상황에서 타자가 홈런을 치는 것을 무엇이라고 할까요?", answer: '만루홈런', score: 10, options: ['장외홈런', '솔로홈런', '만루홈런', '인사이드파크홈런'] },
    { type: 'subjective', question: '전 세계에서 가장 인기 있는 축구 대회로, 4년마다 열리는 국가대항전의 이름은?', answer: '월드컵', score: 10 },
    { type: 'ox', question: '축구 경기중 페널티에어리어 안이라도 우리편이 패스한 공은 골키퍼가 손으로 잡을 수 없다.', answer: 'O', score: 10 },
    { type: 'subjective', question: '한국 프로야구 KBO 리그가 공식 출범한 해는 언제일까요? (숫자)', answer: '1982', score: 10 },
    { type: 'subjective', question: '타석에 들어서는 선수마다 팬들이 함께 부르는 개인별 노래를 무엇이라고 할까요?', answer: '선수응원가', score: 10 },
    { type: 'subjective', question: "'국민타자' 이승엽이 2003년, 아시아 한 시즌 최다 홈런 신기록을 세웠을 때 기록한 홈런 개수는 몇 개일까요? (숫자)", answer: '56', score: 10 },
    { type: 'subjective', question: "'괴물 수비수'라 불리우며 독일의 명문 축구 구단인 FC바이에른뮌헨에서 뛰고 있는 한국인 선수의 이름은 무엇일까요?", answer: '김민재', score: 10 },
    { type: 'subjective', question: '프랑스의 명문 축구 구단 파리생제르망FC에서 뛰고 있는 한국인 선수는 누구일까요?', answer: '이강인', score: 10 },
    { type: 'subjective', question: "'두 개의 심장'이라는 별명이 있고 맨체스터 유나이티드에서 활약했던 축구선수는 누구일까요?", answer: '박지성', score: 10 },
    { type: 'subjective', question: "'페이커' 이상혁 선수가 2025년까지 달성한 월드 챔피언십(롤드컵) 최다 우승 횟수는? (숫자)", answer: '6', score: 10 },
    { type: 'subjective', question: "'페이커' 이상혁 선수가 활약하고 있는 한국의 '리그 오브 레전드' 프로 리그의 공식 약칭은 무엇일까요?", answer: 'LCK', score: 10 },
    { type: 'subjective', question: "'피겨 퀸'으로 불리는 우리나라의 전설적인 피겨스케이팅 선수는 누구일까요?", answer: '김연아', score: 10 },
    { type: 'subjective', question: '야구에서 선수들이 모두 뛰어나와 대치하는 상황을 무엇이라 할까요?', answer: '벤치클리어링', score: 10 }
];


function QuizManager({ userRole }) {
    const { classId } = useClassStore();
    const currentUser = auth.currentUser;

    const [mode, setMode] = useState('list');
    const [quizSets, setQuizSets] = useState([]);

    // [수정] 단일 ID -> ID 배열로 변경
    const [activeSetIds, setActiveSetIds] = useState([]);

    // [신규] 선택된 체크박스 관리
    const [checkedIds, setCheckedIds] = useState(new Set());

    // 검색 필터 상태
    const [filterGrade, setFilterGrade] = useState('all');
    const [filterSubject, setFilterSubject] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    // 생성/수정용 상태
    const [newSetInfo, setNewSetInfo] = useState({ title: '', grade: 'common', semester: 'common', subject: 'general', isPublic: true });
    const [questions, setQuestions] = useState([]);
    const [qType, setQType] = useState('multiple');
    const [qText, setQText] = useState('');
    const [qOptions, setQOptions] = useState(['', '', '', '']);
    const [qAnswer, setQAnswer] = useState('');
    const [qScore, setQScore] = useState(10);

    useEffect(() => {
        fetchQuizSets();
        fetchCurrentClassQuizzes();
    }, [currentUser, classId]);

    const fetchQuizSets = async () => {
        if (!currentUser) return;
        const data = await getQuizSets(currentUser.uid, userRole === 'admin');
        setQuizSets(data);
    };

    // [수정] 현재 출제된 목록 가져오기
    const fetchCurrentClassQuizzes = async () => {
        if (!classId) return;
        const activeSets = await getActiveQuizSets(classId);
        setActiveSetIds(activeSets.map(s => s.id));
    };

    const handleAddQuestion = () => {
        if (!qText) return alert("문제를 입력하세요.");
        if (!qAnswer) return alert("정답을 입력하세요.");
        if (qType === 'multiple' && qOptions.some(opt => !opt.trim())) return alert("객관식 보기를 모두 입력해주세요.");

        const newQuestion = {
            id: Date.now(),
            type: qType,
            question: qText,
            answer: qAnswer,
            score: Number(qScore),
            options: qType === 'multiple' ? qOptions : null
        };
        setQuestions([...questions, newQuestion]);
        setQText(''); setQAnswer(''); setQOptions(['', '', '', '']); setQScore(10);
    };

    const handleRemoveQuestion = (id) => setQuestions(questions.filter(q => q.id !== id));

    const handleSaveQuizSet = async () => {
        if (!newSetInfo.title) return alert("제목을 입력하세요.");
        if (questions.length === 0) return alert("문제를 추가해주세요.");
        if (!window.confirm(`총 ${questions.length}문제로 저장하시겠습니까?`)) return;

        try {
            await createQuizSet({
                ...newSetInfo,
                questions: questions,
                creatorId: currentUser.uid,
                creatorName: currentUser.displayName || '선생님'
            });
            alert("저장 완료!");
            setMode('list');
            fetchQuizSets();
            setNewSetInfo({ title: '', grade: 'common', semester: 'common', subject: 'general', isPublic: true });
            setQuestions([]);
        } catch (e) { alert(e.message); }
    };

    // --- [수정] 기존 데이터 주제별 이관 ---
    const handleMigrateLegacy = async () => {
        if (!window.confirm("하드코딩된 퀴즈들을 주제별 문제집으로 분리하여 DB에 저장하시겠습니까?")) return;

        try {
            const createLegacySet = async (data, title, subject, grade = 'common') => {
                if (data.length === 0) return;
                await createQuizSet({
                    title, grade, semester: 'common', subject, isPublic: true,
                    creatorId: "system", creatorName: "운영자",
                    questions: data.map((q, idx) => ({ ...q, id: Date.now() + idx + Math.random() }))
                });
            };

            // 주제별 생성 호출
            await createLegacySet(DATA_MATH, "🧮 [6-2] 수학 퀴즈 모음", "math", "6");
            await createLegacySet(DATA_COMMON, "📢 [상식] 알쓸신잡 기본상식", "general");
            await createLegacySet(DATA_SCIENCE, "🔬 [과학] 알쏭달쏭 과학상식", "science");
            await createLegacySet(DATA_HISTORY, "📜 [역사] 한국사 인물 퀴즈", "history");
            await createLegacySet(DATA_NONSENSE, "🤣 [재미] 넌센스 퀴즈", "general");
            await createLegacySet(DATA_PROVERB, "💬 [속담] 속담 빈칸 채우기", "korean");
            await createLegacySet(DATA_KPOP, "🎵 [K-POP] 아이돌 퀴즈", "other");
            await createLegacySet(DATA_KOREAN, "🇰🇷 [우리말] 맞춤법 퀴즈", "korean");
            await createLegacySet(DATA_SPORTS, "⚽ [스포츠] 열혈 스포츠 퀴즈", "other");

            alert("모든 주제별 퀴즈집 생성이 완료되었습니다!");
            fetchQuizSets();

        } catch (e) { alert("이관 실패: " + e.message); }
    };

    // [신규] 체크박스 토글
    const handleCheck = (id) => {
        setCheckedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    // [신규] 전체 선택/해제 (검색 결과 내에서)
    const handleSelectAll = () => {
        if (checkedIds.size === filteredQuizSets.length) {
            setCheckedIds(new Set());
        } else {
            setCheckedIds(new Set(filteredQuizSets.map(s => s.id)));
        }
    };

    // [핵심] 일괄 출제 처리 (기존 출제 목록에 추가할지, 덮어쓸지 결정)
    const handleBatchPublish = async (isAddMode) => {
        if (!classId) return alert("학급을 먼저 선택해주세요.");
        if (checkedIds.size === 0) return alert("선택된 문제집이 없습니다.");

        const selectedList = Array.from(checkedIds);
        let newActiveIds = [];

        if (isAddMode) {
            // 추가 모드: 기존 목록 + 선택 목록 (중복 제거)
            newActiveIds = Array.from(new Set([...activeSetIds, ...selectedList]));
        } else {
            // 덮어쓰기 모드: 선택 목록만 출제
            newActiveIds = selectedList;
        }

        if (!window.confirm(`선택한 ${selectedList.length}개의 문제집을 ${isAddMode ? '추가' : '설정'}하시겠습니까?`)) return;

        try {
            await setClassActiveQuizSets(classId, newActiveIds);
            setActiveSetIds(newActiveIds);
            setCheckedIds(new Set()); // 선택 초기화
            alert("출제 설정이 완료되었습니다!");
        } catch (e) { alert(e.message); }
    };

    // [신규] 일괄 삭제 처리
    const handleBatchDelete = async () => {
        if (checkedIds.size === 0) return alert("삭제할 문제집을 선택해주세요.");

        // 삭제 권한 확인: 내 퀴즈(creatorId 일치)이거나 관리자(system 퀴즈 포함)
        const targets = quizSets.filter(s => checkedIds.has(s.id));
        const deletableTargets = targets.filter(s =>
            s.creatorId === currentUser?.uid || (userRole === 'admin' && s.creatorId === 'system')
        );
        const undeletableCount = targets.length - deletableTargets.length;

        if (deletableTargets.length === 0) return alert("삭제 권한이 있는 문제집이 없습니다.");

        let confirmMsg = `선택한 ${deletableTargets.length}개의 문제집을 영구 삭제하시겠습니까?`;
        if (undeletableCount > 0) confirmMsg += `\n(권한이 없는 ${undeletableCount}개는 제외됩니다.)`;

        if (!window.confirm(confirmMsg)) return;

        try {
            await Promise.all(deletableTargets.map(s => deleteQuizSet(s.id)));
            alert(`${deletableTargets.length}개의 문제집이 삭제되었습니다.`);
            fetchQuizSets();
            fetchCurrentClassQuizzes(); // 혹시 출제중인게 삭제되었을 수 있으니 갱신
            setCheckedIds(new Set());
        } catch (e) {
            alert("삭제 중 오류 발생: " + e.message);
        }
    };

    // [핵심] 개별 출제/취소 토글 (즉시 반영)
    const handleToggleSingle = async (id, title) => {
        if (!classId) return;
        const isActive = activeSetIds.includes(id);
        let newIds = [];

        if (isActive) {
            if (!confirm(`'${title}' 출제를 취소하시겠습니까?`)) return;
            newIds = activeSetIds.filter(sid => sid !== id);
        } else {
            if (!confirm(`'${title}'을(를) 출제 목록에 추가하시겠습니까?`)) return;
            newIds = [...activeSetIds, id];
        }

        try {
            await setClassActiveQuizSets(classId, newIds);
            setActiveSetIds(newIds);
        } catch (e) { alert(e.message); }
    };

    // [신규] 필터링 로직
    const filteredQuizSets = useMemo(() => {
        return quizSets.filter(set => {
            const matchGrade = filterGrade === 'all' || set.grade.toString() === filterGrade;
            const matchSubject = filterSubject === 'all' || set.subject === filterSubject;
            const matchSearch = set.title.toLowerCase().includes(searchTerm.toLowerCase()) || set.creatorName.includes(searchTerm);
            return matchGrade && matchSubject && matchSearch;
        });
    }, [quizSets, filterGrade, filterSubject, searchTerm]);


    if (mode === 'create') {
        return (
            <Wrapper>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <h2>📝 새 문제집 만들기</h2>
                    <Button color="#6c757d" onClick={() => setMode('list')}>목록으로</Button>
                </div>
                <Section>
                    <h3>1. 문제집 정보</h3>
                    <TitleInput placeholder="제목 (예: 5학년 1학기 사회 2단원)" value={newSetInfo.title} onChange={e => setNewSetInfo({ ...newSetInfo, title: e.target.value })} />
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <InputGroup style={{ flex: 1 }}>
                            <label>학년</label>
                            <select value={newSetInfo.grade} onChange={e => setNewSetInfo({ ...newSetInfo, grade: e.target.value })}>
                                <option value="common">공통</option>
                                {[1, 2, 3, 4, 5, 6].map(g => <option key={g} value={g}>{g}학년</option>)}
                            </select>
                        </InputGroup>
                        <InputGroup style={{ flex: 1 }}>
                            <label>과목</label>
                            <select value={newSetInfo.subject} onChange={e => setNewSetInfo({ ...newSetInfo, subject: e.target.value })}>
                                <option value="general">상식/넌센스</option>
                                <option value="korean">국어</option>
                                <option value="math">수학</option>
                                <option value="social">사회</option>
                                <option value="science">과학</option>
                                <option value="english">영어</option>
                                <option value="history">역사</option>
                                <option value="other">기타</option>
                            </select>
                        </InputGroup>
                        <InputGroup style={{ flex: 1 }}>
                            <label>공개 설정</label>
                            <select value={newSetInfo.isPublic} onChange={e => setNewSetInfo({ ...newSetInfo, isPublic: e.target.value === 'true' })}>
                                <option value="true">공개</option>
                                <option value="false">비공개</option>
                            </select>
                        </InputGroup>
                    </div>
                </Section>
                <Section>
                    <h3>2. 문제 추가</h3>
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                        <Button color={qType === 'multiple' ? '#007bff' : '#e9ecef'} style={{ color: qType === 'multiple' ? 'white' : 'black' }} onClick={() => { setQType('multiple'); setQAnswer(''); }}>객관식</Button>
                        <Button color={qType === 'ox' ? '#007bff' : '#e9ecef'} style={{ color: qType === 'ox' ? 'white' : 'black' }} onClick={() => { setQType('ox'); setQAnswer('O'); }}>O / X</Button>
                        <Button color={qType === 'subjective' ? '#007bff' : '#e9ecef'} style={{ color: qType === 'subjective' ? 'white' : 'black' }} onClick={() => { setQType('subjective'); setQAnswer(''); }}>주관식</Button>
                    </div>
                    <InputGroup><input type="text" placeholder="질문 입력" value={qText} onChange={e => setQText(e.target.value)} /></InputGroup>
                    {qType === 'multiple' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
                            {qOptions.map((opt, idx) => (
                                <input key={idx} type="text" placeholder={`보기 ${idx + 1}`} value={opt} onChange={e => {
                                    const newOpts = [...qOptions]; newOpts[idx] = e.target.value; setQOptions(newOpts);
                                }} />
                            ))}
                        </div>
                    )}
                    <InputGroup>
                        <label>정답</label>
                        {qType === 'ox' ? (
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <label><input type="radio" checked={qAnswer === 'O'} onChange={() => setQAnswer('O')} /> O</label>
                                <label><input type="radio" checked={qAnswer === 'X'} onChange={() => setQAnswer('X')} /> X</label>
                            </div>
                        ) : (
                            qType === 'multiple' ? (
                                <select value={qAnswer} onChange={e => setQAnswer(e.target.value)}>
                                    <option value="">-- 정답 선택 --</option>
                                    {qOptions.map((opt, idx) => <option key={idx} value={opt}>{opt || `보기 ${idx + 1}`}</option>)}
                                </select>
                            ) : (
                                <input type="text" placeholder="정답 텍스트" value={qAnswer} onChange={e => setQAnswer(e.target.value)} />
                            )
                        )}
                    </InputGroup>
                    <Button onClick={handleAddQuestion} style={{ width: '100%' }}>+ 문제 추가</Button>
                </Section>
                <Section>
                    <h3>3. 목록 ({questions.length}개)</h3>
                    <QuizList>
                        {questions.map((q, idx) => (
                            <QuizCard key={q.id} type={q.type}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <strong>Q{idx + 1}. {q.question}</strong>
                                    <button onClick={() => handleRemoveQuestion(q.id)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>삭제</button>
                                </div>
                                <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>정답: {q.answer}</div>
                            </QuizCard>
                        ))}
                    </QuizList>
                    {questions.length > 0 && <Button onClick={handleSaveQuizSet} color="#28a745" style={{ width: '100%', marginTop: '1rem', padding: '1rem' }}>저장하기</Button>}
                </Section>
            </Wrapper>
        );
    }

    return (
        <Wrapper>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h2 style={{ margin: 0 }}>📚 퀴즈 문제은행</h2>
                    <p style={{ color: '#666', margin: '0.5rem 0' }}>공용 퀴즈를 검색하거나 나만의 문제집을 만들어보세요.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {userRole === 'admin' && (
                        <Button color="#17a2b8" onClick={handleMigrateLegacy}>기존 퀴즈 이관 (Admin)</Button>
                    )}
                    <Button onClick={() => setMode('create')}>+ 새 문제집</Button>
                </div>
            </div>

            {/* --- 검색 및 필터 UI --- */}
            <SearchBar>
                <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} style={{ width: '100px' }}>
                    <option value="all">전학년</option>
                    <option value="common">공통</option>
                    {[1, 2, 3, 4, 5, 6].map(g => <option key={g} value={g}>{g}학년</option>)}
                </select>
                <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} style={{ width: '120px' }}>
                    <option value="all">전과목</option>
                    <option value="general">상식/넌센스</option>
                    <option value="korean">국어</option>
                    <option value="math">수학</option>
                    <option value="social">사회</option>
                    <option value="science">과학</option>
                    <option value="english">영어</option>
                    <option value="history">역사</option>
                    <option value="other">기타</option>
                </select>
                <input
                    type="text"
                    placeholder="제목, 출제자 이름 검색..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </SearchBar>

            {/* [추가] 일괄 작업 툴바 */}
            <div style={{ background: '#f1f3f5', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                        type="checkbox"
                        checked={filteredQuizSets.length > 0 && checkedIds.size === filteredQuizSets.length}
                        onChange={handleSelectAll}
                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                    />
                    <span style={{ fontWeight: 'bold' }}>전체 선택 ({checkedIds.size}개)</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button color="#fd7e14" onClick={() => handleBatchPublish(true)}>+ 문제집 추가</Button>
                    <Button color="#20c997" onClick={() => handleBatchPublish(false)}>🔄 문제집 교체</Button>
                    {/* [신규] 일괄 삭제 버튼 */}
                    <Button color="#fa5252" onClick={handleBatchDelete}>🗑️ 선택 삭제</Button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                {filteredQuizSets.length > 0 ? filteredQuizSets.map(set => {
                    const isActive = activeSetIds.includes(set.id);
                    const isChecked = checkedIds.has(set.id);
                    // [핵심] 삭제 권한: 내가 만들었거나(creatorId 일치) OR 관리자이면서 시스템 퀴즈인 경우
                    const canDelete = set.creatorId === currentUser?.uid || (userRole === 'admin' && set.creatorId === 'system');

                    return (
                        <div key={set.id} style={{
                            border: isActive ? '2px solid #20c997' : '1px solid #ddd',
                            borderRadius: '12px', padding: '1.2rem',
                            background: isActive ? '#e6fcf5' : 'white',
                            position: 'relative',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
                        }}>
                            {/* 체크박스 (우측 상단) */}
                            <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
                                <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleCheck(set.id)}
                                    style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                                />
                            </div>

                            <div style={{ marginBottom: '0.5rem', paddingRight: '2rem' }}>
                                {isActive && <Tag style={{ background: '#20c997', color: 'white', fontWeight: 'bold' }}>출제중</Tag>}
                                <Tag>{set.grade === 'common' ? '전학년' : `${set.grade}학년`}</Tag>
                                <Tag>{set.subject === 'math' ? '수학' : (set.subject === 'general' ? '상식' : set.subject)}</Tag>
                                {set.isPublic ? <Tag style={{ background: '#dbe4ff', color: '#4263eb' }}>공용</Tag> : <Tag style={{ background: '#f1f3f5' }}>개인</Tag>}
                            </div>
                            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>{set.title}</h3>
                            <p style={{ color: '#868e96', fontSize: '0.9rem', margin: 0 }}>
                                문항: {set.questions?.length}개 | 출제: {set.creatorName}
                            </p>

                            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem' }}>
                                <Button
                                    color={isActive ? '#ff6b6b' : '#20c997'}
                                    style={{ flex: 1, fontSize: '0.9rem' }}
                                    onClick={() => handleToggleSingle(set.id, set.title)}
                                >
                                    {isActive ? '출제 취소' : '추가하기'}
                                </Button>

                                {/* [수정] 권한이 있을 때만 삭제 버튼 표시 */}
                                {canDelete && (
                                    <Button color="#fa5252" onClick={async () => {
                                        if (confirm("정말 삭제하시겠습니까?")) {
                                            await deleteQuizSet(set.id);
                                            fetchQuizSets();
                                            if (isActive) fetchCurrentClassQuiz();
                                        }
                                    }}>삭제</Button>
                                )}
                            </div>
                        </div>
                    )
                }) : (
                    <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#888', padding: '2rem' }}>
                        검색 결과가 없습니다.
                    </p>
                )}
            </div>
        </Wrapper>
    );
}

export default QuizManager;