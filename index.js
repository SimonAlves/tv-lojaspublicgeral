const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(__dirname));
app.use(express.static('public'));

// --- CONFIGURAÇÃO DAS 3 PROMOÇÕES ---
let campanhas = [
    { 
        id: 0, 
        tipo: 'foto', 
        arquivo: "slide1.jpg", 
        nome: "Sorteio 50% OFF", 
        qtd: 5, 
        totalResgates: 0,
        ativa: true, 
        corPrincipal: '#FFD700', 
        corSecundaria: '#003399', 
        prefixo: 'GOLD',
        ehSorteio: true,
        resgatesPorHora: new Array(24).fill(0),
        ultimoCupom: "Nenhum",
        ultimaHora: "--:--"
    },
    { 
        id: 1, 
        tipo: 'foto', 
        arquivo: "slide2.jpg", 
        nome: "Ducha Grátis",   
        qtd: 50, 
        totalResgates: 0,
        ativa: true, 
        corPrincipal: '#0055aa', 
        corSecundaria: '#0099ff', 
        prefixo: 'DUCHA',
        ehSorteio: false,
        resgatesPorHora: new Array(24).fill(0),
        ultimoCupom: "Nenhum",
        ultimaHora: "--:--"
    },
    { 
        id: 2, 
        tipo: 'foto', 
        arquivo: "slide3.jpg", 
        nome: "Café Expresso Grátis",        
        qtd: 50, 
        totalResgates: 0,
        ativa: true, 
        corPrincipal: '#F37021', 
        corSecundaria: '#663300', 
        prefixo: 'CAFE',
        ehSorteio: false,
        resgatesPorHora: new Array(24).fill(0),
        ultimoCupom: "Nenhum",
        ultimaHora: "--:--"
    }
];

let slideAtual = 0;

setInterval(() => {
    slideAtual++;
    if (slideAtual >= campanhas.length) slideAtual = 0;
    io.emit('trocar_slide', campanhas[slideAtual]);
}, 15000);

function gerarCodigo(prefixo) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let res = '';
    for (let i = 0; i < 4; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
    return `${prefixo}-${res}`;
}

