const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(__dirname));
app.use(express.static('public'));

// --- BANCO DE DADOS (HISTÓRICO) ---
let historicoVendas = []; 

// --- CONFIGURAÇÃO DAS CAMPANHAS POLIPET ---
let campanhas = [
    // 0. CUPOM DOURADO (Apenas 1 Unidade - 50%)
    { 
        id: 0, 
        tipo: 'foto', 
        arquivo: "cupomdasorte.jpg", 
        nome: "CUPOM DOURADO 50%", 
        qtd: 1, // APENAS 1 UNIDADE!
        ativa: true, 
        corPrincipal: '#FFD700', // Dourado
        corSecundaria: '#000000', // Preto
        prefixo: 'GOLD',
        ehSorteio: false, // Não é sorteio, é quem pegar primeiro leva!
        totalResgates: 0,
        resgatesPorHora: new Array(24).fill(0),
        ultimoCupom: "Nenhum",
        ultimaHora: "--:--"
    },
    // 1. PREMIER (Normal - 10%)
    { 
        id: 1, 
        tipo: 'foto', 
        arquivo: "slide1.jpg", 
        nome: "Ração Premier - 10% OFF", 
        qtd: 20, 
        ativa: true, 
        corPrincipal: '#e60000', // Vermelho
        corSecundaria: '#990000', 
        prefixo: 'PREMIER',
        ehSorteio: false,
        totalResgates: 0,
        resgatesPorHora: new Array(24).fill(0),
        ultimoCupom: "Nenhum",
        ultimaHora: "--:--"
    },
    // 2. SPECIAL DOG
    { 
        id: 2, 
        tipo: 'foto', 
        arquivo: "slide2.jpg", 
        nome: "Special Dog",   
        qtd: 15, 
        ativa: true, 
        corPrincipal: '#0055aa', // Azul
        corSecundaria: '#003366', 
        prefixo: 'SPECIAL',
        ehSorteio: false,
        totalResgates: 0,
        resgatesPorHora: new Array(24).fill(0),
        ultimoCupom: "Nenhum",
        ultimaHora: "--:--"
    },
    // 3. ADIMAX
    { 
        id: 3, 
        tipo: 'foto', 
        arquivo: "slide3.jpg", 
        nome: "Adimax",        
        qtd: 20, 
        ativa: true, 
        corPrincipal: '#009933', // Verde
        corSecundaria: '#004411', 
        prefixo: 'ADIMAX',
        ehSorteio: false,
        totalResgates: 0,
        resgatesPorHora: new Array(24).fill(0),
        ultimoCupom: "Nenhum",
        ultimaHora: "--:--"
    },
    // 4. NATTU (Vídeo)
    { 
        id: 4, 
        tipo: 'video', 
        arquivo: "nattu.mp4", 
        nome: "Premier Nattu",        
        qtd: 30, 
        ativa: true, 
        corPrincipal: '#6aa84f', // Verde Claro
        corSecundaria: '#ffffff', 
        prefixo: 'NATTU',
        ehSorteio: false,
        totalResgates: 0,
        resgatesPorHora: new Array(24).fill(0),
        ultimoCupom: "Nenhum",
        ultimaHora: "--:--"
    }
];

let slideAtual = 0;

// Rotação (15s)
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

// --- DOWNLOAD DO RELATÓRIO (BANCO DE DADOS) ---
app.get('/baixar-relatorio', (req, res) => {
    let csv = "\uFEFFDATA,HORA,PRODUTO,CODIGO\n";
    historicoVendas.forEach(h => {
        csv += `${h.data},${h.hora},${h.produto},${h.codigo}\n`;
    });
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.attachment(`relatorio_polipet_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`);
    res.send(csv);
});

