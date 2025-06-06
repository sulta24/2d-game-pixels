// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css'; // Убедитесь, что глобальные стили импортированы

// Получаем корневой элемент DOM, куда будет монтироваться React-приложение
// ! означает, что мы уверены, что элемент с таким ID существует
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App /> {/* Рендерим главный компонент App */}
  </React.StrictMode>,
);