// --- HTML DA TV ---
const htmlTV = `
<!DOCTYPE html>
<html>
<head><title>TV AMPM</title></head>
<body style="margin:0; background:black; overflow:hidden; font-family:Arial; display:flex; flex-direction:column; height:100vh;">
    <div style="display:flex; flex:1; width:100%;">
        <div style="flex:3; background:#ccc; display:flex; align-items:center; justify-content:center; overflow:hidden;" id="bgEsq">
            <img id="imgDisplay" src="" style="width:100%; height:100%; object-fit:contain;">
        </div>
        <div style="flex:1; background:#003399; display:flex; flex-direction:column; align-items:center; justify-content:center; border-left:6px solid #FFCC00; text-align:center; color:white;" id="bgDir">
            <img src="logo.png" onerror="this.style.display='none'" style="width:160px; background:white; padding:15px; border-radius:15px; margin-bottom:30px;">
            <h1 id="nomeProd" style="font-size:2.2rem; padding:0 10px;">...</h1>
            <div style="background:white; padding:10px; border-radius:10px; margin-top:20px;">
                <img id="qr" src="qrcode.png" style="width:200px; display:block;" onerror="this.onerror=null; fetch('/qrcode').then(r=>r.text()).then(u=>this.src=u);">
            </div>
            <p style="margin-top:10px; font-weight:bold; font-size:1.2rem; color:#FFCC00;" id="txtScan">ESCANEIE PARA GANHAR</p>
            <div id="boxNum" style="margin-top:30px; border-top:2px dashed rgba(255,255,255,0.3); width:80%; padding-top:20px;">
                <span style="font-size:1.2rem;">RESTAM APENAS:</span><br>
                <span id="num" style="font-size:6rem; color:#FFCC00; font-weight:900;">--</span>
            </div>
        </div>
    </div>
    <div style="height:10vh; background:#111; border-top: 4px solid #F37021; display:flex; align-items:center; justify-content:space-around; color:#888; padding: 0 20px;">
        <span style="font-weight:bold;">PARCEIROS:</span>
        <h2 style="margin:0; color:white; font-style:italic;">Ipiranga</h2>
        <h2 style="margin:0; color:#FFCC00;">Abastece-aí</h2>
        <h2 style="margin:0; color:#0099ff;">Jet Oil</h2>
        <h2 style="margin:0; color:#F37021;">AMPM</h2>
    </div>
    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        const imgTag = document.getElementById('imgDisplay');
        socket.on('trocar_slide', (d) => { actualizarTela(d); });
        socket.on('atualizar_qtd', (d) => {
            if(document.getElementById('nomeProd').innerText === d.nome) {
                document.getElementById('num').innerText = d.qtd;
            }
        });
        function actualizarTela(d) {
            document.getElementById('nomeProd').innerText = d.nome;
            document.getElementById('num').innerText = d.qtd;
            document.getElementById('bgDir').style.background = d.corPrincipal;
            document.getElementById('bgEsq').style.background = d.corSecundaria;
            
            const corTexto = (d.corPrincipal === '#FFD700' || d.corPrincipal === '#FFCC00') ? '#003399' : 'white';
            document.getElementById('bgDir').style.color = corTexto;
            document.getElementById('num').style.color = (d.corPrincipal === '#FFD700') ? '#003399' : '#FFCC00';
            document.getElementById('txtScan').style.color = (d.corPrincipal === '#FFD700') ? '#003399' : '#FFCC00';

            imgTag.src = d.arquivo;
            if(d.ehSorteio) {
                document.getElementById('boxNum').style.display = 'none';
                document.getElementById('txtScan').innerText = "TENTE A SORTE!";
            } else {
                document.getElementById('boxNum').style.display = 'block';
                document.getElementById('txtScan').innerText = "GARANTA O SEU";
            }
        }
    </script>
</body>
</html>
`;