// --- HTML TV ---
const htmlTV = `
<!DOCTYPE html><html><head><title>TV Polipet</title></head><body style="margin:0; background:black; overflow:hidden; font-family:Arial; display:flex; flex-direction:column; height:100vh;"><div style="display:flex; flex:1; width:100%; transition: background 0.5s;"><div style="flex:3; background:#ccc; display:flex; align-items:center; justify-content:center; overflow:hidden;" id="bgEsq"><img id="imgDisplay" src="" style="width:100%; height:100%; object-fit:contain; display:none;"><video id="vidDisplay" src="" style="width:100%; height:100%; object-fit:contain; display:none;" muted playsinline></video></div><div style="flex:1; background:#ce0000; display:flex; flex-direction:column; align-items:center; justify-content:center; border-left:6px solid white; text-align:center; color:white;" id="bgDir"><img src="logo.png" onerror="this.style.display='none'" style="width:160px; background:white; padding:15px; border-radius:15px; margin-bottom:30px; box-shadow: 0 5px 15px rgba(0,0,0,0.3);"><h1 id="nomeProd" style="font-size:2.2rem; padding:0 10px; line-height:1.1; text-transform:uppercase; font-weight:800;">...</h1><div style="background:white; padding:10px; border-radius:10px; margin-top:20px;"><img id="qr" src="qrcode.png" style="width:200px; display:block;" onerror="this.onerror=null; fetch('/qrcode').then(r=>r.text()).then(u=>this.src=u);"></div><p style="margin-top:10px; font-weight:bold; font-size:1.2rem; color:#FFF;" id="txtScan">ESCANEIE AGORA</p><div id="boxNum" style="margin-top:30px; border-top:2px dashed rgba(255,255,255,0.3); width:80%; padding-top:20px;"><span style="font-size:1rem;">RESTAM APENAS:</span><br><span id="num" style="font-size:6rem; color:#fff; font-weight:900; line-height:1;">--</span></div></div></div><div style="height:10vh; background:#111; border-top: 4px solid #e60000; display:flex; align-items:center; justify-content:space-around; color:#888; padding: 0 20px;"><span style="font-weight:bold;">PARCEIROS:</span><h2 style="margin:0; color:white; font-style:italic;">PremieR</h2><h2 style="margin:0; color:#007bff;">Special Dog</h2><h2 style="margin:0; color:#009933;">Adimax</h2><h2 style="margin:0; color:#e60000;">Polipet</h2></div><script src="/socket.io/socket.io.js"></script><script>const socket=io();const imgTag=document.getElementById('imgDisplay');const vidTag=document.getElementById('vidDisplay');socket.on('trocar_slide',d=>{actualizarTela(d)});socket.on('atualizar_qtd',d=>{if(document.getElementById('nomeProd').innerText===d.nome){document.getElementById('num').innerText=d.qtd}});function actualizarTela(d){document.getElementById('nomeProd').innerText=d.nome;document.getElementById('num').innerText=d.qtd;document.getElementById('bgDir').style.background=d.corPrincipal;document.getElementById('bgEsq').style.background=d.corSecundaria;if(d.qtd<=0){document.getElementById('txtScan').innerText="ESGOTADO!";document.getElementById('num').style.color='red'}else{document.getElementById('txtScan').innerText="GARANTA O SEU";document.getElementById('num').style.color='white'}if(d.tipo==='video'){imgTag.style.display='none';vidTag.style.display='block';vidTag.src=d.arquivo;vidTag.play().catch(e=>console.log(e))}else{vidTag.pause();vidTag.style.display='none';imgTag.style.display='block';imgTag.src=d.arquivo}}</script></body></html>
`;

// --- HTML MOBILE (DIRETO PARA O VOUCHER) ---
const htmlMobile = `
<!DOCTYPE html><html><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:Arial,sans-serif;text-align:center;padding:20px;background:#f4f4f4;margin:0;transition:background 0.3s}.btn-pegar{width:100%;padding:20px;color:white;border:none;border-radius:10px;font-size:20px;margin-top:20px;font-weight:bold;box-shadow:0 4px 10px rgba(0,0,0,0.2)}.ticket-white{background:white;padding:20px;border-radius:15px;margin-top:20px;box-shadow:0 10px 25px rgba(0,0,0,0.1);position:relative;overflow:hidden}.codigo-texto{font-size:28px;font-weight:bold;letter-spacing:1px;font-family:monospace;color:#e60000}.no-print{display:block}@media print{.no-print{display:none}body{background:white}.ticket-white{box-shadow:none;border:2px solid black}}</style><body>
<div id="telaPegar">
    <h2 style="color:#555;">Carregando Oferta...</h2>
    <div class="loader"></div>
</div>
<div id="telaVoucher" style="display:none">
    <h2 id="tituloParabens" class="no-print" style="color:#e60000">PARABÉNS! 🎉</h2>
    <div class="ticket-white" id="ticketContainer">
        <img src="logo.png" width="100" style="margin-bottom:15px" onerror="this.style.display='none'">
        <h2 id="voucherNome" style="margin:5px 0">...</h2>
        <div style="background:#f9f9f9;border:2px dashed #ccc;padding:15px;margin:20px 0">
            <div class="codigo-texto" id="codGerado">...</div>
        </div>
        <p style="font-size:12px;color:gray">Gerado em: <span id="dataHora" style="font-weight:bold"></span></p>
    </div>
    <button onclick="window.print()" class="btn-pegar no-print" style="background:#333;margin-top:30px">🖨️ IMPRIMIR</button>
</div>
<script src="/socket.io/socket.io.js"></script><script>const socket=io();let ofertaAtual=null;const hoje=new Date().toLocaleDateString('pt-BR');const salvo=localStorage.getItem('polipet_cupom_final_v2');const dataSalva=localStorage.getItem('polipet_data_final_v2');
if(salvo&&dataSalva===hoje){mostrarVoucher(JSON.parse(salvo))}
socket.on('trocar_slide',d=>{
    // Tenta pegar automaticamente se ainda não pegou
    if(document.getElementById('telaVoucher').style.display==='none'){
        ofertaAtual=d;
        // Simula clique automático
        setTimeout(() => { socket.emit('resgatar_oferta', ofertaAtual.id); }, 500);
    }
});
socket.emit('pedir_atualizacao');
socket.on('sucesso',dados=>{
    const agora=new Date();
    dados.horaTexto=agora.toLocaleDateString('pt-BR')+' '+agora.toLocaleTimeString('pt-BR');
    localStorage.setItem('polipet_cupom_final_v2',JSON.stringify(dados));
    localStorage.setItem('polipet_data_final_v2',agora.toLocaleDateString('pt-BR'));
    mostrarVoucher(dados);
});
function mostrarVoucher(dados){
    document.getElementById('telaPegar').style.display='none';
    document.getElementById('telaVoucher').style.display='block';
    document.getElementById('voucherNome').innerText=dados.produto;
    document.getElementById('codGerado').innerText=dados.codigo;
    document.getElementById('dataHora').innerText=dados.horaTexto;
    document.getElementById('ticketContainer').style.borderTopColor=dados.corPrincipal;
    if(dados.isGold){document.body.style.backgroundColor="#FFD700";document.getElementById('tituloParabens').innerText="🌟 CUPOM DOURADO! 🌟"}
}
</script></body></html>`;

