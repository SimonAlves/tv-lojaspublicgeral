const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(__dirname));
app.use(express.static('public'));

// --- CONFIGURAÇÃO AVANÇADA DE DADOS ---
let campanhas = [
    { 
        id: 0, 
        tipo: 'foto', 
        arquivo: "slide1.jpg", 
        nome: "Ração Premier", 
        qtd: 10, 
        ativa: true, 
        corPrincipal: '#0055aa', 
        corSecundaria: '#003366', 
        prefixo: 'PREMIER',
        // DADOS NOVOS:
        totalResgates: 0,
        resgatesPorHora: new Array(24).fill(0), // [0,0,0... até 23h]
        ultimoCupom: "Nenhum",
        ultimaHora: "--:--"
    },
    { 
        id: 1, 
        tipo: 'foto',
        arquivo: "slide2.jpg", 
        nome: "Special Dog",   
        qtd: 15, 
        ativa: true, 
        corPrincipal: '#007bff', 
        corSecundaria: '#ff6600', 
        prefixo: 'SPECIAL',
        totalResgates: 0,
        resgatesPorHora: new Array(24).fill(0),
        ultimoCupom: "Nenhum",
        ultimaHora: "--:--"
    },
    { 
        id: 2, 
        tipo: 'foto',
        arquivo: "slide3.jpg", 
        nome: "Adimax",        
        qtd: 20, 
        ativa: true, 
        corPrincipal: '#009933', 
        corSecundaria: '#004411', 
        prefixo: 'ADIMAX',
        totalResgates: 0,
        resgatesPorHora: new Array(24).fill(0),
        ultimoCupom: "Nenhum",
        ultimaHora: "--:--"
    },
    { 
        id: 3, 
        tipo: 'video', 
        arquivo: "nattu.mp4", 
        nome: "Premier Nattu",        
        qtd: 30, 
        ativa: true, 
        corPrincipal: '#6aa84f', 
        corSecundaria: '#ffffff', 
        prefixo: 'NATTU',
        totalResgates: 0,
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
}, 20000);

function gerarCodigo(prefixo) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 4; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return `${prefixo}-${result}`;
}

// --- FUNÇÃO PARA CALCULAR O PICO ---
function getHoraPico(arrayHoras) {
    let max = 0;
    let hora = 0;
    for(let i=0; i<24; i++) {
        if(arrayHoras[i] > max) {
            max = arrayHoras[i];
            hora = i;
        }
    }
    if (max === 0) return "Sem dados";
    return `${hora}:00h (${max} un)`;
}

const htmlTV = `
<!DOCTYPE html>
<html><head><title>TV</title></head><body style="margin:0; background:black; overflow:hidden; font-family:Arial; transition: background 0.5s;">
<div style="display:flex; height:100vh;">
<div style="flex:3; background:#ccc; display:flex; align-items:center; justify-content:center; overflow:hidden;" id="bgEsq"><img id="imgDisplay" src="" style="width:100%; height:100%; object-fit:contain; display:none;"><video id="vidDisplay" src="" style="width:100%; height:100%; object-fit:contain; display:none;" muted playsinline></video></div>
<div style="flex:1; background:#333; display:flex; flex-direction:column; align-items:center; justify-content:center; border-left:4px solid white; text-align:center; color:white;" id="bgDir">
<img src="logo.png" onerror="this.style.display='none'" style="width:150px; background:white; padding:10px; border-radius:10px; margin-bottom:20px; max-width:80%;">
<h1 id="nomeProd" style="font-size:2rem; padding:0 10px; height:80px; display:flex; align-items:center; justify-content:center;">...</h1>
<h2 style="color:#00ff00; font-weight:bold;">OFERTA RELÂMPAGO</h2>
<div style="background:white; padding:10px; border-radius:10px; margin-top:10px;"><img id="qr" src="qrcode.png" style="width:180px; display:block;" onerror="this.onerror=null; fetch('/qrcode').then(r=>r.text()).then(u=>this.src=u);"></div>
<p style="margin-top:10px; font-weight:bold;">ESCANEIE AGORA</p>
<div style="margin-top:20px; border-top:1px solid rgba(255,255,255,0.3); width:80%; padding-top:10px;"><span>RESTAM APENAS:</span><br><span id="num" style="font-size:5rem; color:#fff700; font-weight:bold; line-height:1;">--</span></div></div></div>
<script src="/socket.io/socket.io.js"></script><script>const socket=io();const imgTag=document.getElementById('imgDisplay');const vidTag=document.getElementById('vidDisplay');socket.on('trocar_slide',d=>{actualizarTela(d)});socket.on('atualizar_qtd',d=>{if(document.getElementById('nomeProd').innerText===d.nome){document.getElementById('num').innerText=d.qtd}});function actualizarTela(d){document.getElementById('nomeProd').innerText=d.nome;document.getElementById('num').innerText=d.qtd;document.getElementById('bgEsq').style.background=d.corSecundaria;document.getElementById('bgDir').style.background=d.corPrincipal;if(d.tipo==='video'){imgTag.style.display='none';vidTag.style.display='block';vidTag.src=d.arquivo;vidTag.play().catch(e=>console.log(e))}else{vidTag.pause();vidTag.style.display='none';imgTag.style.display='block';imgTag.src=d.arquivo}}</script></body></html>
`;

