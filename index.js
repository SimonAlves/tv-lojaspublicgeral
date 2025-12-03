const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve arquivos de imagem/video da pasta raiz
app.use(express.static(__dirname));
app.use(express.json());

// --- DADOS DA CAMPANHA ---
let campanha = {
    produto: "Ração Premier - 10% OFF",
    total: 10,
    restante: 10,
    ativa: true
};

// --- FUNÇÃO PARA GERAR CÓDIGO ÚNICO (Ex: POLI-X7A9) ---
function gerarCodigo() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 4; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return `POLI-${result}`;
}

// --- HTML TV (IGUAL, MAS GARANTINDO O QR CODE) ---
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
            
            <div style="background:white; padding:10px; border-radius:10px; margin-top:20px;">
                <img id="qr" style="width:200px; display:block;">
            </div>
            
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
        
        // Pega o QR Code gerado pelo servidor
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

// --- HTML MOBILE (ATUALIZADO COM VOUCHER/TICKET) ---
const htmlMobile = `
<!DOCTYPE html>
<html>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
    body { font-family: Arial, sans-serif; text-align:center; padding:20px; background:#f4f4f4; }
    
    /* Botão bonito */
    .btn-pegar { width:100%; padding:20px; background:#ce0000; color:white; border:none; border-radius:50px; font-size:22px; margin-top:30px; font-weight:bold; box-shadow: 0 5px 15px rgba(206,0,0,0.4); }
    
    /* Estilo do Ticket/Voucher */
    .ticket-white {
        background: white;
        border-radius: 15px;
        padding: 25px 20px;
        position: relative;
        border: 2px dashed #ce0000;
        margin-top: 20px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.1);
    }
    .codigo-texto { font-size: 32px; color: #ce0000; font-weight: bold; letter-spacing: 2px; margin:15px 0; font-family: monospace; border: 1px solid #ddd; background: #f9f9f9; padding: 10px;}
    
    .no-print { display: block; }
    @media print { 
        .no-print { display:none; } 
        body { background:white; padding:0; } 
        .ticket-white { box-shadow:none; border:2px solid black; } 
    }
</style>
<body>
    <div id="telaPegar">
        <img src="logo.png" width="100">
        <h2 id="prodTitle">Carregando oferta...</h2>
        <p style="color:gray;">Oferta exclusiva da TV</p>
        
        <div id="box">
            <button onclick="resgatar()" class="btn-pegar">GARANTIR CUPOM</button>
        </div>
    </div>

    <div id="telaVoucher" style="display:none;">
        <h2 style="color:#ce0000;" class="no-print">PARABÉNS! 🎉</h2>
        
        <div class="ticket-white">
            <h3>VALE OFERTA</h3>
            <p style="color:gray;">Apresente no caixa:</p>
            
            <div class="codigo-texto" id="codGerado">...</div>
            
            <p style="font-size:12px; color:gray;">
                Gerado em: <span id="dataHora" style="font-weight:bold;"></span><br>
                Válido apenas hoje.
            </p>
        </div>

        <button onclick="window.print()" class="btn-pegar no-print" style="background:#333; margin-top:20px; font-size:16px;">🖨️ IMPRIMIR / SALVAR</button>
    </div>

    <div id="esgotado" style="display:none; color:red; margin-top:30px;">
        <h1>Esgotado 😢</h1>
        <p>Tente na próxima rodada!</p>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        
        function resgatar() { 
            socket.emit('resgatar'); 
        }
        
        socket.on('status', (d) => {
            document.getElementById('prodTitle').innerText = d.produto;
            // Se acabou e a pessoa ainda não pegou o voucher, mostra esgotado
            if((d.restante <= 0 || !d.ativa) && document.getElementById('telaVoucher').style.display === 'none') {
                document.getElementById('telaPegar').style.display = 'none';
                document.getElementById('esgotado').style.display = 'block';
            }
        });

        // Quando o servidor responde com o código
        socket.on('sucesso', (codigo) => {
            document.getElementById('telaPegar').style.display='none';
            document.getElementById('telaVoucher').style.display='block';
            
            document.getElementById('codGerado').innerText = codigo;
            
            const agora = new Date();
            document.getElementById('dataHora').innerText = agora.toLocaleString('pt-BR');
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
    <h1>🎛️ Painel Admin</h1>
    
    <div style="background:#444; padding:20px; border-radius:10px;">
        <label>Nome do Produto:</label><br>
        <input id="prod" style="width:90%; padding:10px; margin-bottom:15px; font-size:1.1rem;"><br>
        
        <label>Cupons Disponíveis:</label><br>
        <input id=\"qtd\" type=\"number\" style=\"width:100px; padding:10px; font-size:1.1rem; margin-bottom:15px;\">
        
        <br>
        <button onclick=\"enviar()\" style=\"background:#00cc00; color:white; padding:15px; border:none; border-radius:5px; cursor:pointer; font-weight:bold; width:100%;\">💾 ATUALIZAR TVS AGORA</button>
        <br><br>
        <button onclick=\"parar()\" style=\"background:#cc0000; color:white; padding:10px; border:none; border-radius:5px; cursor:pointer; width:100%;\">🛑 ENCERRAR CAMPANHA</button>
    </div>

    <script src=\"/socket.io/socket.io.js\"></script>
    <script>
        const socket = io();
        socket.on('status', (d) => {
            document.getElementById('prod').value = d.produto;
            if(document.activeElement !== document.getElementById('qtd')) document.getElementById('qtd').value = d.restante;
        });
        function enviar() {
            socket.emit('admin_alterar', {
                produto: document.getElementById('prod').value,
                restante: document.getElementById('qtd').value,
                ativa: true
            });
            alert("Comando enviado para todas as lojas!");
        }
        function parar() {
            if(confirm("Parar campanha?")) socket.emit('admin_alterar', { ativa: false });
        }
    </script>
</body>
</html>
`;

// --- ROTAS ---
app.get('/tv', (req, res) => res.send(htmlTV));
app.get('/mobile', (req, res) => res.send(htmlMobile));
app.get('/admin', (req, res) => res.send(htmlAdmin));
app.get('/', (req, res) => res.redirect('/tv'));

app.get('/qrcode', (req, res) => {
    const protocolo = req.headers['x-forwarded-proto'] || 'http';
    const url = `${protocolo}://${req.headers.host}/mobile`;
    QRCode.toDataURL(url, (err, src) => res.send(src));
});

// --- SOCKET LÓGICA ---
io.on('connection', (socket) => {
    socket.emit('status', campanha);
    
    // Quando cliente clica em resgatar no celular
    socket.on('resgatar', () => {
        if (campanha.ativa && campanha.restante > 0) {
            campanha.restante--;
            if (campanha.restante === 0) campanha.ativa = false;
            
            // Gera código único no servidor
            const codigoUnico = gerarCodigo();
            
            // Atualiza todas as telas com o novo número restante
            io.emit('status', campanha);
            
            // Manda o código SÓ para quem clicou
            socket.emit('sucesso', codigoUnico);
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
