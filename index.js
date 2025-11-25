const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Configuração para achar arquivos
app.use(express.static(__dirname));
app.use(express.static('public'));

let campanha = {
    produto: "Ração Premier",
    total: 10,
    restante: 10,
    ativa: true
};

// --- FUNÇÃO PARA GERAR VOUCHER ÚNICO ---
function gerarCodigo() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 4; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    // Mantive PREMIER no código, mas podemos mudar para POLI se quiser
    return `PREMIER-${result}`;
}

// --- HTML DA TV (IGUAL) ---
const htmlTV = `
<!DOCTYPE html>
<html>
<head><title>TV Polipet</title></head>
<body style="margin:0; background:black; overflow:hidden; font-family:Arial;">
    <div style="display:flex; height:100vh;">
        <div style="flex:3; background:#0055aa; display:flex; align-items:center; justify-content:center; overflow:hidden;">
            <img src="premier1.jpg" style="width:100%; height:100%; object-fit:contain;" 
                 onerror="document.getElementById('erro').style.display='block'">
            <h1 id="erro" style="display:none; color:white; font-family:sans-serif;">FALTA 'premier1.jpg'</h1>
        </div>
        <div style="flex:1; background:#003366; display:flex; flex-direction:column; align-items:center; justify-content:center; border-left:4px solid white; text-align:center; color:white;">
            <img src="logo.png" onerror="this.style.display='none'" style="width:150px; background:white; padding:10px; border-radius:10px; margin-bottom:20px; max-width:80%;">
            <h1 id="nomeProd" style="font-size:2rem; padding:0 10px;">CARREGANDO...</h1>
            <h2 style="color:#00ff00; font-weight:bold;">OFERTA EXCLUSIVA</h2>
            <div style="background:white; padding:10px; border-radius:10px; margin-top:10px;">
                <img id="qr" style="width:180px; display:block;" src="qrcode.png" 
                     onerror="this.onerror=null; fetch('/qrcode').then(r=>r.text()).then(u=>this.src=u);">
            </div>
            <p style="margin-top:10px; font-weight:bold;">ESCANEIE AGORA</p>
            <div style="margin-top:20px; border-top:1px solid rgba(255,255,255,0.3); width:80%; padding-top:10px;">
                <span>RESTAM APENAS:</span><br>
                <span id="num" style="font-size:5rem; color:#fff700; font-weight:bold; line-height:1;">--</span>
            </div>
        </div>
    </div>
    <div id="fim" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:black; color:white; align-items:center; justify-content:center; flex-direction:column; z-index:99;">
        <h1>OFERTA ENCERRADA</h1>
    </div>
    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        socket.on('status', (d) => {
            document.getElementById('nomeProd').innerText = d.produto;
            document.getElementById('num').innerText = d.restante;
            document.getElementById('fim').style.display = (!d.ativa || d.restante <= 0) ? 'flex' : 'none';
        });
    </script>
</body>
</html>
`;

