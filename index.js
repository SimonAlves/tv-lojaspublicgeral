const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(__dirname));
app.use(express.static('public'));

// --- CONFIGURAÇÃO POLIPET (TURBINADA) ---
let campanhas = [
    // SLIDE 0: Ração Premier (Vermelho)
    { 
        id: 0, 
        tipo: 'foto', 
        arquivo: "slide1.jpg", 
        nome: "Ração Premier", 
        qtd: 10, 
        ativa: true, 
        corPrincipal: '#e60000', // Vermelho Polipet
        corSecundaria: '#990000', 
        prefixo: 'PREMIER',
        totalResgates: 0,
        resgatesPorHora: new Array(24).fill(0),
        ultimoCupom: "Nenhum",
        ultimaHora: "--:--"
    },
    // SLIDE 1: Special Dog (Azul)
    { 
        id: 1, 
        tipo: 'foto', 
        arquivo: "slide2.jpg", 
        nome: "Special Dog",   
        qtd: 15, 
        ativa: true, 
        corPrincipal: '#0055aa', // Azul
        corSecundaria: '#003366', 
        prefixo: 'SPECIAL',
        totalResgates: 0,
        resgatesPorHora: new Array(24).fill(0),
        ultimoCupom: "Nenhum",
        ultimaHora: "--:--"
    },
    // SLIDE 2: Adimax (Verde)
    { 
        id: 2, 
        tipo: 'foto', 
        arquivo: "slide3.jpg", 
        nome: "Adimax",        
        qtd: 20, 
        ativa: true, 
        corPrincipal: '#009933', // Verde
        corSecundaria: '#004411', 
        prefixo: 'ADIMAX',
        totalResgates: 0,
        resgatesPorHora: new Array(24).fill(0),
        ultimoCupom: "Nenhum",
        ultimaHora: "--:--"
    },
    // SLIDE 3: Premier Nattu (Vídeo)
    { 
        id: 3, 
        tipo: 'video', 
        arquivo: "nattu.mp4", 
        nome: "Premier Nattu",        
        qtd: 30, 
        ativa: true, 
        corPrincipal: '#6aa84f', // Verde Claro
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
}, 20000); // 20 segundos

function gerarCodigo(prefixo) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 4; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return `${prefixo}-${result}`;
}

// --- HTML DA TV (COM RODAPÉ PREMIER E SPECIAL DOG) ---
const htmlTV = `
<!DOCTYPE html>
<html>
<head><title>TV Polipet</title></head>
<body style="margin:0; background:black; overflow:hidden; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display:flex; flex-direction:column; height:100vh;">
    
    <div style="display:flex; flex:1; width:100%; transition: background 0.5s;">
        <div style="flex:3; background:#ccc; display:flex; align-items:center; justify-content:center; overflow:hidden;" id="bgEsq">
            <img id="imgDisplay" src="" style="width:100%; height:100%; object-fit:contain; display:none;">
            <video id="vidDisplay" src="" style="width:100%; height:100%; object-fit:contain; display:none;" muted playsinline></video>
        </div>
        <div style="flex:1; background:#333; display:flex; flex-direction:column; align-items:center; justify-content:center; border-left:6px solid white; text-align:center; color:white;" id="bgDir">
            <img src="logo.png" onerror="this.style.display='none'" style="width:150px; background:white; padding:15px; border-radius:15px; margin-bottom:20px; box-shadow: 0 5px 15px rgba(0,0,0,0.3);">
            <h1 id="nomeProd" style="font-size:2rem; padding:0 10px; height:80px; display:flex; align-items:center; justify-content:center;">...</h1>
            <h2 style="color:#fff; font-weight:bold;">OFERTA RELÂMPAGO</h2>
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

    <div style="height:10vh; background:#111; border-top: 4px solid #e60000; display:flex; align-items:center; justify-content:space-around; color:#888; padding: 0 20px;">
        <span style="font-weight:bold; letter-spacing:1px; font-size: 1rem;">PARCEIROS:</span>
        
        <h2 style="margin:0; color:white; font-style:italic; font-weight:900;">PremieR<span style="color:#e60000;">pet</span></h2>
        <h2 style="margin:0; color:#00aaff; font-weight:bold;">Special Dog</h2>
        <h2 style="margin:0; color:#e60000; font-weight:bold;">Polipet</h2>
    
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
            document.getElementById('bgEsq').style.background = d.corSecundaria;
            document.getElementById('bgDir').style.background = d.corPrincipal;
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

// --- HTML MOBILE (COM TRAVA DE SEGURANÇA 1 POR DIA) ---
const htmlMobile = `
<!DOCTYPE html>
<html>
