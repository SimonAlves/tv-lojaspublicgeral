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
    return `PREMIER-${result}`;
}

// --- HTML DA TV (COM QR CODE HÍBRIDO) ---
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
                <img id="qr" style="width:180px; display:block;">
                <p id="avisoQr" style="display:none; color:black; font-size:10px;">QR Automático</p>
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
        
        // LÓGICA DO QR CODE HÍBRIDO
        const imgQr = document.getElementById('qr');
        // 1. Tenta carregar sua imagem
        imgQr.src = "qrcode.png";
        // 2. Se der erro (não achar), pede pro servidor gerar um automático
        imgQr.onerror = () => {
            console.log("Imagem personalizada não encontrada. Gerando automático...");
            fetch('/qrcode').then(r => r.text()).then(url => {
                imgQr.src = url;
                document.getElementById('avisoQr').style.display = 'block';
            });
        };

        socket.on('status', (d) => {
            document.getElementById('nomeProd').innerText = d.produto;
            document.getElementById('num').innerText = d.restante;
            document.getElementById('fim').style.display = (!d.ativa || d.restante <= 0) ? 'flex' : 'none';
        });
    </script>
</body>
</html>
`;

// --- HTML MOBILE (COM VOUCHER TIPO TICKET E IMPRESSÃO) ---
const htmlMobile = `
<!DOCTYPE html>
<html>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; text-align:center; padding:20px; background:#f4f4f4; margin:0; }
    .btn-pegar { width:100%; padding:20px; background:#E60012; color:white; border:none; border-radius:50px; font-size:22px; margin-top:30px; font-weight:bold; box-shadow: 0 5px 15px rgba(230,0

