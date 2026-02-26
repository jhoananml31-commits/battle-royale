const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);


app.use(express.static(__dirname));


const MAP_SIZE = 3000;


let rooms = {}; // 🔥 ahora usamos salas


/* ================= CREAR SALA ================= */
function createRoom(roomName) {
    rooms[roomName] = {
        players: {},
        bullets: [],
        zoneRadius: MAP_SIZE / 2,
        wins: {},
        gameActive: true
    };


    // bots iniciales
    for (let i = 0; i < 4; i++) {
        createBot(roomName);
    }
}


function createBot(roomName) {
    const id = "bot_" + Math.random();
    rooms[roomName].players[id] = {
        name: "BOT",
        x: Math.random() * MAP_SIZE,
        y: Math.random() * MAP_SIZE,
        hp: 100,
        color: "orange",
        kills: 0,
        coins: 0,
        level: 1,
        bot: true
    };
}


/* ================= CONEXIÓN ================= */
io.on("connection", socket => {


    socket.on("joinRoom", data => {


        const roomName = data.room || "global";


        if (!rooms[roomName]) createRoom(roomName);


        socket.join(roomName);


        const room = rooms[roomName];


        room.players[socket.id] = {
            name: data.name || "Player",
            x: Math.random() * MAP_SIZE,
            y: Math.random() * MAP_SIZE,
            hp: 100,
            color: data.color || "lime",
            kills: 0,
            coins: data.savedCoins || 0,
            level: 1,
            bot: false
        };


        if (!room.wins[socket.id]) room.wins[socket.id] = 0;


        socket.emit("init", {
            id: socket.id,
            players: room.players,
            MAP_SIZE,
            wins: room.wins
        });
    });


    socket.on("move", data => {
        const room = getRoom(socket);
        if (!room || !room.players[socket.id]) return;


        room.players[socket.id].x = Math.max(0, Math.min(MAP_SIZE, data.x));
        room.players[socket.id].y = Math.max(0, Math.min(MAP_SIZE, data.y));
    });


    socket.on("shoot", data => {
        const room = getRoom(socket);
        if (!room) return;


        room.bullets.push({
            x: data.x,
            y: data.y,
            dx: data.dx,
            dy: data.dy,
            owner: socket.id
        });
    });


    socket.on("buyUpgrade", () => {
        const room = getRoom(socket);
        if (!room) return;


        let player = room.players[socket.id];
        if (player.coins >= 50) {
            player.coins -= 50;
            player.level += 1;
        }
    });


    socket.on("disconnect", () => {
        const room = getRoom(socket);
        if (room) delete room.players[socket.id];
    });
});


/* ================= OBTENER SALA ================= */
function getRoom(socket) {
    const joined = [...socket.rooms][1];
    return rooms[joined];
}


/* ================= GAME LOOP ================= */
setInterval(() => {


    for (let roomName in rooms) {


        const room = rooms[roomName];


        /* ---- BOT IA ---- */
        for (let id in room.players) {


            let bot = room.players[id];
            if (!bot.bot) continue;


            let closest = null;
            let minDist = Infinity;


            for (let pid in room.players) {
                if (pid === id) continue;


                let dx = room.players[pid].x - bot.x;
                let dy = room.players[pid].y - bot.y;
                let dist = Math.sqrt(dx * dx + dy * dy);


                if (dist < minDist) {
                    minDist = dist;
                    closest = room.players[pid];
                }
            }


            if (closest) {
                let dx = closest.x - bot.x;
                let dy = closest.y - bot.y;
                let dist = Math.sqrt(dx * dx + dy * dy);


                if (dist > 0) {
                    bot.x += (dx / dist) * 2;
                    bot.y += (dy / dist) * 2;


                    if (Math.random() < 0.02) {
                        room.bullets.push({
                            x: bot.x,
                            y: bot.y,
                            dx: (dx / dist) * 12,
                            dy: (dy / dist) * 12,
                            owner: id
                        });
                    }
                }
            }
        }


        /* ---- BALAS ---- */
        let newBullets = [];


        room.bullets.forEach(b => {


            b.x += b.dx;
            b.y += b.dy;


            let hit = false;


            for (let id in room.players) {
                if (id === b.owner) continue;


                let p = room.players[id];
                let dx = b.x - p.x;
                let dy = b.y - p.y;


                if (Math.sqrt(dx * dx + dy * dy) < 15) {
                    p.hp -= 20;
                    hit = true;


                    if (p.hp <= 0) {


                        if (room.players[b.owner]) {
                            room.players[b.owner].kills++;
                            room.players[b.owner].coins += 10;
                        }


                        delete room.players[id];


                        if (id.startsWith("bot_"))
                            createBot(roomName);
                    }
                }
            }


            if (!hit) newBullets.push(b);
        });


        room.bullets = newBullets;


        /* ---- VICTORIA ---- */
        const alive = Object.keys(room.players);


        if (alive.length === 1) {


            const winnerId = alive[0];


            if (!room.players[winnerId].bot) {
                room.wins[winnerId]++;
            }


            // reiniciar partida
            room.players = {};
            room.bullets = [];
            room.zoneRadius = MAP_SIZE / 2;


            for (let i = 0; i < 4; i++) createBot(roomName);
        }


        io.to(roomName).emit("update", {
            players: room.players,
            bullets: room.bullets,
            wins: room.wins
        });
    }


}, 1000 / 30);


/* ================= PUERTO ================= */
const PORT = process.env.PORT || 3000;
http.listen(PORT, () =>
    console.log("🔥 Servidor PRO con salas en puerto " + PORT)
);