// src/components/LeagueTable.jsx

import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { emblemMap } from '../utils/emblemMap';
import defaultEmblem from '../assets/default-emblem.png';

const TableWrapper = styled.div`
  margin: 2rem 0;
  padding: 1rem;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  overflow-x: auto;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  text-align: center;
  th, td {
    padding: 0.75rem;
    border-bottom: 1px solid #eee;
    vertical-align: middle; /* 아이콘과 텍스트 높이 맞춤 */
  }
  th {
    background-color: #f8f9fa;
  }
`;

const TeamNameCell = styled.td`
  text-align: left;
  font-weight: 500;
  display: flex; /* 엠블럼과 팀 이름을 가로로 정렬 */
  align-items: center;
`;

const Emblem = styled.img`
  width: 30px;
  height: 30px;
  margin-right: 10px;
  border-radius: 50%;
  object-fit: cover;
`;

function LeagueTable({ standings }) {
    return (
        <TableWrapper>
            <Table>
                <thead>
                    <tr>
                        <th>순위</th>
                        <th style={{ textAlign: 'left' }}>팀</th> {/* 팀 헤더는 그대로 유지 */}
                        <th>경기수</th>
                        <th>승</th>
                        <th>무</th>
                        <th>패</th>
                        <th>득실</th>
                        <th>승점</th>
                    </tr>
                </thead>
                <tbody>{standings.length > 0 ? (
                    standings.map((team, index) => (
                        <motion.tr
                            key={team.id}
                            layout
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4 }}
                        >
                            <td>{index + 1}</td>
                            <TeamNameCell>
                                <Emblem src={emblemMap[team.emblemId] || team.emblemUrl || defaultEmblem} alt={`${team.teamName} 엠블럼`} />
                                <span>{team.teamName}</span>
                            </TeamNameCell>
                            <td>{team.played}</td>
                            <td>{team.wins}</td>
                            <td>{team.draws}</td>
                            <td>{team.losses}</td>
                            <td>{team.goalDifference}</td>
                            <td><strong>{team.points}</strong></td>
                        </motion.tr>
                    ))
                ) : (
                    <tr>
                        <td colSpan="8">진행된 경기가 없습니다.</td>
                    </tr>
                )}</tbody>
            </Table>
        </TableWrapper>
    );
}

export default LeagueTable;