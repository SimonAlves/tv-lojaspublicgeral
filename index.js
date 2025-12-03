const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(__dirname));
app.use(express.static('public'));

// --- CONFIGURAÇÃO 100% POLIPET ---
let campanhas = [
    // SLIDE 0: PREMIER (VERMELHO - SORTEIO)
    { 
        id: 0, 
        tipo: 'foto', 
        arquivo: "slide1.jpg", 
        nome: "Sorteio Premier", 
        qtd: 5, // Estoque do prêmio dourado
        totalResgates: 0,
        ativa: true, 
        corPrincipal: '#e60000', // Vermelho Polipet
        corSecundaria: '#990000', 
        prefixo: 'PREMIER',
        ehSorteio: true // Ativa a chance de ganhar 50%
    },
    // SLIDE 1: SPECIAL DOG (AZUL - GARANTIDO)
    { 
        id: 1, 
        tipo: 'foto', 
        arquivo: "slide2.jpg", 
        nome: "Special Dog",   
        qtd: 50, 
        totalResgates: 0,
        ativa: true, 
        corPrincipal: '#0055aa', // Azul
        corSecundaria: '#003366', 
        prefixo: 'SPECIAL',
        ehSorteio: false
    },
    // SLIDE 2: ADIMAX (VERDE - GARANTIDO)
    { 
        id: 2, 
        tipo: 'foto', 
        arquivo: "slide3.jpg", 
        nome: "Adimax",        
        qtd: 50, 
        totalResgates: 0,
        ativa: true, 
        corPrincipal: '#009933', // Verde
        corSecundaria: '#004411', 
        prefixo: 'ADIMAX',
        ehSorteio: false
    },
    // SLIDE 3: PREMIER NATTU (VÍDEO)
    { 
        id: 3, 
        tipo: 'video', 
        arquivo: "nattu.mp4", // Certifique-se que este arquivo existe
        nome: "Premier Nattu",        
        qtd: 30, 
        totalResgates: 0,
        ativa: true, 
        corPrincipal: '#6aa84f', // Verde Claro Nattu
        corSecundaria: '#ffffff', 
        prefixo: 'NATTU',
        ehSorteio: false
    }
];

let slideAtual = 0;

// Rotação a cada 15 segundos
setInterval(() => {
    slideAtual++;
    if (slideAtual >= campanhas.length) slideAtual = 0;
    io.emit('trocar_slide', campanhas[slideAtual]);
}, 15000);

function gerarCodigo(prefixo) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 4; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return `${prefixo}-${result}`;
}

