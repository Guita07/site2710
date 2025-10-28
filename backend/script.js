// Produção (site HTTPS): "wss://SEU_BACKEND/?from=site"
// Dev local:             "ws://localhost:8080/?from=site"
// ATENÇÃO: Substitua pelo endereço do seu backend Vercel
const ENDERECO_WS = "wss://site-backend-iota.vercel.app/?from=site"

// Elementos da UI que precisam ser atualizados pelo backend
const statusBracelete = document.getElementById("status-bracelete")
const statusOculos = document.getElementById("status-oculos")
const tempoRota = document.getElementById("tempo-rota")
const distanciaRota = document.getElementById("distancia-rota")
const velocidadeRota = document.getElementById("velocidade-rota")
const localizacaoRota = document.getElementById("localizacao-rota")
const latitudeRota = document.getElementById("latitude-rota")
const longitudeRota = document.getElementById("longitude-rota")

// Variáveis de estado
let conexaoWs
let rotaEmAndamento = false
let cronometroInterval
let segundosDecorridos = 0

// ====================================================================
// FUNÇÕES DE UI
// ====================================================================

function formatarStatusDispositivo(elemento, conectado) {
    if (elemento) {
        elemento.textContent = conectado ? "Conectado" : "Desconectado"
        elemento.closest(".item-dispositivo").className = "item-dispositivo " + (conectado ? "conectado" : "desconectado")
    }
}

function iniciarCronometro() {
    if (cronometroInterval) return
    segundosDecorridos = 0 // Reinicia o cronômetro ao iniciar a rota

    cronometroInterval = setInterval(() => {
        segundosDecorridos++
        const h = Math.floor(segundosDecorridos / 3600)
        const m = Math.floor((segundosDecorridos % 3600) / 60)
        const s = segundosDecorridos % 60

        const tempoFormatado = [h, m, s]
            .map((v) => String(v).padStart(2, "0"))
            .join(":")

        if (tempoRota) {
            tempoRota.textContent = tempoFormatado
        }
    }, 1000)
}

function pararCronometro() {
    clearInterval(cronometroInterval)
    cronometroInterval = null
}

function abrirPopup(id) {
    const popup = document.getElementById(id)
    if (!popup) return

    popup.style.display = "flex"
    if (id === "popup-atual") {
        iniciarCronometro()
    }
}

function fecharPopup(id) {
    const popup = document.getElementById(id)
    if (!popup) return

    popup.style.display = "none"
    if (id === "popup-atual") {
        pararCronometro()
    }
}

// Listeners de evento para fechar popups (movidos do index.html)
document.addEventListener("click", (evento) => {
    if (evento.target.classList.contains("fundo-escuro-popup")) {
        fecharPopup(evento.target.id)
    }
})

document.querySelectorAll(".janela-popup").forEach((popup) => {
    popup.addEventListener("click", (evento) => evento.stopPropagation())
})

// ====================================================================
// COMUNICAÇÃO COM BACKEND
// ====================================================================

function enviarComando(comando) {
    if (!conexaoWs || conexaoWs.readyState !== WebSocket.OPEN) {
        console.warn("Conexão WebSocket não está aberta. Comando não enviado:", comando)
        return
    }
    const mensagem = JSON.stringify(comando)
    conexaoWs.send(mensagem)
    console.log("Comando enviado:", mensagem)
}

// Funções chamadas pelo frontend (index.html)
function iniciarRota() {
    // Comando para o backend iniciar o rastreamento
    enviarComando({ acao: "iniciar_rota" })
}

function confirmarFinalizacao() {
    // Comando para o backend finalizar o rastreamento e salvar
    enviarComando({ acao: "finalizar_rota" })
    
    // Lógica de UI (feedback imediato)
    alert("Comando de Finalização Enviado. Aguardando confirmação do servidor.")
    fecharPopup("popup-finalizar") // Fecha o popup após enviar o comando
}


function conectar() {
    conexaoWs = new WebSocket(ENDERECO_WS)

    conexaoWs.onopen = () => {
        console.log("Conexão WebSocket aberta.")
    }
    conexaoWs.onerror = (error) => {
        console.error("Erro na conexão WebSocket:", error)
    }
    conexaoWs.onclose = () => { 
        console.log("Conexão WebSocket fechada. Tentando reconectar em 1.2s...")
        setTimeout(conectar, 1200) 
    }

    conexaoWs.onmessage = (evento) => {
        console.log("Mensagem recebida:", evento.data)
        try {
            const dados = JSON.parse(evento.data)
            
            // 1. Atualização de Status dos Dispositivos (Popup Iniciar Rota)
            if (dados.dispositivos) {
                formatarStatusDispositivo(statusBracelete, dados.dispositivos.bracelete)
                formatarStatusDispositivo(statusOculos, dados.dispositivos.oculos)
            }

            // 2. Atualização de Dados da Rota Atual (Popup Rota Atual)
            if (dados.rotaAtual) {
                const rota = dados.rotaAtual
                rotaEmAndamento = rota.emAndamento
                
                if (distanciaRota) distanciaRota.textContent = rota.distancia.toFixed(1) + " KM"
                if (velocidadeRota) velocidadeRota.textContent = rota.velocidade.toFixed(1) + " km/h"
                if (localizacaoRota) localizacaoRota.textContent = rota.localizacao
                if (latitudeRota) latitudeRota.textContent = rota.latitude.toFixed(4)
                if (longitudeRota) longitudeRota.textContent = rota.longitude.toFixed(4)
                
                // Telemetria adicional (Temperatura e Umidade) - Apenas log
                if (rota.temperatura !== undefined) console.log(`Temperatura: ${rota.temperatura.toFixed(1)} °C`)
                if (rota.umidade !== undefined) console.log(`Umidade: ${rota.umidade.toFixed(1)} %`)
            }

            // 3. Atualização da Lista de Rotas (Popup Ver Rotas)
            if (dados.listaRotas) {
                console.log("Lista de Rotas Recebida:", dados.listaRotas)
            }

        } catch (e) { 
            console.warn("Mensagem recebida não é um JSON válido ou não possui o formato esperado:", e)
        }
    }
}

// A função conectar() é chamada no final do arquivo
conectar()