// --- HTML MOBILE ---
const htmlMobile = `
<!DOCTYPE html>
<html>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
    body { font-family: Arial, sans-serif; text-align:center; padding:20px; background:#f0f2f5; margin:0; }
    .btn-pegar { width:100%; padding:20px; color:white; border:none; border-radius:10px; font-size:20px; margin-top:20px; font-weight:bold; text-transform:uppercase; box-shadow: 0 4px 10px rgba(0,0,0,0.2); }
    .img-prod { width:100%; max-width:300px; border-radius:10px; margin-bottom:15px; }
    .ticket-paper { background: #fff; padding: 0; margin-top: 20px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); border-top: 10px solid #F37021; }
    .ticket-body { padding: 25px; }
    .codigo-texto { font-size: 32px; font-weight: bold; letter-spacing: 2px; font-family: monospace; color:#333; }
    .no-print { display: block; }
    @media print { .no-print { display:none; } body { background:white; } .ticket-paper { box-shadow:none; border:1px solid #ccc; } }
</style>
<body>
    <div id="telaPegar">
        <h3 style="color:#555;">OFERTA DO MOMENTO:</h3>
        <img id="fotoM" src="" class="img-prod">
        <h2 id="nomeM" style="color:#003399; margin:10px 0;">...</h2>
        <button onclick="resgatar()" id="btnResgatar" class="btn-pegar">RESGATAR CUPOM</button>
    </div>
    <div id="telaVoucher" style="display:none;">
        <h2 class="no-print" style="color:#003399;">SUCESSO! 🎉</h2>
        <div class="ticket-paper" id="ticketContainer">
            <div class="ticket-body">
                <img src="logo.png" width="100" style="margin-bottom:15px;" onerror="this.style.display='none'">
                <p>Voucher Promocional</p>
                <h1 id="voucherNome">...</h1>
                <div style="background:#f8f9fa; border:2px dashed #ccc; padding:15px; margin:20px 0;">
                    <div class="codigo-texto" id="codGerado">...</div>
                </div>
                <p>Gerado: <span id="dataHora"></span></p>
            </div>
        </div>
        <button onclick="window.print()" class="btn-pegar no-print" style="background:#333;">🖨️ IMPRIMIR</button>
    </div>
    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        let ofertaAtual = null;
        
        const hoje = new Date().toLocaleDateString('pt-BR');
        const salvo = localStorage.getItem('ampm_cupom_final');
        const dataSalva = localStorage.getItem('ampm_data_final');
        if (salvo && dataSalva === hoje) { mostrarVoucher(JSON.parse(salvo)); }

        socket.on('trocar_slide', (d) => {
            if (document.getElementById('telaVoucher').style.display === 'none') {
                ofertaAtual = d;
                document.getElementById('fotoM').src = d.arquivo;
                document.getElementById('nomeM').innerText = d.nome;
                const btn = document.getElementById('btnResgatar');
                btn.style.background = d.corPrincipal;
                
                if(d.ehSorteio) {
                     btn.style.color = '#003399';
                     btn.innerText = "TENTAR A SORTE (5%)";
                } else {
                     btn.style.color = 'white';
                     btn.innerText = "GARANTIR AGORA";
                }
            }
        });
        socket.emit('pedir_atualizacao');
        function resgatar() { if(ofertaAtual) socket.emit('resgatar_oferta', ofertaAtual.id); }
        socket.on('sucesso', (dados) => {
            const agora = new Date();
            dados.horaTexto = agora.toLocaleDateString('pt-BR') + ' ' + agora.toLocaleTimeString('pt-BR');
            localStorage.setItem('ampm_cupom_final', JSON.stringify(dados));
            localStorage.setItem('ampm_data_final', agora.toLocaleDateString('pt-BR'));
            mostrarVoucher(dados);
        });
        function mostrarVoucher(dados) {
            document.getElementById('telaPegar').style.display='none';
            document.getElementById('telaVoucher').style.display='block';
            document.getElementById('voucherNome').innerText = dados.produto;
            document.getElementById('codGerado').innerText = dados.codigo;
            document.getElementById('dataHora').innerText = dados.horaTexto;
            document.getElementById('ticketContainer').style.borderTopColor = dados.corPrincipal;
            if(dados.isGold) {
                document.body.style.backgroundColor = "#FFD700";
            }
        }
    </script>
</body>
</html>
`;

// --- ADMIN CORRIGIDO ---
const htmlAdmin = `
<!DOCTYPE html><html><meta name="viewport" content="width=device-width, initial-scale=1"><body style="font-family:Arial; padding:20px; background:#222; color:white;">
<h1>🎛️ Controle AMPM</h1>
<div id="status_msg">Carregando dados...</div>
<div id="paineis"></div>
<script src="/socket.io/socket.io.js"></script>
<script>
    const socket = io();
    
    // Assim que conecta, pede os dados
    socket.emit('pedir_atualizacao');

    socket.on('dados_admin', (lista) => {
        document.getElementById('status_msg').style.display = 'none';
        const div = document.getElementById('paineis');
        div.innerHTML = "";
        lista.forEach((c, index) => {
            let max = 0; let hora = 0;
            c.resgatesPorHora.forEach((q, h) => { if(q > max) { max = q; hora = h; } });
            const pico = max > 0 ? hora + ":00h (" + max + " un)" : "Sem dados";

            div.innerHTML += \`
            <div style="background:#444; padding:15px; margin-bottom:15px; border-radius:10px; border-left: 8px solid \${c.ativa?'#0f0':'#f00'}">
                <h3 style="margin-top:0;">\${c.nome}</h3>
                <div style="display:flex; gap:10px; align-items:center; background:#333; padding:10px; border-radius:5px; margin-bottom:10px;">
                    <label>Estoque:</label>
                    <input id="qtd_\${index}" type="number" value="\${c.qtd}" style="width:60px; font-weight:bold;">
                    <button onclick="salvar(\${index})" style="padding:5px 10px; background:#F37021; color:white; border:none; cursor:pointer;">💾 Salvar</button>
                </div>
                <div style="background:#222; padding:10px; border-radius:5px; font-size:14px; color:#ccc;">
                    <p style="margin:5px 0;">📈 <b>Total Resgatado:</b> <span style="color:#00ff00; font-size:18px;">\${c.totalResgates}</span></p>
                    <p style="margin:5px 0;">⏰ <b>Horário de Pico:</b> \${pico}</p>
                    <p style="margin:5px 0; border-top:1px solid #555; padding-top:5px;">
                       🔍 <b>Último:</b> <span style="color:yellow;">\${c.ultimoCupom}</span> <small>(\${c.ultimaHora})</small>
                    </p>
                </div>
            </div>\`;
        });
    });

    function salvar(id) {
        const q = document.getElementById('qtd_'+id).value;
        socket.emit('admin_update', { id: id, qtd: q });
        alert('Estoque atualizado!');
    }
</script>
</body></html>
`;