// --- HTML TV (LAYOUT POLIPET) ---
const htmlTV = `
<!DOCTYPE html>
<html>
<head><title>TV Polipet</title></head>
<body style="margin:0; background:black; overflow:hidden; font-family:Arial; display:flex; flex-direction:column; height:100vh;">
    
    <div style="display:flex; flex:1; width:100%; transition: background 0.5s;">
        <div style="flex:3; background:#ccc; display:flex; align-items:center; justify-content:center; overflow:hidden;" id="bgEsq">
            <img id="imgDisplay" src="" style="width:100%; height:100%; object-fit:contain; display:none;">
            <video id="vidDisplay" src="" style="width:100%; height:100%; object-fit:contain; display:none;" muted playsinline></video>
        </div>
        
        <div style="flex:1; background:#ce0000; display:flex; flex-direction:column; align-items:center; justify-content:center; border-left:6px solid white; text-align:center; color:white;" id="bgDir">
            <img src="logo.png" onerror="this.style.display='none'" style="width:160px; background:white; padding:15px; border-radius:15px; margin-bottom:30px; box-shadow: 0 5px 15px rgba(0,0,0,0.3);">
            
            <h1 id="nomeProd" style="font-size:2.2rem; padding:0 10px; line-height:1.1; text-transform:uppercase; font-weight:800;">...</h1>
            
            <div style="background:white; padding:10px; border-radius:10px; margin-top:20px;">
                <img id="qr" src="qrcode.png" style="width:200px; display:block;" 
                     onerror="this.onerror=null; fetch('/qrcode').then(r=>r.text()).then(u=>this.src=u);">
            </div>
            
            <p style="margin-top:10px; font-weight:bold; font-size:1.2rem; color:#FFF;" id="txtScan">ESCANEIE AGORA</p>
            
            <div id="boxNum" style="margin-top:30px; border-top:2px dashed rgba(255,255,255,0.3); width:80%; padding-top:20px;">
                <span style="font-size:1rem;">RESTAM APENAS:</span><br>
                <span id="num" style="font-size:6rem; color:#fff; font-weight:900; line-height:1;">--</span>
            </div>
        </div>
    </div>

    <div style="height:10vh; background:#111; border-top: 4px solid #e60000; display:flex; align-items:center; justify-content:space-around; color:#888; padding: 0 20px;">
        <span style="font-weight:bold;">PARCEIROS:</span>
        <h2 style="margin:0; color:white; font-style:italic;">PremieR</h2>
        <h2 style="margin:0; color:#007bff;">Special Dog</h2>
        <h2 style="margin:0; color:#009933;">Adimax</h2>
        <h2 style="margin:0; color:#e60000;">Polipet</h2>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        const imgTag = document.getElementById('imgDisplay');
        const vidTag = document.getElementById('vidDisplay');
        
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
            
            // Lógica do Sorteio (Esconde estoque)
            if(d.ehSorteio) {
                document.getElementById('boxNum').style.display = 'none';
                document.getElementById('txtScan').innerText = "TENTE A SORTE!";
            } else {
                document.getElementById('boxNum').style.display = 'block';
                document.getElementById('txtScan').innerText = "GARANTA O SEU";
            }

            if (d.tipo === 'video') {
                imgTag.style.display = 'none'; vidTag.style.display = 'block'; vidTag.src = d.arquivo; vidTag.play().catch(e => console.log(e));
            } else {
                vidTag.pause(); vidTag.style.display = 'none'; imgTag.style.display = 'block'; imgTag.src = d.arquivo;
            }
        }
    </script>
</body>
</html>
`;

