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
    produto: "Ração Premier - 10% OFF",
    total: 10,
    restante: 10,
    ativa: true
};

// --- FUNÇÃO DE CÓDIGO ÚNICO ---
function gerarCodigo() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 4; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return `POLI-${result}`;
}

// --- HTML DA TV (COM SISTEMA DE SEGURANÇA NO QR CODE) ---
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
                
                <img id="qr" src="qrcode.png" style="width:180px; display:block;" 
                     onerror="this.onerror=null; this.src='/qrcode'; console.log('Usando QR automático');">
            
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

// --- CELULAR (VOUCHER) ---
const htmlMobile = `
<!DOCTYPE html><html><meta name="viewport" content="width=device-width, initial-scale=1"><body style="font-family:Arial; text-align:center; padding:20px; background:#f0f0f0;"><div id="telaPegar"><h2 id="prodTitle">...</h2><div id="boxBtn"><button onclick="resgatar()" style="width:100%; padding:20px; background:#ce0000; color:white; border:none; border-radius:10px; font-size:20px; margin-top:30px; font-weight:bold; box-shadow: 0 4px 0 #990000;">PEGAR CUPOM</button><p style="color:gray; margin-top:10px;">Gera código único</p></div></div><div id="telaVoucher" style="display:none;"><h2 style="color:#003366;">🎉 PARABÉNS!</h2><div style="background:white; border:2px dashed #ce0000; padding:20px; border-radius:10px; margin-top:20px;"><img src="logo.png" width="80" style="margin-bottom:10px;"><hr style="border:0; border-top:1px solid #eee;"><p style="font-size:14px; color:gray;">CÓDIGO:</p><h1 id="codigoGerado" style="font-size:35px; color:#ce0000; margin:10px 0; letter-spacing: 2px;">...</h1><hr style="border:0; border-top:1px solid #eee;"><p style="font-size:12px; color:gray;">Gerado: <span id="dataHora"></span></p></div><p style="font-size:12px; color:gray; margin-top:20px;">Mostre ao caixa.</p></div><div id="esgotado" style="display:none; color:red; margin-top:30px;"><h1>Esgotado :(</h1></div><script src="/socket.io/socket.io.js"></script><script>const socket = io(); function resgatar() { socket.emit('resgatar'); } socket.on('status', d => { document.getElementById('prodTitle').innerText = d.produto; if((d.restante <= 0 || !d.ativa) && document.getElementById('telaVoucher').style.display === 'none') { document.getElementById('telaPegar').style.display='none'; document.getElementById('esgotado').style.display='block'; } }); socket.on('sucesso', (cod) => { document.getElementById('telaPegar').style.display='none'; document.getElementById('telaVoucher').style.display='block'; document.getElementById('codigoGerado').innerText = cod; document.getElementById('dataHora').innerText = new Date().toLocaleString('pt-BR'); });</script></body></html>
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
