// src/components/Player.tsx
import React from 'react';

// Определяем тип для данных игрока
export interface PlayerData {
  id: string;
  x: number;
  y: number;
  color: string;
}

// Определяем тип для пропсов компонента Player
interface PlayerProps {
  player: PlayerData; // Компонент принимает объект PlayerData как пропс
}

const Player: React.FC<PlayerProps> = ({ player }) => {
  const pixelSize = 20; // Размер пикселя в px

  return (
    <div
      style={{
        position: 'absolute',
        left: `${player.x}px`,
        top: `${player.y}px`,
        width: `${pixelSize}px`,
        height: `${pixelSize}px`,
        backgroundColor: player.color,
        borderRadius: '50%', // Делаем пиксель круглым
        border: '1px solid #333',
        boxSizing: 'border-box',
        zIndex: 1, // Чтобы пиксели были поверх игрового поля
        transition: 'left 0.1s linear, top 0.1s linear', // Добавляем плавность движению
      }}
      title={`Player ID: ${player.id}`} // Подсказка при наведении мышью
    ></div>
  );
};

export default Player; // Экспорт компонента по умолчанию