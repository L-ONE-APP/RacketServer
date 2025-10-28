// server.js
const express = require('express');
const app = express();
const http = require('http').createServer(app);
// Используем Socket.IO для связи
const io = require('socket.io')(http, {
    cors: {
        // Разрешаем подключения из Unity (любые)
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Очередь для поиска игроков 1v1
let waitingPlayer = null; 

function generateRoomId() {
    // Простая генерация ID комнаты
    return Math.random().toString(36).substring(2, 9);
}

io.on('connection', (socket) => {
    console.log(`Игрок подключился: ${socket.id}`);

    // --- A. МАТЧМЕЙКИНГ: ИГРАТЬ ---
    socket.on('join_matchmaking', () => {
        
        if (waitingPlayer && waitingPlayer.id !== socket.id) {
            // 2. Нашелся второй игрок! Создаем матч.
            const roomID = generateRoomId();
            
            // Объединяем их в комнату
            socket.join(roomID);
            waitingPlayer.join(roomID);

            console.log(`Матч найден! Комната: ${roomID}`);

            // Сообщаем первому, что он ХОСТ
            waitingPlayer.emit('match_found', { role: 'host', room: roomID });
            // Сообщаем второму, что он ГОСТЬ
            socket.emit('match_found', { role: 'guest', room: roomID });

            waitingPlayer = null; // Очищаем ожидающего игрока
        } else {
            // 1. Игрок отправляется в очередь
            waitingPlayer = socket;
            socket.emit('waiting_for_opponent');
            console.log(`Игрок ${socket.id} ожидает матч.`);
        }
    });

    // --- B. СИГНАЛИЗАЦИЯ: Обмен данными WebRTC ---
    socket.on('signal', (data) => {
        // data содержит { room, type, payload } (offer, answer или ice-candidate)
        
        // Пересылаем эти данные всем, КРОМЕ отправителя, в этой комнате.
        socket.to(data.room).emit('signal', data);
    });
    
    // Обработка отключения
    socket.on('disconnect', () => {
        console.log(`Игрок отключился: ${socket.id}`);
        
        if (waitingPlayer && waitingPlayer.id === socket.id) {
            waitingPlayer = null;
            console.log('Очередь очищена.');
        }
        // В боевой игре здесь нужно уведомить напарника о разрыве
    });
});

http.listen(PORT, () => {
    console.log(`Сервер запущен на порту: ${PORT}`);
});