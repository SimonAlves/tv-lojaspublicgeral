const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(__dirname));
app.use(express.static('public'));

// --- CONFIGURAÇÃO DAS 3 CAMPANHAS E SUAS CORES ---
let campanhas = [
    // ID 0: Premier (Vermelho/Azul)
    { id: 0, nome: "Ração Premier", img: "slide1.jpg", qtd: 10, ativa: true, corPrincipal: '#E60012', corSecundaria: '#0055aa', prefixo: 'PREMIER' },
    // ID 1: Special Dog (Azul/Laranja)
    { id: 1, nome: "Special Dog",   img: "slide2.jpg", qtd: 15, ativa: true, corPrincipal: '#0055aa', corSecundaria: '#ff6600', prefixo: 'SPECIAL' },
    // ID 2: Adimax (Verde)
    { id: 2, nome: "Adimax",        img: "slide3.jpg", qtd: 20, ativa: true, corPrincipal: '#009933', corSecundaria: '#004411', prefixo: 'ADIMAX' }
];

let slideAtual = 0;

// --- ROTAÇÃO (20s) ---
setInterval(() => {
    slideAtual++;
    if (slideAtual >= campanhas.length) slideAtual = 0;
    io.emit('trocar_slide', campanhas[slideAtual]);
}, 20000);

// --- FUNÇÃO GERAR CÓDIGO COM PREFIXO DA MARCA ---
function gerarCodigo(prefixo) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 4; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return `${prefixo}-${result}`;
}

// --- HTML DA TV (CARROSSEL) ---
const htmlTV = `
<!DOCTYPE html>
<html>
<head><title>TV Polipet</title></head>
<body style="margin:0; background:black; overflow:hidden; font-family:Arial; transition: background 0.5s;">
    <div style="display:flex; height:100vh;">
        <div style="flex:3; background:#ccc; display:flex; align-items:center; justify-content:center; overflow:hidden;" id="bgEsq">
            <img id="fotoProd" src="" style="width:100%; height:100%; object-fit:contain;">
        </div>
        <div style="flex:1; background:#333; display:flex; flex-direction:column; align-items:center; justify-content:center; border-left:4px solid white; text-align:center; color:white;" id="bgDir">
            <img src="logo.png" onerror="this.style.display='none'" style="width:150px; background:white; padding:10px; border-radius:10px; margin-bottom:20px; max-width:80%;">
            <h1 id="nomeProd" style="font-size:2rem; padding:0 10px; height:80px; display:flex; align-items:center; justify-content:center;">...</h1>
            <h2 style="color:#00ff00; font-weight:bold;">OFERTA RELÂMPAGO</h2>
            <div style="background:white; padding:10px; border-radius:10px; margin-top:10px;">
                <img id="qr" src="qrcode.png" style="width:180px; display:block;" onerror="this.onerror=null; fetch('/qrcode').then(r=>r.text()).then(u=>this.src=u);">
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
        socket.on('trocar_slide', (d) => { actualizarTela(d); });
        socket.on('atualizar_qtd', (d) => {
            if(document.getElementById('nomeProd').innerText === d.nome) {
                document.getElementById('num').innerText = d.qtd;
            }
        });
        function actualizarTela(d) {
            document.getElementById('fotoProd').src = d.img;
            document.getElementById('nomeProd').innerText = d.nome;
            document.getElementById('num').innerText = d.qtd;
            // Muda a cor do fundo da TV para combinar com a marca
            document.getElementById('bgEsq').style.background = d.corSecundaria;
            document.getElementById('bgDir').style.background = d.corPrincipal;
        }
    </script>
</body>
</html>
`;

