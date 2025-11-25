const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve arquivos da pasta raiz
app.use(express.static(__dirname));

let campanha = {
    produto: "Ração Premier - 10% OFF",
    total: 10,
    restante: 10,
    ativa: true
};

// --- HTML DA TV (COM CORREÇÃO DE IMAGEM E QR CODE) ---
const htmlTV = `
<!DOCTYPE html>
<html>
<head><title>TV Polipet</title></head>
<body style="margin:0; background:black; overflow:hidden; font-family:Arial;">
    <div style="display:flex; height:100vh;">
        <div style="flex:3; background:black; display:flex; align-items:center; justify-content:center;">
            
            <video id="vid" src="promo.mp4" autoplay loop muted playsinline style="width:100%; height:100%; object-fit:contain;" onerror="avisoVideo()"></video>
            <h1 id="avisoVid" style="display:none; color:white; font-family:sans-serif;">VÍDEO 'promo.mp4' NÃO ENCONTRADO<br>Verifique o nome no GitHub</h1>

        </div>
        <div style="flex:1; background:#ce0000; display:flex; flex-direction:column; align-items:center; justify-content:center; border-left:5px solid white; text-align:center; color:white;">
            
            <img src="logo.png" onerror="this.src='https://www.polipet.com.br/arquivos/logo-polipet.png'" style="width:150px; background:white; padding:10px; border-radius:10px; margin-bottom:20px; max-width:80%;">
            
            <h1 id="nomeProd" style="font-size:2rem; padding:0 10px;">CARREGANDO...</h1>
            
            <div style="background:white; padding:10px; border-radius:5px;">
                <img id="qr" style="width:200px; display:block;">
            </div>
            
            <p style="margin-top:5px; font-weight:bold;">ESCANEIE AGORA</p>
            <h2>RESTAM: <span id="num" style="font-size:4rem; color:#fff700">--</span></h2>
        </div>
    </div>
    
    <div id="fim" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:black; color:white; align-items:center; justify-content:center; flex-direction:column; z-index:99;">
        <h1>OFERTA ENCERRADA</h1>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        
        // CORREÇÃO DO QR CODE
        fetch('/qrcode').then(r => r.text()).then(url => {
            document.getElementById('qr').src = url;
        });

        function avisoVideo(){
            document.getElementById('avisoVid').style.display = 'block';
            document.getElementById('vid').style.display = 'none';
        }

        socket.on('status', (d) => {
            document.getElementById('nomeProd').innerText = d.produto;
            document.getElementById('num').innerText = d.restante;
            document.getElementById('fim').style.display = (!d.ativa || d.restante <= 0) ? 'flex' : 'none';
        });
    </script>
</body>
</html>
`;

// --- (O resto do código é igual, mas precisa estar aqui completo) ---
const htmlAdmin = `
<!DOCTYPE html>
<html>
<meta name="viewport" content="width=device-width, initial-scale=1">
<body style="font-family:Arial; padding:20px; background:#333; color:white; text-align:center;">
    <h1>🎛️ Admin</h1>
    <div style="background:#444; padding:20px; border-radius:10px; max-width:500px; margin:0 auto;">
        <input id="prod" style="width:90%; padding:10px; margin-bottom:10px;" placeholder="Nome Produto"><br>
        <input id="qtd" type="number" style="width:100px; padding:10px; margin-bottom:20px;" placeholder="Qtd"><br>
        <button onclick="enviar()" style="background:#00cc00; color:white; padding:15px; width:100%; border:none; cursor:pointer;">💾 SALVAR</button>
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
            alert('Atualizado!');
        }
    </script>
</body>
</html>
`;

const htmlMobile = `
<!DOCTYPE html>
<html>
<meta name="viewport" content="width=device-width, initial-scale=1">
<body style="font-family:Arial; text-align:center; padding:20px; background:#f4f4f4;">
    <h2 id="prodTitle">Carregando...</h2>
    <button onclick="resgatar()" id="btn" style="width:100%; padding:20px; background:#ce0000; color:white; border:none; border-radius:10px; font-size:20px; margin-top:30px;">PEGAR CUPOM</button>
    <h1 id="msg" style="display:none; color:green; padding:20px;">✅ CUPOM GARANTIDO!</h1>
    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        function resgatar() { socket.emit('resgatar'); }
        socket.on('status', (d) => {
            document.getElementById('prodTitle').innerText = d.produto;
            if(d.restante <= 0 || !d.ativa) { document.getElementById('btn').style.display = 'none'; document.body.innerHTML += "<h1>Esgotado</h1>"; }
        });
        socket.on('sucesso', () => { document.getElementById('btn').style.display='none'; document.getElementById('msg').style.display='block'; });
    </script>
</body>
</html>
`;

app.get('/tv', (req, res) => res.send(htmlTV));
app.get('/admin', (req, res) => res.send(htmlAdmin));
app.get('/mobile', (req, res) => res.send(htmlMobile));
app.get('/', (req, res) => res.redirect('/tv'));

app.get('/qrcode', (req, res) => {
    const protocolo = req.headers['x-forwarded-proto'] || 'http';
    const url = `${protocolo}://${req.headers.host}/mobile`;
    QRCode.toDataURL(url, (err, src) => res.send(src));
});

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
    socket.on('admin_alterar', (d) => {
        if(d.produto) campanha.produto = d.produto;
        if(d.restante) campanha.restante = parseInt(d.restante);
        if(d.ativa !== undefined) campanha.ativa = d.ativa;
        io.emit('status', campanha);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Rodando na porta ${PORT}`));
