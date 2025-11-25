const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(__dirname));
app.use(express.static('public'));

// --- CONFIGURAÇÃO DAS 3 CAMPANHAS ---
let campanhas = [
    { id: 0, nome: "Ração Premier", img: "slide1.jpg", qtd: 10, ativa: true },
    { id: 1, nome: "Special Dog",   img: "slide2.jpg", qtd: 15, ativa: true },
    { id: 2, nome: "Adimax",        img: "slide3.jpg", qtd: 20, ativa: true }
];

let slideAtual = 0; // Começa no slide 0

// --- ROTAÇÃO AUTOMÁTICA (20 SEGUNDOS) ---
setInterval(() => {
    slideAtual++;
    if (slideAtual >= campanhas.length) {
        slideAtual = 0; // Volta pro primeiro
    }
    // Avisa todo mundo para mudar de tela
    io.emit('trocar_slide', campanhas[slideAtual]);
}, 20000); // 20000 ms = 20 segundos

// --- FUNÇÃO CÓDIGO ÚNICO ---
function gerarCodigo() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 4; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return `VOUCHER-${result}`;
}

// --- HTML DA TV (RECEBE ORDENS DE TROCA) ---
const htmlTV = `
<!DOCTYPE html>
<html>
<head><title>TV Polipet</title></head>
<body style="margin:0; background:black; overflow:hidden; font-family:Arial; transition: background 0.5s;">
    <div style="display:flex; height:100vh;">
        
        <div style="flex:3; background:#0055aa; display:flex; align-items:center; justify-content:center; overflow:hidden;">
            <img id="fotoProd" src="" style="width:100%; height:100%; object-fit:contain;">
        </div>

        <div style="flex:1; background:#003366; display:flex; flex-direction:column; align-items:center; justify-content:center; border-left:4px solid white; text-align:center; color:white;">
            
            <img src="logo.png" onerror="this.style.display='none'" style="width:150px; background:white; padding:10px; border-radius:10px; margin-bottom:20px; max-width:80%;">
            
            <h1 id="nomeProd" style="font-size:2rem; padding:0 10px; height:80px; display:flex; align-items:center; justify-content:center;">...</h1>
            <h2 style="color:#00ff00; font-weight:bold;">OFERTA RELÂMPAGO</h2>
            
            <div style="background:white; padding:10px; border-radius:10px; margin-top:10px;">
                <img id="qr" src="qrcode.png" style="width:180px; display:block;" 
                     onerror="this.onerror=null; fetch('/qrcode').then(r=>r.text()).then(u=>this.src=u);">
            </div>
            
            <p style="margin-top:10px; font-weight:bold;">ESCANEIE AGORA</p>
            
            <div style="margin-top:20px; border-top:1px solid rgba(255,255,255,0.3); width:80%; padding-top:10px;">
                <span>RESTAM APENAS:</span><br>
                <span id="num" style="font-size:5rem; color:#fff700; font-weight:bold; line-height:1;">--</span>
            </div>
        </div>
    </div>
    
    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        
        // Ouve quando o servidor manda trocar o slide
        socket.on('trocar_slide', (dados) => {
            atualizarTela(dados);
        });

        // Ouve quando alguém pega um cupom (atualiza só o número)
        socket.on('atualizar_qtd', (dados) => {
            // Só atualiza se o cupom pego for do slide que estou vendo agora
            const slideNaTela = document.getElementById('nomeProd').innerText;
            if(slideNaTela === dados.nome) {
                document.getElementById('num').innerText = dados.qtd;
            }
        });

        function atualizarTela(d) {
            document.getElementById('fotoProd').src = d.img;
            document.getElementById('nomeProd').innerText = d.nome;
            document.getElementById('num').innerText = d.qtd;
        }
    </script>
</body>
</html>
`;