const htmlMobile = `
<!DOCTYPE html><html><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:Arial,sans-serif;text-align:center;padding:20px;background:#f4f4f4;transition:background 0.3s}.btn-pegar{width:100%;padding:20px;color:white;border:none;border-radius:50px;font-size:20px;margin-top:20px;font-weight:bold;transition:background 0.3s}.midia-prod{width:100%;max-width:300px;border-radius:10px;margin-bottom:10px;box-shadow:0 4px 8px rgba(0,0,0,0.1)}.ticket-white{background:white;padding:20px;border-radius:15px;margin-top:20px;box-shadow:0 10px 25px rgba(0,0,0,0.1);position:relative;overflow:hidden}.ticket-header-bar{height:15px;position:absolute;top:0;left:0;width:100%}.codigo-box{background:#f9f9f9;border:2px dashed #ccc;padding:15px;margin:20px 0;border-radius:8px}.codigo-texto{font-size:28px;font-weight:bold;letter-spacing:1px;font-family:monospace}.no-print{display:block}@media print{.no-print{display:none}body{background:white;padding:0}.ticket-white{box-shadow:none;border:2px solid black}}</style><body><div id="telaPegar"><h3 style="color:#555;margin-bottom:10px">OFERTA DO MOMENTO:</h3><img id="fotoM" src="" class="midia-prod" style="display:none;"><video id="vidM" src="" class="midia-prod" style="display:none;" muted playsinline autoplay loop></video><h2 id="nomeM" style="color:#333;margin:10px 0">...</h2><button onclick="resgatar()" id="btnResgatar" class="btn-pegar" style="background:#333">GARANTIR AGORA</button><p style="font-size:12px;color:gray;margin-top:10px">Restam: <strong id="qtdM">--</strong> unidades</p></div><div id="telaVoucher" style="display:none;"><h2 id="tituloParabens" class="no-print" style="color:#333">PARABÉNS!</h2><div class="ticket-white" id="ticketContainer"><div class="ticket-header-bar" id="ticketBar"></div><h3 style="margin-top:15px">VALE OFERTA</h3><h1 id="voucherNome" style="font-size:24px;margin:10px 0">...</h1><p style="color:gray">Polipet Oficial</p><div class="codigo-box" id="codBox"><p style="font-size:12px;margin:0;color:gray">CÓDIGO DE VALIDAÇÃO:</p><div class="codigo-texto" id="codGerado">...</div></div><p style="font-size:12px;color:gray">Gerado em: <span id="dataHora" style="font-weight:bold;color:#333"></span><br>Válido hoje.</p></div><button onclick="window.print()" class="btn-pegar no-print" style="background:#333;margin-top:30px">🖨️ IMPRIMIR VOUCHER</button></div><script src="/socket.io/socket.io.js"></script><script>const socket=io();let ofertaAtual=null;socket.on('trocar_slide',d=>{ofertaAtual=d;const imgTag=document.getElementById('fotoM');const vidTag=document.getElementById('vidM');if(d.tipo==='video'){imgTag.style.display='none';vidTag.style.display='block';vidTag.src=d.arquivo}else{vidTag.style.display='none';imgTag.style.display='block';imgTag.src=d.arquivo}document.getElementById('nomeM').innerText=d.nome;document.getElementById('qtdM').innerText=d.qtd;document.getElementById('btnResgatar').style.background=d.corPrincipal});socket.emit('pedir_atualizacao');function resgatar(){if(ofertaAtual)socket.emit('resgatar_oferta',ofertaAtual.id)}socket.on('sucesso',dados=>{document.getElementById('telaPegar').style.display='none';document.getElementById('telaVoucher').style.display='block';document.getElementById('voucherNome').innerText=dados.produto;document.getElementById('codGerado').innerText=dados.codigo;const agora=new Date();document.getElementById('dataHora').innerText=agora.toLocaleDateString('pt-BR')+' às '+agora.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});aplicarCoresVoucher(dados.corPrincipal,dados.corSecundaria)});function aplicarCoresVoucher(cor1,cor2){document.getElementById('tituloParabens').style.color=cor1;document.getElementById('ticketBar').style.background=\`linear-gradient(to right, \${cor1}, \${cor2})\`;document.getElementById('voucherNome').style.color=cor1;document.getElementById('codBox').style.borderColor=cor1;document.getElementById('codGerado').style.color=cor1;document.body.style.backgroundColor=cor2+'22'}</script></body></html>
`;

