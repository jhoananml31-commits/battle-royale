const express = require("express");
const http = require("http");
const { Server } = require("socket.io");


const app = express();
const server = http.createServer(app);
const io = new Server(server);


app.use(express.static(__dirname));


let rooms = {};


io.on("connection", (socket) => {


    socket.on("getRooms", () => {
        socket.emit("roomsList", Object.keys(rooms));
    });


    socket.on("createRoom", (roomName) => {


        if (!rooms[roomName]) {
            rooms[roomName] = {
                players: {},
                bullets: [],
                wins: {}
            };
        }


        socket.join(roomName);
        socket.room = roomName;


        rooms[roomName].players[socket.id] = {
            x: Math.random() * 2000,
            y: Math.random() * 2000,
            color: "white",
            kills: 0,
            coins: 0
        };


        socket.emit("init", {
            id: socket.id,
            room: roomName
        });


    });


    socket.on("joinRoom", (roomName) => {


        if (!rooms[roomName]) return;


        socket.join(roomName);
        socket.room = roomName;


        rooms[roomName].players[socket.id] = {
            x: Math.random() * 2000,
            y: Math.random() * 2000,
            color: "white",
            kills: 0,
            coins: 0
        };


        socket.emit("init", {
            id: socket.id,
            room: roomName
        });


    });


    socket.on("move", (data) => {
        if (!socket.room) return;
        let player = rooms[socket.room].players[socket.id];
        if (player) {
            player.x = data.x;
            player.y = data.y;
        }
    });


    socket.on("shoot", (data) => {
        if (!socket.room) return;
        rooms[socket.room].bullets.push({
            x: data.x,
            y: data.y,
            dx: data.dx,
            dy: data.dy,
            owner: socket.id
        });
    });


    socket.on("disconnect", () => {
        if (socket.room && rooms[socket.room]) {
            delete rooms[socket.room].players[socket.id];
        }
    });


});


setInterval(() => {


    for (let roomName in rooms) {


        let room = rooms[roomName];


        room.bullets.forEach(b => {
            b.x += b.dx;
            b.y += b.dy;
        });


        io.to(roomName).emit("update", {
            players: room.players,
            bullets: room.bullets
        });
    }


}, 1000 / 60);


server.listen(3000, () => console.log("Servidor listo"));