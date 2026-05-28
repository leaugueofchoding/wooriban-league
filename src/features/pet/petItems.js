// src/features/pet/petItems.js

import brainSnackImg from '@/assets/items/item_brain_snack.png';
import secretNotebookImg from '@/assets/items/item_secret_notebook.png';
import evolutionStoneImg from '@/assets/items/item_evolution_stone.png';
import petEggImg from '@/assets/items/item_pet_egg.png';
import vitaminJellyImg from '@/assets/items/item_vitamin_jelly.png';

export const PET_ITEMS = {
    brain_snack: {
        id: 'brain_snack',
        name: '두뇌 간식',
        description: '펫의 HP와 SP를 조금 회복시켜주는 맛있는 간식입니다.',
        price: 100,
        image: brainSnackImg,
        icon: brainSnackImg,
    },
    vitamin_jelly: {
        id: 'vitamin_jelly',
        name: '비타민 젤리',
        description: '입맛이 싹 돕니다. 펫이 피로도를 회복하고 다시 배틀할 수 있게 됩니다. (하루 1번만 사용 가능)',
        price: 500,
        image: vitaminJellyImg,
        icon: vitaminJellyImg,
    },
    secret_notebook: {
        id: 'secret_notebook',
        name: '비법 노트',
        description: '사용하면 펫이 새로운 스킬 하나를 랜덤하게 배웁니다.',
        price: 2000,
        image: secretNotebookImg,
        icon: secretNotebookImg,
    },
    evolution_stone: {
        id: 'evolution_stone',
        name: '진화의 돌',
        description: '일정 레벨에 도달한 펫을 다음 단계로 진화시키는 신비한 돌입니다.',
        price: 10000,
        image: evolutionStoneImg,
        icon: evolutionStoneImg,
    },
    pet_egg: {
        id: 'pet_egg',
        name: '펫 알',
        description: '어떤 펫이 부화할지 모르는 신비한 알입니다. 새로운 파트너를 만나보세요!',
        price: 10000,
        image: petEggImg,
        icon: petEggImg,
    },
};