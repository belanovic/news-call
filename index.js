const express = require('express');
const socketIO = require('socket.io');
const app = express();
const http = require('http');
const server = http.createServer(app);
const config = require('config');

const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"], 
    allowedHeaders: ["my-custom-header"], 
    credentials: true
  }
});

const removeFromArray = function(arr, elem) {
  const indexElem = arr.indexOf(elem);
  const removed = arr.splice(indexElem, 1);
  return removed
}
let roomsActive = [];

io.on('connection', async (socket) => {

  socket.on("disconnecting", (reason) => {
    if(socket.name) {io.emit('oneDisconnected', socket.name)}
  });

  socket.on("disconnect", (reason) => {
    roomsActive.forEach((prom) => {                         //// soket je naa diskonekt izbačen iz sobe, a ako je bio poslednji u njoj, 
      const roomFound = io.sockets.adapter.rooms.get(prom); // soba se automatski briše iz rooms Map-a. U lupu proveravam 
      if(!roomFound) {                                      // da li se neka soba iz Array roomsActive ne nalazi u rooms Map-u. 
        removeFromArray(roomsActive, prom);                 // Ako je nema, brisem je iz roomsActive, i saljem svim soketima
        io.emit('reloadUsers', roomsActive);                 // da bi azurirali listu soba, odnosto konektovanih korisnika
      }
    })
  });

  
    socket.on('create', (room) => {
     const someSocketInRoom = io.sockets.adapter.rooms.get(room);

     if(!someSocketInRoom) {
      socket.join(room);
      socket.name = room;
      socket.emit('created');
     }  else {
          if(socket.name === room) {
            socket.emit('roomAlreadyCreatedByThisSocket', room);
          } else {
            socket.emit('roomAlreadyCreatedByAnotherSocket', room);
          }
        }
      
      const roomsActiveHasRoom = roomsActive.some((prom) => prom === room);

      if(!roomsActiveHasRoom) {

          roomsActive.push(room);

          io.emit('reloadUsers', roomsActive);
      }
      io.emit('reloadUsers', roomsActive);

    })

    socket.on('join', (room) => {

      const roomToJoin = io.sockets.adapter.rooms.get(room);
      
        if(!roomToJoin) return;
        
        if(roomToJoin.size === 2) {
          socket.emit('roomIsBusy', room);
        }
        if(roomToJoin.size === 1) {
          const socketInRoomToJoinID = roomToJoin.values().next().value;
          const numOfRoomsSocketIsIn = io.sockets.sockets.get(socketInRoomToJoinID).rooms.size;
          if(numOfRoomsSocketIsIn === 2) {
            socket.join(room);
            socket.emit('joined', room);
          } else if (numOfRoomsSocketIsIn === 3) {
            socket.emit('roomIsBusy', room);
          }
          
        }  
    })   

    socket.on('calling', (room, caller, constraints) => {
      io.in(room).emit('calling', room, caller, constraints);
    })  

    socket.on('accept', (room) => { 
      socket.emit('accept', room)
    })
    socket.on('reject', (room) => {
      socket.broadcast.to(room).emit('rejectToCaller', room);
      socket.emit('rejectToCallee', room);
    })

    socket.on('ready', (room) => {
      socket.broadcast.to(room).emit('ready')
    })
    socket.on('candidate', (event) => {
      socket.broadcast.to(event.room).emit('candidate', event)
    })
    socket.on('offer', (event) => {
      socket.broadcast.to(event.room).emit('offer', event.sdp)
    })
    socket.on('answer', (event) => {
      socket.broadcast.to(event.room).emit('answer', event.sdp)
    })
    socket.on('endTalk', (room) => {
      io.in(room).emit('endTalk', room);
    })
    socket.on('abort', (room) => {
      io.in(room).emit('abort', room);
    })
    
    socket.on('leaveRoom', (room) => {
      socket.leave(room);
    })
    socket.on('logout', (user) => {

      io.in(user).socketsLeave(user);

      removeFromArray(roomsActive, user);
      io.emit('reloadUsers', roomsActive);
    })
  /*   socket.on('login', (user) => {
      roomsActive.push(user); 
      io.emit('reloadUsers', roomsActive);
      console.log('roomsActive posle login ' + roomsActive)
    }) */
})
 
const hostIP = config.get('hostIP');
const port = process.env.PORT || 4002; 

server.listen(port, hostIP, () => console.log(`Listening on port ${port}`));

