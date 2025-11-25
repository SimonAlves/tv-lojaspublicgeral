const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve arquivos de imagem/video da pasta raiz (onde está o index.js)
app.use(express.static(__dirname));
app.use(express.json());

// --- DADOS DA CAMPANHA ---
let campanha = {
    produto: "Ração Premier - 10% OFF",
    total: 10,
    restante: 10,
    ativa: true
};

// --- HTMLS EMBUTIDOS (Para não dar erro de arquivo não encontrado) ---

const htmlTV = `
<!DOCTYPE html>
<html>
<head><title>TV Polipet</title></head>
<body style="margin:0; background:black; overflow:hidden; font-family:Arial;">
    <div style="display:flex; height:100vh;">
        <div style="flex:3; background:black; display:flex; align-items:center; justify-content:center;">
            <video src="promo.mp4" autoplay loop muted playsinline style="width:100%; height:100%; object-fit:contain;"></video>
        </div>
        <div style="flex:1; background:#ce0000; display:flex; flex-direction:column; align-items:center; justify-content:center; border-left:5px solid white; text-align:center; color:white;">
            <img src="logo.png" style="width:150px; background:white; padding:10px; border-radius:10px; margin-bottom:20px; max-width:80%;">
            <h1 id="nomeProd" style="font-size:2rem; padding:0 10px;">CARREGANDO...</h1>
            <img id="qr" style="border:5px solid white; width:80%; max-width:250px;">
            <p style="margin-top:5px; font-weight:bold;">ESCANEIE AGORA</p>
            <h2>RESTAM: <span id="num" style="font-size:4rem; color:#fff700">--</span></h2>
        </div>
    </div>
    <div id="fim" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:black; color:white; align-items:center; justify-content:center; flex-direction:column; z-index:99;">
        <img src="logo.png" width="200" style="margin-bottom:20px;">
        <h1 style="font-size:3rem;">OFERTA ENCERRADA</h1>
    </div>
    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        document.getElementById('qr').src = '/qrcode';
        socket.on('status', (d) => {
            document.getElementById('nomeProd').innerText = d.produto;
            document.getElementById('num').innerText = d.restante;
            document.getElementById('fim').style.display = (!d.ativa || d.restante <= 0) ? 'flex' : 'none';
        });
    </script>
</body>
</html>
`;

const htmlMobile = `
<!DOCTYPE html>
<html>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<body style="font-family:Arial; text-align:center; padding:20px; background:#f4f4f4;">
    <img src="logo.png" width="100">
    <h2 id="prodTitle">Carregando...</h2>
    <div id="box">
        <button onclick="resgatar()" style="width:100%; padding:20px; font-size:1.2rem; background:#ce0000; color:white; border:none; border-radius:10px; cursor:pointer; font-weight:bold; margin-top:20px;">PEGAR MEU CUPOM</button>
    </div>
    <h1 id="msg" style="display:none; color:green; border:2px solid green; padding:20px; margin-top:20px; background:white;">✅ CUPOM GARANTIDO!</h1>
    <div id="esgotado" style="display:none; color:red; margin-top:20px;"><h1>Esgotado 😢</h1></div>
    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        function resgatar() { socket.emit('resgatar'); }
        socket.on('status', (d) => {
            document.getElementById('prodTitle').innerText = d.produto;
            if(d.restante <= 0 || !d.ativa) {
                document.getElementById('box').style.display = 'none';
                document.getElementById('esgotado').style.display = 'block';
            }
        });
        socket.on('sucesso', () => {
            document.getElementById('box').style.display='none';
            document.getElementById('msg').style.display='block';
        });
    </script>
</body>
</html>
`;

const htmlAdmin = `
<!DOCTYPE html>
<html>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<head><title>Admin Polipet</title></head>
<body style="font-family:Arial; padding:20px; background:#222; color:white; max-width:600px; margin:0 auto;">
    <h1>🎛️ Painel Admin (100 Lojas)</h1>
    <div style="background:#444; padding:20px; border-radius:10px;">
        <label>Produto:</label><br><input id="prod" style="width:90%; padding:10px; margin-bottom:15px;"><br>
        <label>Qtd:</label><br><input id="qtd" type="number" style="width:100px; padding:10px; margin-bottom:15px;"><br>
        <button onclick="enviar()" style="background:#00cc00; color:white; padding:15px; width:100%; border:none; cursor:pointer; font-weight:bold;">💾 ATUALIZAR TVS</button>
        <br><br><button onclick="parar()" style="background:#cc0000; color:white; padding:10px; width:100%; border:none; cursor:pointer;">🛑 PARAR</button>
    </div>
    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        socket.on('status', (d) => {
            document.getElementById('prod').value = d.produto;
            if(document.activeElement !== document.getElementById('qtd')) document.getElementById('qtd').value = d.restante;
        });
        function enviar() {
            socket.emit('admin_alterar', { produto: document.getElementById('prod').value, restante: document.getElementById('qtd').value, ativa: true });
            alert("Enviado!");
        }
        function parar() { if(confirm("Parar?")) socket.emit('admin_alterar', { ativa: false }); }
    </script>
</body>
</html>
`;

// --- ROTAS DO SISTEMA (Agora usam as variáveis acima) ---
app.get('/tv', (req, res) => res.send(htmlTV));
app.get('/mobile', (req, res) => res.send(htmlMobile));
app.get('/admin', (req, res) => res.send(htmlAdmin));

// Rota raiz (redireciona para TV para facilitar)
app.get('/', (req, res) => res.redirect('/tv'));

app.get('/qrcode', (req, res) => {
    const protocolo = req.headers['x-forwarded-proto'] || 'http';
    const url = `${protocolo}://${req.headers.host}/mobile`;
    QRCode.toDataURL(url, (err, src) => res.send(src));
});

// --- SOCKET ---
io.on('connection', (socket) => {
    socket.emit('status', campanha);
    socket.on('resgatar', () => {
        if (campanha.ativa && campanha.restante > 0) {
            campanha.restante--;
            if (campanha.restante === 0) campanha.ativa = false;
            io.emit('status', campanha);
            socket.emit('sucesso');
        }
    });
    socket.on('admin_alterar', (dados) => {
        if(dados.produto) campanha.produto = dados.produto;
        if(dados.restante) campanha.restante = parseInt(dados.restante);
        if(dados.ativa !== undefined) campanha.ativa = dados.ativa;
        io.emit('status', campanha);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Rodando na porta ${PORT}`));