// --- HTML MOBILE (VOUCHER QUE MUDA DE COR) ---
const htmlMobile = `
<!DOCTYPE html>
<html>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
    body { font-family: Arial, sans-serif; text-align:center; padding:20px; background:#f4f4f4; transition: background 0.3s; }
    .btn-pegar { width:100%; padding:20px; color:white; border:none; border-radius:50px; font-size:20px; margin-top:20px; font-weight:bold; transition: background 0.3s; }
    .img-prod { width:100%; max-width:300px; border-radius:10px; margin-bottom:10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
    
    /* ESTILO BASE DO TICKET (As cores serão injetadas via JS) */
    .ticket-white { background:white; padding:20px; border-radius:15px; margin-top:20px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); position: relative; overflow: hidden; }
    /* Borda superior colorida do ticket */
    .ticket-header-bar { height: 15px; position: absolute; top: 0; left: 0; width: 100%; }
    
    .codigo-box { background:#f9f9f9; border: 2px dashed #ccc; padding: 15px; margin: 20px 0; border-radius: 8px; }
    .codigo-texto { font-size:28px; font-weight:bold; letter-spacing:1px; font-family: monospace; }
    .no-print { display: block; }
    @media print { .no-print { display:none; } body { background:white; padding:0; } .ticket-white { box-shadow:none; border:2px solid black; } }
</style>
<body>
    <div id="telaPegar">
        <h3 style="color:#555; margin-bottom:10px;">OFERTA DO MOMENTO:</h3>
        <img id="fotoM" src="" class="img-prod">
        <h2 id="nomeM" style="color:#333; margin:10px 0;">...</h2>
        <button onclick="resgatar()" id="btnResgatar" class="btn-pegar" style="background:#333;">GARANTIR AGORA</button>
        <p style="font-size:12px; color:gray; margin-top:10px;">Restam: <strong id="qtdM">--</strong> unidades</p>
    </div>

    <div id="telaVoucher" style="display:none;">
        <h2 id="tituloParabens" class="no-print" style="color:#333;">PARABÉNS!</h2>
        
        <div class="ticket-white" id="ticketContainer">
            <div class="ticket-header-bar" id="ticketBar"></div>
            
            <h3 style="margin-top:15px;">VALE OFERTA</h3>
            <h1 id="voucherNome" style="font-size: 24px; margin: 10px 0;">...</h1>
            <p style="color:gray;">Polipet Oficial</p>
            
            <div class="codigo-box" id="codBox">
                <p style="font-size:12px; margin:0; color:gray;">CÓDIGO DE VALIDAÇÃO:</p>
                <div class="codigo-texto" id="codGerado">...</div>
            </div>
            <p style="font-size:12px; color:gray;">Gerado em: <span id="dataHora"></span><br>Válido apenas hoje.</p>
        </div>
        <button onclick="window.print()" class="btn-pegar no-print" style="background:#333; margin-top:30px;">🖨️ IMPRIMIR VOUCHER</button>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        let ofertaAtual = null;

        // ATUALIZA A TELA INICIAL (Botão e Foto)
        socket.on('trocar_slide', (d) => {
            ofertaAtual = d;
            document.getElementById('fotoM').src = d.img;
            document.getElementById('nomeM').innerText = d.nome;
            document.getElementById('qtdM').innerText = d.qtd;
            // Muda a cor do botão para combinar com a oferta atual
            document.getElementById('btnResgatar').style.background = d.corPrincipal;
        });

        // Pede o status ao entrar
        socket.emit('pedir_atualizacao');

        function resgatar() { if(ofertaAtual) socket.emit('resgatar_oferta', ofertaAtual.id); }

        // QUANDO GANHA O VOUCHER
        socket.on('sucesso', (dados) => {
            document.getElementById('telaPegar').style.display='none';
            document.getElementById('telaVoucher').style.display='block';
            
            document.getElementById('voucherNome').innerText = dados.produto;
            document.getElementById('codGerado').innerText = dados.codigo;
            document.getElementById('dataHora').innerText = new Date().toLocaleString('pt-BR');

            // --- A MÁGICA DAS CORES AQUI ---
            // O servidor mandou as cores da marca ganha. Vamos aplicar!
            aplicarCoresVoucher(dados.corPrincipal, dados.corSecundaria);
        });

        function aplicarCoresVoucher(cor1, cor2) {
            // Pinta o título "Parabéns"
            document.getElementById('tituloParabens').style.color = cor1;
            // Pinta a barra superior do ticket
            document.getElementById('ticketBar').style.background = `linear-gradient(to right, \${cor1}, \${cor2})`;
            // Pinta o nome do produto
            document.getElementById('voucherNome').style.color = cor1;
            // Pinta a borda da caixa do código
            document.getElementById('codBox').style.borderColor = cor1;
            // Pinta o texto do código
            document.getElementById('codGerado').style.color = cor1;
            // Muda o fundo da página levemente
            document.body.style.backgroundColor = cor2 + '22'; // Adiciona transparência
        }
    </script>
</body>
</html>
`;

