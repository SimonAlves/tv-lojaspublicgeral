const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(__dirname));
app.use(express.static('public'));

let campanha = {
    produto: "Ração Premier",
    total: 10,
    restante: 10,
    ativa: true
};

function gerarCodigo() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 4; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return `PREMIER-${result}`;
}

// --- TV (IGUAL) ---
const htmlTV = `
<!DOCTYPE html>
<html>
<head><title>TV Polipet</title></head>
<body style="margin:0; background:black; overflow:hidden; font-family:Arial;">
    <div style="display:flex; height:100vh;">
        <div style="flex:3; background:#0055aa; display:flex; align-items:center; justify-content:center; overflow:hidden;">
            <img src="premier1.jpg" style="width:100%; height:100%; object-fit:contain;" onerror="document.getElementById('erro').style.display='block'">
            <h1 id="erro" style="display:none; color:white;">FALTA 'premier1.jpg'</h1>
        </div>
        <div style="flex:1; background:#003366; display:flex; flex-direction:column; align-items:center; justify-content:center; border-left:4px solid white; text-align:center; color:white;">
            <img src="logo.png" onerror="this.style.display='none'" style="width:150px; background:white; padding:10px; border-radius:10px; margin-bottom:20px; max-width:80%;">
            <h1 id="nomeProd" style="font-size:2rem; padding:0 10px;">CARREGANDO...</h1>
            <h2 style="color:#00ff00; font-weight:bold;">OFERTA EXCLUSIVA</h2>
            <div style="background:white; padding:10px; border-radius:10px; margin-top:10px;">
                <img id="qr" src="qrcode.png" style="width:180px; display:block;" onerror="this.onerror=null; this.src='/qrcode';">
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

// --- MOBILE (AGORA COM BOTÃO DE IMPRIMIR E MODO DE IMPRESSÃO) ---
const htmlMobile = `
<!DOCTYPE html>
<html>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; text-align:center; padding:20px; background:#f4f4f4; margin:0; }
    .btn-pegar { width:100%; padding:20px; background:#E60012; color:white; border:none; border-radius:50px; font-size:22px; margin-top:30px; font-weight:bold; box-shadow: 0 5px 15px rgba(230,0,18,0.4); }
    
    /* ESTILO DO TICKET */
    .ticket-white {
        background: white;
        border-radius: 15px;
        padding: 25px 20px;
        position: relative;
        border: 2px dashed #E60012;
        margin-top: 20px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.1);
    }
    .ticket-title { color: #E60012; font-size: 28px; font-weight: 900; margin: 0; text-transform: uppercase; }
    .codigo-box { background: #f9f9f9; border: 2px solid #E60012; border-radius: 10px; padding: 15px; margin: 20px 0; }
    .codigo-texto { font-size: 32px; color: #E60012; font-weight: bold; letter-spacing: 3px; margin:0; font-family: monospace; }
    
    /* BOTÃO IMPRIMIR */
    .btn-print {
        background: #333;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 5px;
        margin-top: 20px;
        font-size: 16px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 10px;
    }

    /* REGRAS MÁGICAS DE IMPRESSÃO */
    @media print {
        body { background: white; padding: 0; margin: 0; }
        #telaPegar, #esgotado, .no-print, h3, .msg-security { display: none !important; }
        .ticket-white { box-shadow: none; border: 2px solid black; margin: 0; width: 100%; }
        .codigo-texto { color: black; }
        .ticket-title { color: black; }
        .codigo-box { border: 2px solid black; }
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
        <h3 style="color:#E60012; margin-bottom:10px;">🎉 VOUCHER GARANTIDO!</h3>
        
        <div class="ticket-white">
            <h1 class="ticket-title">VALE OFERTA</h1>
            <p style="color:#333; margin: 5px 0 20px 0;">Polipet Oficial</p>
            
            <div style="border-top: 2px dashed #ccc; margin: 20px -20px;"></div>
            <p style="font-size:12px; color:gray; text-transform: uppercase;">Código de validação:</p>
            
            <div class="codigo-