app.get('/tv', (req, res) => res.send(htmlTV));
app.get('/admin', (req, res) => res.send(htmlAdmin));
app.get('/mobile', (req, res) => res.send(htmlMobile));
app.get('/', (req, res) => res.redirect('/tv'));
app.get('/qrcode', (req, res) => { const url = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}/mobile`; QRCode.toDataURL(url, (e, s) => res.send(s)); });

io.on('connection', (socket) => {
    // Envia dados iniciais assim que conecta
    socket.emit('trocar_slide', campanhas[slideAtual]);
    socket.emit('dados_admin', campanhas);
    
    socket.on('pedir_atualizacao', () => { 
        socket.emit('trocar_slide', campanhas[slideAtual]); 
        socket.emit('dados_admin', campanhas);
    });
    
    socket.on('resgatar_oferta', (id) => {
        let camp = campanhas[id];
        if (camp && camp.qtd > 0) {
            camp.qtd--;
            camp.totalResgates++;
            
            const agora = new Date();
            const horaAtual = agora.getHours();
            if(horaAtual >= 0 && horaAtual <= 23) camp.resgatesPorHora[horaAtual]++;
            camp.ultimoCupom = gerarCodigo(camp.prefixo);
            camp.ultimaHora = agora.toLocaleTimeString('pt-BR');

            io.emit('atualizar_qtd', camp);
            if(slideAtual === id) io.emit('trocar_slide', camp);
            
            const sorte = Math.floor(Math.random() * 100) + 1;
            let cor1 = camp.corPrincipal; let cor2 = camp.corSecundaria; let nomeFinal = camp.nome; let isGold = false; let prefixo = camp.prefixo;

            if (camp.ehSorteio) {
                if (sorte > 95) { 
                    isGold = true; 
                    nomeFinal = "PARABÉNS! 50% OFF";
                } else {
                    cor1 = '#cccccc'; cor2 = '#333333'; 
                    nomeFinal = "Ganhou: 2% OFF"; 
                    prefixo = "DESC";
                }
            }

            socket.emit('sucesso', { 
                codigo: gerarCodigo(prefixo), 
                produto: nomeFinal, 
                corPrincipal: cor1, 
                corSecundaria: cor2, 
                isGold: isGold 
            });
            io.emit('dados_admin', campanhas);
        }
    });

    socket.on('admin_update', (d) => { 
        campanhas[d.id].qtd = parseInt(d.qtd); 
        campanhas[d.id].ativa = d.ativa;
        io.emit('dados_admin', campanhas); 
        if(slideAtual === d.id) io.emit('trocar_slide', campanhas[d.id]); 
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`AMPM rodando na porta ${PORT}`));
