const path = require("path");
const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const Filter = require("bad-words");
const {
  generateMessage,
  generateLocationMessage,
} = require("./utils/messages");
const {
  addUser,
  removeUser,
  getUser,
  getUsersInRoom,
} = require("./utils/users");

const app = express();
// Create raw HTTP server to pass to io
const server = http.createServer(app);
// Socket io expects to be called with raw HTTP server
const io = socketio(server);

const port = process.env.PORT || 3000;
const publicDirectoryPath = path.join(__dirname, "../public");

app.use(express.static(publicDirectoryPath));

// Socket io event listener, waiting for connection
// socket argument is an object that contains info about each specific connection
io.on("connection", (socket) => {
  console.log("New WebSocket connection");

  socket.on("join", ({ username, room }, callback) => {
    const { error, user } = addUser({ id: socket.id, username, room });

    if (error) {
      return callback(error);
    }

    // socket.join is a method only used in server, allows us to join a given chat room
    // we pass it the name of the room we want to join
    // use user.room instead of room, because we trim it with the addUser function
    socket.join(user.room);

    socket.emit("message", generateMessage("Admin", "Welcome!"));
    // broadcast.emit works like any emit, but does not send it to the socket making the connection
    // io.to.emit emits an event to everybody in a SPECIFIC ROOM
    // socket.broadcast.to.emit is the same as broadcast but for specific rooms
    socket.broadcast.to(user.room).emit("message", generateMessage('Admin', `${user.username} has joined!`));
    io.to(user.room).emit('roomData', {
      room: user.room,
      users: getUsersInRoom(user.room),
    });

    callback();
  });

    // callback argument is the callback function passed from client, we use it to acknowledge the event
    socket.on("sendMessage", (message, callback) => {
      const user = getUser(socket.id);
      const filter = new Filter();
  
      if (filter.isProfane(message)) {
        return callback("Profanity is not allowed!");
      }
  
      io.to(user.room).emit("message", generateMessage(user.username, message));
      // callback acknowledgement can be sent back to client with any argument
      callback();
  });

  socket.on("sendLocation", (coords, callback) => {
    const user = getUser(socket.id);
    io.to(user.room).emit(
      "locationMessage",
      generateLocationMessage(user.username, `https://google.com/maps?q=${coords.latitude},${coords.longitude}`)
    );
    callback();
  });

  // disconnect event listener is built in to socket.io, runs code when a user disconnects
  socket.on("disconnect", () => {
    const user = removeUser(socket.id);

    if (user) {
      io.to(user.room).emit("message", generateMessage('Admin', `${user.username} has left!`));
      io.to(user.room).emit('roomData', {
        room: user.room,
        users: getUsersInRoom(user.room),
      });
    }
  });
});

server.listen(port, () => {
  console.log(`Server is up on port ${port}!`);
});
