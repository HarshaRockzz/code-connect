const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const app = express();
const server = require('http').Server(app);
const { PeerServer } = require('peer');
const mongoose = require('mongoose');
const Doc = require('./models/Doc');

const PORT = process.env.PORT || 3002;
const FRONTEND_ORIGIN = 'http://localhost:3000';
 // Replace with your frontend origin

// Replace the connection string with your provided MONGO_URI
const MONGO_URI = 'mongodb+srv://mamidipaka2003:Harsha%401234@cluster0.zgjni4y.mongodb.net/?retryWrites=true&w=majority';

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', (req, res) => {
    res.send("CodeColab Backend!");
});

mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
    useCreateIndex: true
})
    .then(() => console.log('Connected to MongoDB'))
    .catch((error) => {
        console.error('Error connecting to MongoDB:', error);
        // You might want to handle the error or exit the process here
    });

const io = require('socket.io')(server, {
    cors: {
        origin: FRONTEND_ORIGIN,
    }
});

const peerServer = PeerServer({ port: 9002, path: '/' }, (exp) => {
    console.log("Peerjs Server Running: " + exp.address().port);
});

peerServer.on('connection', (client) => { console.log("Client Connected: ", client.id); });

app.get('/runcode', (req, res) => {
    const url = req.query.url;
    const headers = {
        'Content-Type': 'application/json',
        'client-secret': 'your-hackerearth-secret' // Replace with your HackerEarth secret
    };

    fetch(url, { method: 'get', headers })
        .then(response => response.json())
        .then(json => res.send(json))
        .catch((err) => res.send(err));
});

app.post('/runcode', (req, res) => {
    const data = req.body;
    const url = "https://api.hackerearth.com/v4/partner/code-evaluation/submissions/";

    fetch(url, {
        method: 'post',
        body: JSON.stringify(data),
        headers: {
            'Content-Type': 'application/json',
            'client-secret': 'your-hackerearth-secret' // Replace with your HackerEarth secret
        },
    })
        .then(response => response.json())
        .then(json => res.send(json))
        .catch((err) => res.send(err));
});

io.on('connection', (socket) => {
    console.log(`Connected to frontend!`);
    socket.on('get-document', async (DocId) => {
        const doc = await findOrCreateDocument(DocId);
        socket.join(DocId);
        socket.emit('load-document', doc);
    });

    socket.on('changes', delta => {
        socket.broadcast.to(delta.docId).emit("receive-changes", delta);
    });

    socket.on('drawing', (data) => {
        socket.broadcast.emit('drawing', data);
    });

    socket.on('save-document', async (data) => {
        try {
            await Doc.findByIdAndUpdate({ '_id': data.docId }, { ...data });
        } catch (err) {
            console.error(err);
        }
    });

    socket.on('pencil-color-change', color => {
        socket.broadcast.to(color.docId).emit("pencil-color-change", color);
    });

    socket.on('join-room', (roomId, userId) => {
        socket.join(roomId);
        socket.to(roomId).emit('user-connected', userId);

        socket.on('toggled', (userId, video, audio) => {
            socket.to(roomId).emit('received-toggled-events', userId, video, audio);
        });

        socket.on('disconnect', () => {
            socket.to(roomId).emit('user-disconnected', userId);
        });
    });
});

const findOrCreateDocument = async (id) => {
    if (!id) {
        return;
    }
    const document = await Doc.findById(id);
    if (document) return document;
    return await Doc.create({ _id: id, html: "", css: "", js: "", python: "", java: "", cpp: "", input: "", output: "", pascal: "", perl: "", php: "", ruby: "" });
};

server.listen(PORT, () => {
    console.log(`Express Server Listening to ${PORT}`);
    console.log(`Socket Listening to ${FRONTEND_ORIGIN}`);
});