// --- ADMIN (COM RELATÓRIO INTELIGENTE) ---
const htmlAdmin = `
<!DOCTYPE html><html><meta name="viewport" content="width=device-width, initial-scale=1"><body style="font-family:Arial; padding:20px; background:#222; color:white;">
<h1>🎛️ Painel de Controle & Inteligência</h1>
<div id="paineis"></div>
<script src="/socket.io/socket.io.js"></script>
<script>
    const socket = io();
    socket.on('dados_admin', (lista) => {
        const div = document.getElementById('paineis');
        div.innerHTML = "";
        lista.forEach((c, index) => {
            // Lógica para achar o pico
            let pico = "Sem dados";
            let max = 0;
            c.resgatesPorHora.forEach((qtd, hora) => {
                if(qtd > max) { max = qtd; pico = hora + ":00h (" + qtd + " un)"; }
            });

            div.innerHTML += \`
            <div style="background:#444; padding:15px; margin-bottom:15px; border-radius:10px; border-left: 8px solid \${c.ativa?'#0f0':'#f00'}">
                <h3 style="margin-top:0;">\${index+1}. \${c.nome}</h3>
                
                <div style="display:flex; gap:10px; align-items:center; background:#333; padding:10px; border-radius:5px; margin-bottom:10px;">
                    <label>Estoque:</label>
                    <input id="qtd_\${index}" type="number" value="\${c.qtd}" style="width:60px; font-weight:bold;">
                    <button onclick="salvar(\${index})" style="padding:5px 10px; background:#00cc00; color:white; border:none; cursor:pointer;">💾 Salvar</button>
                </div>

                <div style="background:#222; padding:10px; border-radius:5px; font-size:14px; color:#ccc;">
                    <p style="margin:5px 0;">📈 <b>Total Resgatado:</b> <span style="color:#00ff00; font-size:18px;">\${c.totalResgates}</span></p>
                    <p style="margin:5px 0;">⏰ <b>Horário de Pico:</b> \${pico}</p>
                    <p style="margin:5px 0; border-top:1px solid #555; padding-top:5px;">
                       🔍 <b>Último Cupom:</b> <br>
                       <span style="color:yellow;">\${c.ultimoCupom}</span> <small>(\${c.ultimaHora})</small>
                    </p>
                </div>
            </div>\`;
        });
    });
    function salvar(id){
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

// --- LÓGICA DO SERVIDOR COM BANCO DE DADOS ---
io.on('connection', (socket) => {
    socket.emit('trocar_slide', campanhas[slideAtual]);
    socket.emit('dados_admin', campanhas);
    socket.on('pedir_atualizacao', () => { socket.emit('trocar_slide', campanhas[slideAtual]); });
    
    socket.on('resgatar_oferta', (id) => {
        let camp = campanhas[id];
        if (camp && camp.qtd > 0) {
            camp.qtd--;
            
            // --- COLETA DE DADOS (DATA INTELLIGENCE) ---
            camp.totalResgates++; 
            const agora = new Date();
            // Ajuste fuso horário simples (-3h Brasil)
            agora.setHours(agora.getHours() - 3); 
            const horaAtual = agora.getHours();
            
            // Grava no array de horas (0 a 23)
            if(horaAtual >= 0 && horaAtual <= 23) {
                camp.resgatesPorHora[horaAtual]++;
            }

            const cod = gerarCodigo(camp.prefixo);
            camp.ultimoCupom = cod;
            camp.ultimaHora = agora.toLocaleTimeString('pt-BR');

            // ------------------------------------------

            io.emit('atualizar_qtd', camp);
            if(slideAtual === id) io.emit('trocar_slide', camp);
            
            // SORTEIO CUPOM DOURADO (Lógica mantida)
            const sorte = Math.floor(Math.random() * 100) + 1;
            let cor1 = camp.corPrincipal;
            let cor2 = camp.corSecundaria;
            let nomeFinal = camp.nome;

            if (sorte > 90) { 
                cor1 = '#FFD700'; 
                cor2 = '#B8860B';
                nomeFinal = `🌟 ${camp.nome} (SUPER OFERTA)`;
            }

            socket.emit('sucesso', { 
                codigo: cod, 
                produto: nomeFinal,
                corPrincipal: cor1,
                corSecundaria: cor2
            });
            
            io.emit('dados_admin', campanhas);
        }
    });

    socket.on('admin_update', (d) => { 
        campanhas[d.id].qtd = parseInt(d.qtd); 
        io.emit('dados_admin', campanhas); 
        if(slideAtual === d.id) io.emit('trocar_slide', campanhas[d.id]); 
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Rodando'));