// --- ADMIN (IGUAL) ---
const htmlAdmin = `
<!DOCTYPE html><html><meta name="viewport" content="width=device-width, initial-scale=1"><body style="font-family:Arial; padding:20px; background:#222; color:white;"><h1>🎛️ Controle de Slides</h1><div id="paineis"></div><script src="/socket.io/socket.io.js"></script><script>const socket=io();socket.on('dados_admin',(lista)=>{const div=document.getElementById('paineis');div.innerHTML="";lista.forEach((c,index)=>{div.innerHTML+=\`<div style="background:#444; padding:15px; margin-bottom:15px; border-radius:10px; border-left: 5px solid \${c.ativa?'#0f0':'#f00'}"><h3>SLIDE \${index+1} (\${c.img})</h3>Nome: <input id="nome_\${index}" value="\${c.nome}" style="width:100px;"> Qtd: <input id="qtd_\${index}" type="number" value="\${c.qtd}" style="width:50px;"> <button onclick="salvar(\${index})" style="padding:5px; background:#00cc00; color:white;">Salvar</button></div>\`});});function salvar(id){const n=document.getElementById('nome_'+id).value;const q=document.getElementById('qtd_'+id).value;socket.emit('admin_update',{id:id,nome:n,qtd:q});alert('Salvo!');}</script></body></html>
`;

// --- ROTAS E SOCKET ---
app.get('/tv', (req, res) => res.send(htmlTV));
app.get('/admin', (req, res) => res.send(htmlAdmin));
app.get('/mobile', (req, res) => res.send(htmlMobile));
app.get('/', (req, res) => res.redirect('/tv'));
app.get('/qrcode', (req, res) => { const url = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}/mobile`; QRCode.toDataURL(url, (e, s) => res.send(s)); });

io.on('connection', (socket) => {
    socket.emit('trocar_slide', campanhas[slideAtual]);
    socket.emit('dados_admin', campanhas);
    socket.on('pedir_atualizacao', () => { socket.emit('trocar_slide', campanhas[slideAtual]); });
    socket.on('resgatar_oferta', (id) => {
        let camp = campanhas[id];
        if (camp && camp.qtd > 0 && camp.ativa) {
            camp.qtd--;
            io.emit('atualizar_qtd', camp);
            if(slideAtual === id) io.emit('trocar_slide', camp);
            // AQUI: Enviamos as cores e o prefixo da marca para o celular
            socket.emit('sucesso', { 
                codigo: gerarCodigo(camp.prefixo), 
                produto: camp.nome,
                corPrincipal: camp.corPrincipal,
                corSecundaria: camp.corSecundaria
            });
            io.emit('dados_admin', campanhas);
        }
    });
    socket.on('admin_update', (d) => { campanhas[d.id].nome=d.nome; campanhas[d.id].qtd=parseInt(d.qtd); io.emit('dados_admin',campanhas); if(slideAtual===d.id)io.emit('trocar_slide',campanhas[d.id]); });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Rodando'));
