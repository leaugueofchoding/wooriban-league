import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

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
  }
  th {
    background-color: #f8f9fa;
  }
`;

const TeamNameCell = styled.td`
  text-align: left;
  font-weight: 500;
`;

function LeagueTable({ standings }) {
    return (
        <TableWrapper>
            <h2>리그 순위</h2>
            <Table>
                <thead>
                    <tr>
                        <th>순위</th>
                        <th style={{ textAlign: 'left' }}>팀</th>
                        <th>경기수</th>
                        <th>승</th>
                        <th>무</th>
                        <th>패</th>
                        <th>득실</th>
                        <th>승점</th>
                    </tr>
                </thead>
                <tbody>
                    {standings.length > 0 ? (
                        standings.map((team, index) => (
                            <motion.tr
                                key={team.id}
                                layout // 이 속성이 순서 변경 시 자동으로 부드럽게 움직이게 합니다.
                                initial={{ opacity: 0, y: 20 }} // 처음 나타날 때 아래에서 위로 살짝 올라오며 나타나는 효과
                                animate={{ opacity: 1, y: 0 }} // 나타난 후 원래 위치
                                transition={{ duration: 0.4 }} // 애니메이션 속도
                            >
                                <td>{index + 1}</td>
                                <TeamNameCell>{team.teamName}</TeamNameCell>
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
                    )}
                </tbody>
            </Table>
        </TableWrapper>
    );
}

export default LeagueTable;