// --- HTML MOBILE (SEMPRE MOSTRA A OFERTA ATUAL) ---
const htmlMobile = `
<!DOCTYPE html>
<html>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
    body { font-family: Arial, sans-serif; text-align:center; padding:20px; background:#f4f4f4; }
    .btn-pegar { width:100%; padding:20px; background:#E60012; color:white; border:none; border-radius:50px; font-size:20px; margin-top:20px; font-weight:bold; }
    .img-prod { width:100%; max-width:300px; border-radius:10px; margin-bottom:10px; }
    .ticket-white { background:white; padding:20px; border:2px dashed #0055aa; border-radius:10px; margin-top:20px; }
    .codigo-texto { font-size:30px; color:#0055aa; font-weight:bold; letter-spacing:2px; }
    .no-print { display: block; }
    @media print { .no-print { display:none; } body { background:white; } .ticket-white { border:2px solid black; } .codigo-texto { color:black; } }
</style>
<body>
    <div id="telaPegar">
        <h3 style="color:#555;">OFERTA DO MOMENTO:</h3>
        <img id="fotoM" src="" class="img-prod">
        <h2 id="nomeM" style="color:#333;">...</h2>
        <p>Restam: <strong id="qtdM" style="color:red;">--</strong></p>
        <button onclick="resgatar()" class="btn-pegar">GARANTIR AGORA</button>
    </div>

    <div id="telaVoucher" style="display:none;">
        <h2 style="color:#0055aa;" class="no-print">PARABÉNS!</h2>
        <div class="ticket-white">
            <h3>VALE OFERTA</h3>
            <h2 id="voucherNome" style="color:#E60012;">...</h2>
            <hr>
            <p>CÓDIGO:</p>
            <div class="codigo-texto" id="codGerado">...</div>
            <p style="font-size:12px;">Válido Hoje - <span id="dataHora"></span></p>
        </div>
        <button onclick="window.print()" class="btn-pegar no-print" style="background:#333;">IMPRIMIR</button>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        let ofertaAtual = null;

        socket.on('trocar_slide', (d) => {
            ofertaAtual = d;
            document.getElementById('fotoM').src = d.img;
            document.getElementById('nomeM').innerText = d.nome;
            document.getElementById('qtdM').innerText = d.qtd;
        });

        // Pede o status atual assim que entra
        socket.emit('pedir_atualizacao');

        function resgatar() {
            if(ofertaAtual) {
                socket.emit('resgatar_oferta', ofertaAtual.id);
            }
        }

        socket.on('sucesso', (dados) => {
            document.getElementById('telaPegar').style.display='none';
            document.getElementById('telaVoucher').style.display='block';
            document.getElementById('voucherNome').innerText = dados.produto;
            document.getElementById('codGerado').innerText = dados.codigo;
            document.getElementById('dataHora').innerText = new Date().toLocaleTimeString();
        });
    </script>
</body>
</html>
`;

// --- ADMIN (CONTROLA OS 3 SLIDES) ---
const htmlAdmin = `
<!DOCTYPE html><html><meta name="viewport" content="width=device-width, initial-scale=1"><body style="font-family:Arial; padding:20px; background:#222; color:white;">
<h1>🎛️ Controle de Slides</h1>
<div id="paineis"></div>
<script src="/socket.io/socket.io.js"></script>
<script>
    const socket = io();
    socket.on('dados_admin', (lista) => {
        const div = document.getElementById('paineis');
        div.innerHTML = "";
        lista.forEach((c, index) => {
            div.innerHTML += \`
            <div style="background:#444; padding:15px; margin-bottom:15px; border-radius:10px; border-left: 5px solid \${c.ativa ? '#0f0' : '#f00'}">
                <h3>SLIDE \${index + 1} (\${c.img})</h3>
                Nome: <input id="nome_\${index}" value="\${c.nome}" style="width:100px;">
                Qtd: <input id="qtd_\${index}" type="number" value="\${c.qtd}" style="width:50px;">
                <button onclick="salvar(\${index})" style="padding:5px; background:#00cc00; color:white;">Salvar</button>
            </div>\`;
        });
    });
    function salvar(id) {
        const n = document.getElementById('nome_'+id).value;
        const q = document.getElementById('qtd_'+id).value;
        socket.emit('admin_update', { id: id, nome: n, qtd: q });
        alert('Slide ' + (id+1) + ' Atualizado!');
    }
</script></body></html>
`;

// --- ROTAS ---
app.get('/tv', (req, res) => res.send(htmlTV));
app.get('/admin', (req, res) => res.send(htmlAdmin));
app.get('/mobile', (req, res) => res.send(htmlMobile));
app.get('/', (req, res) => res.redirect('/tv'));
app.get('/qrcode', (req, res) => { const url = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}/mobile`; QRCode.toDataURL(url, (e, s) => res.send(s)); });

// --- SOCKET LÓGICA ---
io.on('connection', (socket) => {
    // Assim que conecta, manda o slide atual
    socket.emit('trocar_slide', campanhas[slideAtual]);
    // Manda dados pro admin
    socket.emit('dados_admin', campanhas);

    socket.on('pedir_atualizacao', () => {
        socket.emit('trocar_slide', campanhas[slideAtual]);
    });

    // Cliente resgatando
    socket.on('resgatar_oferta', (idDaOferta) => {
        let camp = campanhas[idDaOferta];
        if (camp && camp.qtd > 0) {
            camp.qtd--;
            // Atualiza o número na TV na hora (se ela estiver mostrando esse slide)
            io.emit('atualizar_qtd', camp);
            // Se o slide atual for esse, força atualização visual
            if(slideAtual === idDaOferta) io.emit('trocar_slide', camp);
            
            // Manda voucher pro cliente
            socket.emit('sucesso', { codigo: gerarCodigo(), produto: camp.nome });
            
            // Atualiza Admin
            io.emit('dados_admin', campanhas);
        }
    });

    // Admin salvando
    socket.on('admin_update', (d) => {
        campanhas[d.id].nome = d.nome;
        campanhas[d.id].qtd = parseInt(d.qtd);
        io.emit('dados_admin', campanhas);
        // Se for o slide atual, atualiza a TV
        if(slideAtual === d.id) io.emit('trocar_slide', campanhas[d.id]);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Rodando'));
