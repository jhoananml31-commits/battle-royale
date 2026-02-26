const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);


app.use(express.static(__dirname));


const MAP_SIZE = 3000;
let players = {};
let bullets = [];
let zoneRadius = MAP_SIZE/2;


function createBot(){
    const id = "bot_" + Math.random();
    players[id] = {
        name:"BOT",
        x: Math.random()*MAP_SIZE,
        y: Math.random()*MAP_SIZE,
        hp: 100,
        color: "orange",
        kills:0,
        coins:0,
        level:1,
        bot:true
    };
}


for(let i=0;i<6;i++) createBot();


io.on("connection", socket => {


    socket.on("join",(data)=>{


        players[socket.id] = {
            name:data.name,
            x: Math.random()*MAP_SIZE,
            y: Math.random()*MAP_SIZE,
            hp:100,
            color:data.color,
            kills:0,
            coins:0,
            level:1
        };


        socket.emit("init",{id:socket.id,players,MAP_SIZE});
    });


    socket.on("move", data=>{
        if(players[socket.id]){
            players[socket.id].x=data.x;
            players[socket.id].y=data.y;
        }
    });


    socket.on("shoot", data=>{
        bullets.push({...data,owner:socket.id});
    });


    socket.on("disconnect",()=>{
        delete players[socket.id];
    });
});


setInterval(()=>{


    // bots
    for(let id in players){
        if(players[id].bot){
            players[id].x+=Math.random()*8-4;
            players[id].y+=Math.random()*8-4;


            if(Math.random()<0.02){
                bullets.push({
                    x:players[id].x,
                    y:players[id].y,
                    dx:(Math.random()-0.5)*15,
                    dy:(Math.random()-0.5)*15,
                    owner:id
                });
            }
        }
    }


    bullets.forEach(b=>{
        b.x+=b.dx;
        b.y+=b.dy;


        for(let id in players){
            if(id!==b.owner){
                let p=players[id];
                let dx=b.x-p.x;
                let dy=b.y-p.y;
                if(Math.sqrt(dx*dx+dy*dy)<15){
                    p.hp-=20;


                    if(p.hp<=0){
                        if(players[b.owner]){
                            players[b.owner].kills++;
                            players[b.owner].coins+=10;
                            players[b.owner].level=1+Math.floor(players[b.owner].kills/3);
                        }
                        delete players[id];
                        if(id.startsWith("bot_")) createBot();
                    }
                }
            }
        }
    });


    bullets=bullets.filter(b=>b.x>0&&b.y>0&&b.x<MAP_SIZE&&b.y<MAP_SIZE);


    zoneRadius-=0.3;


    for(let id in players){
        let p=players[id];
        let dx=p.x-MAP_SIZE/2;
        let dy=p.y-MAP_SIZE/2;
        if(Math.sqrt(dx*dx+dy*dy)>zoneRadius){
            p.hp-=0.5;
        }
    }


    if(Object.keys(players).length<=1){
        zoneRadius=MAP_SIZE/2;
        players={};
        for(let i=0;i<6;i++) createBot();
    }


    io.emit("update",{players,bullets,zoneRadius});


},1000/30);


http.listen(3000,()=>console.log("🔥 mata bolas http://localhost:3000"));