// --- HTML MOBILE (TRAVA 1 CUPOM/DIA) ---
const htmlMobile = `
<!DOCTYPE html>
<html>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
    body { font-family: Arial, sans-serif; text-align:center; padding:20px; background:#f4f4f4; margin:0; transition: background 0.3s; }
    .btn-pegar { width:100%; padding:20px; color:white; border:none; border-radius:10px; font-size:20px; margin-top:20px; font-weight:bold; text-transform:uppercase; box-shadow: 0 4px 10px rgba(0,0,0,0.2); }
    .img-prod { width:100%; max-width:300px; border-radius:10px; margin-bottom:15px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    .ticket-paper { background: #fff; padding: 0; margin-top: 20px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); position: relative; overflow: hidden; border-top: 10px solid #e60000; }
    .ticket-body { padding: 25px; text-align: center; }
    .codigo-texto { font-size: 32px; font-weight: bold; letter-spacing: 2px; margin:0; font-family: monospace; color:#333; }
    .no-print { display: block; }
    @media print { .no-print { display:none; } body { background:white; } .ticket-paper { box-shadow:none; border:1px solid #ccc; } }
</style>
<body>
    <div id="telaPegar">
        <h3 style="color:#555;">OFERTA DO MOMENTO:</h3>
        <img id="fotoM" src="" class="midia-prod" style="display:none;">
        <video id="vidM" src="" class="midia-prod" style="display:none;" muted playsinline autoplay loop></video>
        <h2 id="nomeM" style="color:#333; margin:10px 0;">...</h2>
        <button onclick="resgatar()" id="btnResgatar" class="btn-pegar" style="background:#e60000;">GARANTIR AGORA</button>
        <p style="font-size:12px; color:gray; margin-top:10px;">Restam: <strong id="qtdM">--</strong> unidades</p>
    </div>

    <div id="telaVoucher" style="display:none;">
        <h2 class="no-print" id="msgSucesso" style="color:#e60000;">PARABÉNS! 🎉</h2>
        <div class="ticket-paper" id="ticketContainer">
            <div class="ticket-body">
                <img src="logo.png" width="100" style="margin-bottom:15px;" onerror="this.style.display='none'">
                <p style="font-size:14px; color:#666;">VOUCHER POLIPET</p>
                <h1 id="voucherNome" style="font-size:24px; margin:5px 0; color:#333;">...</h1>
                <div style="background:#f8f9fa; border:2px dashed #ccc; padding:15px; margin:20px 0;">
                    <div class="codigo-texto" id="codGerado">...</div>
                </div>
                <p style="font-size:12px; color:#555;">Gerado em: <span id="dataHora" style="font-weight:bold;"></span></p>
                <p style="font-size:12px; font-weight:bold; color:red;">Válido apenas hoje.</p>
            </div>
        </div>
        <button onclick="window.print()" class="btn-pegar no-print" style="background:#333; margin-top:30px;">🖨️ IMPRIMIR</button>
        <p class="no-print" style="font-size:12px; color:gray; margin-top:20px;">⚠️ Você já pegou seu cupom de hoje.</p>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        let ofertaAtual = null;
        
        // TRAVA DE SEGURANÇA (1 POR DIA)
        const hoje = new Date().toLocaleDateString('pt-BR');
        const salvo = localStorage.getItem('polipet_cupom_v2');
        const dataSalva = localStorage.getItem('polipet_data_v2');
        
        // Se já pegou hoje, mostra direto o voucher e esconde o botão de pegar
        if (salvo && dataSalva === hoje) { mostrarVoucher(JSON.parse(salvo)); }

        socket.on('trocar_slide', (d) => {
            // Só atualiza a tela se a pessoa AINDA NÃO pegou cupom
            if (document.getElementById('telaVoucher').style.display === 'none') {
                ofertaAtual = d;
                const imgTag = document.getElementById('fotoM'); const vidTag = document.getElementById('vidM');
                
                if (d.tipo === 'video') { 
                    imgTag.style.display = 'none'; vidTag.style.display = 'block'; vidTag.src = d.arquivo; 
                } else { 
                    vidTag.style.display = 'none'; imgTag.style.display = 'block'; imgTag.src = d.arquivo; 
                }
                
                document.getElementById('nomeM').innerText = d.nome;
                document.getElementById('qtdM').innerText = d.qtd;
                document.getElementById('btnResgatar').style.background = d.corPrincipal;
                
                if(d.ehSorteio) {
                     document.getElementById('btnResgatar').innerText = "TENTAR A SORTE (10%)";
                } else {
                     document.getElementById('btnResgatar').innerText = "GARANTIR AGORA";
                }
            }
        });
        
        socket.emit('pedir_atualizacao');
        
        function resgatar() { if(ofertaAtual) socket.emit('resgatar_oferta', ofertaAtual.id); }
        
        socket.on('sucesso', (dados) => {
            const agora = new Date();
            dados.horaTexto = agora.toLocaleDateString('pt-BR') + ' às ' + agora.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
            
            // Salva no celular
            localStorage.setItem('polipet_cupom_v2', JSON.stringify(dados));
            localStorage.setItem('polipet_data_v2', agora.toLocaleDateString('pt-BR'));
            
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
                document.getElementById('msgSucesso').innerText = "🌟 SORTE GRANDE! 🌟";
                document.getElementById('voucherNome').innerHTML = "🌟 " + dados.produto + " 🌟";
            }
        }
    </script>
</body>
</html>
`;

