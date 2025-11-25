const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve os arquivos da pasta public
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Dados Iniciais da Campanha
let campanha = {
    produto: "Ração Premier - 10% OFF",
    total: 10,
    restante: 10,
    ativa: true
};

// --- ROTAS ---
app.get('/tv', (req, res) => res.sendFile(__dirname + '/public/tv.html'));
app.get('/mobile', (req, res) => res.sendFile(__dirname + '/public/mobile.html'));
app.get('/admin', (req, res) => res.sendFile(__dirname + '/public/admin.html'));

// Gerador de QR Code Automático
app.get('/qrcode', (req, res) => {
    const protocolo = req.headers['x-forwarded-proto'] || 'http';
    const url = `${protocolo}://${req.headers.host}/mobile`;
    QRCode.toDataURL(url, (err, src) => res.send(src));
});

// --- LÓGICA DO SOCKET (Comunicação Real-Time) ---
io.on('connection', (socket) => {
    // Envia status atual para quem conectar (TVs, Celulares, Admin)
    socket.emit('status', campanha);

    // Cliente Resgatando Cupom
    socket.on('resgatar', () => {
        if (campanha.ativa && campanha.restante > 0) {
            campanha.restante--;
            if (campanha.restante === 0) campanha.ativa = false;
            
            // ATUALIZA TODAS AS 100 TVS INSTANTANEAMENTE
            io.emit('status', campanha);
            socket.emit('sucesso');
        }
    });

    // Você (Admin) alterando a campanha
    socket.on('admin_alterar', (dados) => {
        if(dados.produto) campanha.produto = dados.produto;
        if(dados.restante) campanha.restante = parseInt(dados.restante);
        if(dados.ativa !== undefined) campanha.ativa = dados.ativa;
        
        // Manda a ordem para todas as TVs
        io.emit('status', campanha);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Sistema rodando na porta ${PORT}`));