// --- HTML MOBILE (AGORA TUDO AZUL POLIPET) ---
const htmlMobile = `
<!DOCTYPE html>
<html>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; text-align:center; padding:20px; background:#f4f4f4; margin:0; }
    
    /* Botão Azul Polipet */
    .btn-pegar { width:100%; padding:20px; background:#0055aa; color:white; border:none; border-radius:50px; font-size:22px; margin-top:30px; font-weight:bold; box-shadow: 0 5px 15px rgba(0, 85, 170, 0.4); transition: transform 0.2s; }
    .btn-pegar:active { transform: scale(0.98); }
    
    /* TICKET AZUL */
    .ticket-white {
        background: white;
        border-radius: 15px;
        padding: 25px 20px;
        position: relative;
        /* Borda tracejada AZUL */
        border: 2px dashed #0055aa;
        margin-top: 20px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.1);
    }
    /* Título AZUL */
    .ticket-title { color: #0055aa; font-size: 28px; font-weight: 900; margin: 0; text-transform: uppercase; }
    
    /* Caixa do Código AZUL */
    .codigo-box { background: #f0f8ff; border: 2px solid #0055aa; border-radius: 10px; padding: 15px; margin: 20px 0; }
    /* Texto do Código AZUL */
    .codigo-texto { font-size: 32px; color: #0055aa; font-weight: bold; letter-spacing: 3px; margin:0; font-family: monospace; }
    
    /* Botão Imprimir (Escuro) */
    .btn-print {
        background: #333; color: white; border: none; padding: 15px; border-radius: 10px;
        margin-top: 20px; font-size: 16px; cursor: pointer; width: 100%;
    }

    /* Impressão Limpa */
    @media print {
        body { background: white; padding: 0; margin: 0; }
        #telaPegar, #esgotado, .no-print, h3, .msg-security { display: none !important; }
        .ticket-white { box-shadow: none; border: 3px solid black; margin: 0; width: 100%; }
        .codigo-texto { color: black; border: 2px solid black; padding: 10px; }
        .ticket-title { color: black; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
</style>

<body>
    <div id="telaPegar">
        <img src="logo.png" width="120" style="margin-bottom:20px; filter: grayscale(100%); opacity: 0.5;">
        <h2 id="prodTitle" style="color:#333; margin-bottom:0;">...</h2>
        <div id="boxBtn">
            <button onclick="resgatar()" class="btn-pegar">GARANTIR VOUCHER</button>
            <p style="color:gray; font-size:12px; margin-top:15px;">Toque para gerar seu código único</p>
        </div>
    </div>

    <div id="telaVoucher" style="display:none;">
        <h3 style="color:#0055aa; margin-bottom:10px;" class="no-print">🎉 VOUCHER GARANTIDO!</h3>
        
        <div class="ticket-white">
            <h1 class="ticket-title">VALE OFERTA</h1>
            <p style="color:#333; margin: 5px 0 20px 0;">Polipet Oficial</p>
            <div style="border-top: 2px dashed #ccc; margin: 20px -20px;"></div>
            <p style="font-size:12px; color:gray; text-transform: uppercase;">Código de validação:</p>
            
            <div class="codigo-box">
                <h1 id="codigoGerado" class="codigo-texto">...</h1>
            </div>

            <div style="color: #666; font-size: 12px; margin-top: 15px; border-top: 1px solid #eee; padding-top: 15px;">
                Gerado em: <span id="dataHora" style="font-weight:bold; color:#333;"></span><br>
                <span style="color:#0055aa; font-weight:bold;">Válido hoje.</span>
            </div>
        </div>

        <button onclick="window.print()" class="btn-print no-print">🖨️ IMPRIMIR / PDF</button>
        <p class="msg-security no-print" style="font-size:12px; color:gray; margin-top:20px;">Mostre ao caixa.</p>
    </div>

    <div id="esgotado" style="display:none; color:red; margin-top:30px;">
        <h1>Oferta Esgotada 😢</h1>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        function resgatar() { socket.emit('resgatar'); }
        socket.on('status', d => {
            document.getElementById('prodTitle').innerText = d.produto;
            if((d.restante <= 0 || !d.ativa) && document.getElementById('telaVoucher').style.display === 'none') {
                document.getElementById('telaPegar').style.display='none';
                document.getElementById('esgotado').style.display='block';
            }
        });
        socket.on('sucesso', (cod) => {
            document.getElementById('telaPegar').style.display='none';
            document.getElementById('telaVoucher').style.display='block';
            document.getElementById('codigoGerado').innerText = cod;
            document.getElementById('dataHora').innerText = new Date().toLocaleString('pt-BR');
        });
    </script>
</body>
</html>
`;

// --- ADMIN ---
const htmlAdmin = `
<!DOCTYPE html><html><meta name="viewport" content="width=device-width, initial-scale=1"><body style="font-family:Arial; padding:20px; background:#333; color:white; text-align:center;"><h1>🎛️ Admin</h1><div style="background:#444; padding:20px; border-radius:10px; max-width:500px; margin:0 auto;"><input id="prod" style="width:90%; padding:10px; margin-bottom:10px;"><br><input id="qtd" type="number" style="width:100px; padding:10px; margin-bottom:20px;"><br><button onclick="enviar()" style="background:#00cc00; color:white; padding:15px; width:100%;">ATUALIZAR</button><br><br><button onclick="parar()" style="background:#cc0000; color:white; padding:10px; width:100%;">PARAR</button></div><script src="/socket.io/socket.io.js"></script><script>const socket = io(); socket.on('status', d => { document.getElementById('prod').value = d.produto; if(document.activeElement !== document.getElementById('qtd')) document.getElementById('qtd').value = d.restante; }); function enviar() { socket.emit('admin_alterar', { produto: document.getElementById('prod').value, restante: document.getElementById('qtd').value, ativa: true }); alert('Ok!'); } function parar() { if(confirm('Parar?')) socket.emit('admin_alterar', { ativa: false }); }</script></body></html>
`;

// --- ROTAS ---
app.get('/tv', (req, res) => res.send(htmlTV));
app.get('/admin', (req, res) => res.send(htmlAdmin));
app.get('/mobile', (req, res) => res.send(htmlMobile));
app.get('/', (req, res) => res.redirect('/tv'));
app.get('/qrcode', (req, res) => { const url = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}/mobile`; QRCode.toDataURL(url, (e, s) => res.send(s)); });

// --- SOCKET ---
io.on('connection', s => { 
    s.emit('status', campanha); 
    s.on('resgatar', () => { 
        if(campanha.ativa && campanha.restante > 0) { 
            campanha.restante--; 
            if(campanha.restante===0) campanha.ativa=false; 
            const cod = gerarCodigo(); 
            io.emit('status', campanha); 
            s.emit('sucesso', cod); 
        } 
    }); 
    s.on('admin_alterar', d => { 
        if(d.produto) campanha.produto=d.produto; 
        if(d.restante) campanha.restante=parseInt(d.restante); 
        if(d.ativa!==undefined) campanha.ativa=d.ativa; 
        io.emit('status', campanha); 
    }); 
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Rodando'));