// --- ADMIN ---
const htmlAdmin = `
<!DOCTYPE html><html><meta name="viewport" content="width=device-width, initial-scale=1"><body style="font-family:Arial; padding:20px; background:#222; color:white;"><h1>Painel Polipet</h1><div id="paineis"></div><script src="/socket.io/socket.io.js"></script><script>const socket=io();socket.on('dados_admin',(lista)=>{const div=document.getElementById('paineis');div.innerHTML="";lista.forEach((c,index)=>{let max=0;let hora=0;c.resgatesPorHora.forEach((q,h)=>{if(q>max){max=q;hora=h}});const pico=max>0?hora+":00h ("+max+" un)":"Sem dados";div.innerHTML+=\`<div style="background:#444; padding:15px; margin-bottom:15px; border-radius:10px; border-left: 8px solid \${c.ativa?'#0f0':'#f00'}"><h3 style="margin-top:0;">\${c.nome}</h3><div style="display:flex; gap:10px;"><label>Estoque:</label><input id="qtd_\${index}" type="number" value="\${c.qtd}" style="width:60px;"><button onclick="salvar(\${index})">Salvar</button></div><br><span>📈 Já Pegaram: <b>\${c.totalResgates}</b></span><br><small>Pico: \${pico}</small></div>\`})});function salvar(id){const q=document.getElementById('qtd_'+id).value;socket.emit('admin_update',{id:id,qtd:q});alert('Ok!')}</script></body></html>
`;

// --- ROTAS ---
app.get('/tv', (req, res) => res.send(htmlTV));
app.get('/admin', (req, res) => res.send(htmlAdmin));
app.get('/mobile', (req, res) => res.send(htmlMobile));
app.get('/', (req, res) => res.redirect('/tv'));
app.get('/qrcode', (req, res) => { const url = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}/mobile`; QRCode.toDataURL(url, (e, s) => res.send(s)); });

// --- SERVIDOR E SORTEIO ---
io.on('connection', (socket) => {
    socket.emit('trocar_slide', campanhas[slideAtual]);
    socket.emit('dados_admin', campanhas);
    socket.on('pedir_atualizacao', () => { socket.emit('trocar_slide', campanhas[slideAtual]); });
    
    socket.on('resgatar_oferta', (id) => {
        let camp = campanhas[id];
        if (camp && camp.qtd > 0) {
            camp.qtd--;
            
            // DADOS
            camp.totalResgates++;
            const agora = new Date();
            const hora = agora.getHours();
            if(hora >=0 && hora <=23) camp.resgatesPorHora[hora]++;
            camp.ultimoCupom = gerarCodigo(camp.prefixo);
            camp.ultimaHora = agora.toLocaleTimeString('pt-BR');

            io.emit('atualizar_qtd', camp);
            if(slideAtual === id) io.emit('trocar_slide', camp);
            
            // SORTEIO DA PREMIER (10% de chance)
            let cor1 = camp.corPrincipal; let cor2 = camp.corSecundaria; let nomeFinal = camp.nome; let isGold = false; let prefixo = camp.prefixo;
            if (camp.ehSorteio) {
                const sorte = Math.floor(Math.random() * 100) + 1;
                if (sorte > 90) { 
                    isGold = true; nomeFinal = "PARABÉNS! 50% OFF"; cor1='#FFD700'; prefixo="GOLD";
                } else {
                    nomeFinal = "Ganhou: 5% OFF"; 
                }
            }

            socket.emit('sucesso', { codigo: gerarCodigo(prefixo), produto: nomeFinal, corPrincipal: cor1, corSecundaria: cor2, isGold: isGold });
            io.emit('dados_admin', campanhas);
        }
    });
    socket.on('admin_update', (d) => { campanhas[d.id].qtd = parseInt(d.qtd); io.emit('dados_admin', campanhas); if(slideAtual === d.id) io.emit('trocar_slide', campanhas[d.id]); });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Polipet rodando na porta ${PORT}`));