// --- ADMIN (COM DOWNLOAD) ---
const htmlAdmin = `
<!DOCTYPE html><html><meta name="viewport" content="width=device-width, initial-scale=1"><body style="font-family:Arial; padding:20px; background:#222; color:white;">
<h1>🎛️ Painel Polipet</h1>
<div style="margin-bottom: 20px; padding: 15px; background: #333; border-radius: 10px; border: 1px solid #555;">
    <h3>📊 Banco de Dados</h3>
    <a href="/baixar-relatorio" target="_blank"><button style="padding:10px 20px; background:#009933; color:white; border:none; font-weight:bold; cursor:pointer;">📥 BAIXAR EXCEL</button></a>
</div>
<div id="paineis"></div>
<script src="/socket.io/socket.io.js"></script><script>const socket=io();socket.on('dados_admin',(lista)=>{const div=document.getElementById('paineis');div.innerHTML="";lista.forEach((c,index)=>{div.innerHTML+=\`<div style="background:#444; padding:15px; margin-bottom:15px; border-radius:10px; border-left: 8px solid \${c.ativa?'#0f0':'#f00'}"><h3>\${c.nome}</h3><label>Estoque:</label> <input id="qtd_\${index}" type="number" value="\${c.qtd}" style="width:60px;"><button onclick="salvar(\${index})">Salvar</button><br><span>📈 Resgates: <b>\${c.totalResgates}</b></span></div>\`})});function salvar(id){const q=document.getElementById('qtd_'+id).value;socket.emit('admin_update',{id:id,qtd:q});alert('Ok!')}</script></body></html>
`;

// --- ROTAS ---
app.get('/tv', (req, res) => res.send(htmlTV));
app.get('/admin', (req, res) => res.send(htmlAdmin));
app.get('/mobile', (req, res) => res.send(htmlMobile));
app.get('/', (req, res) => res.redirect('/tv'));
app.get('/qrcode', (req, res) => { const url = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}/mobile`; QRCode.toDataURL(url, (e, s) => res.send(s)); });

// --- LÓGICA SERVIDOR ---
io.on('connection', (socket) => {
    socket.emit('trocar_slide', campanhas[slideAtual]);
    socket.emit('dados_admin', campanhas);
    socket.on('pedir_atualizacao', () => { socket.emit('trocar_slide', campanhas[slideAtual]); });
    
    socket.on('resgatar_oferta', (id) => {
        let camp = campanhas[id];
        if (camp && camp.qtd > 0) {
            camp.qtd--;
            camp.totalResgates++;
            const agora = new Date();
            const hora = agora.getHours();
            if(hora >=0 && hora <=23) camp.resgatesPorHora[hora]++;
            
            camp.ultimoCupom = gerarCodigo(camp.prefixo);
            camp.ultimaHora = agora.toLocaleTimeString('pt-BR');

            // Salva no Banco de Dados
            historicoVendas.push({
                data: agora.toLocaleDateString('pt-BR'),
                hora: camp.ultimaHora,
                produto: camp.nome,
                codigo: camp.ultimoCupom
            });

            io.emit('atualizar_qtd', camp);
            if(slideAtual === id) io.emit('trocar_slide', camp);
            
            // Checa se é o Cupom Dourado
            let isGold = false;
            if(camp.prefixo === 'GOLD') isGold = true;

            socket.emit('sucesso', { codigo: camp.ultimoCupom, produto: camp.nome, corPrincipal: camp.corPrincipal, isGold: isGold });
            io.emit('dados_admin', campanhas);
        }
    });
    socket.on('admin_update', (d) => { campanhas[d.id].qtd = parseInt(d.qtd); io.emit('dados_admin', campanhas); if(slideAtual === d.id) io.emit('trocar_slide', campanhas[d.id]); });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Polipet rodando na porta ${PORT}`));
