import express from "express"
import http from "http"
import { WebSocketServer } from "ws"

const PORT = process.env.PORT || 8080
const CROSS_ONLY = true // esp -> site e site -> esp

const app = express()

const server = http.createServer(app)
const wss = new WebSocketServer({ server }) // WS compartilhando a mesma porta do Express

// ====================================================================
// ESTADO GLOBAL DA APLICAÇÃO
// ====================================================================

let rotaEmAndamento = false

// Simulação de dados de telemetria (serão atualizados pelo Arduino)
let dadosRota = {
    distancia: 0.0,
    velocidade: 0.0,
    localizacao: "Aguardando GPS...",
    latitude: 0.0,
    longitude: 0.0
}

// Simulação de status dos dispositivos
let statusDispositivos = {
    bracelete: false,
    oculos: false
}

// Simulação de lista de rotas (dados estáticos para o popup "Ver Rotas")
const listaRotasEstatica = [
    { titulo: "Rota da Manhã", detalhes: "12.5 KM • 45 min • Hoje 08:15" },
    { titulo: "Passeio no Parque", detalhes: "8.2 KM • 28 min • Ontem 14:20" },
    { titulo: "Treino Noturno", detalhes: "15.8 KM • 52 min • 2 dias atrás" },
    { titulo: "Caminhada Leve", detalhes: "6.7 KM • 22 min • 3 dias atrás" }
]

// ====================================================================
// FUNÇÕES DE COMUNICAÇÃO
// ====================================================================

// Função para enviar o estado atual da rota e dispositivos para o frontend
function broadcastEstadoRota() {
    const estado = {
        dispositivos: statusDispositivos,
        rotaAtual: {
            emAndamento: rotaEmAndamento,
            ...dadosRota
        },
        listaRotas: listaRotasEstatica // O frontend não renderiza dinamicamente, mas enviamos
    }
    const mensagem = JSON.stringify(estado)
    
    // Envia para todos os clientes "site"
    wss.clients.forEach(client => {
        if (client.readyState === client.OPEN && client.role === "site") {
            client.send(mensagem)
        }
    })
    console.log("[WS] Broadcast de Estado para o Frontend.")
}

// Função para enviar comandos ao Arduino
function enviarComandoArduino(comando) {
    const mensagem = JSON.stringify(comando)
    
    // Envia para todos os clientes "esp"
    wss.clients.forEach(client => {
        if (client.readyState === client.OPEN && client.role === "esp") {
            client.send(mensagem)
        }
    })
    console.log(`[WS] Comando para Arduino: ${mensagem}`)
}

// ====================================================================
// PROCESSAMENTO DE MENSAGENS
// ====================================================================

wss.on("connection", (ws, req) => {
    let role = "unknown"
    try {
        const url = new URL(req.url, "http://local")
        const from = (url.searchParams.get("from") || "").toLowerCase()
        if (from === "esp" || from === "site") role = from
    } catch { }
    ws.role = role

    console.log(`[WS] conectado: ${ws.role} de ${req.socket.remoteAddress}`)

    // Envia o estado inicial para o novo cliente "site"
    if (ws.role === "site") {
        broadcastEstadoRota()
    }

    ws.on("message", (msg, isBinary) => {
        const texto = isBinary
            ? msg.toString("utf8")
            : (typeof msg === "string" ? msg : msg.toString("utf8"))
        
        // ----------------------------------------------------------------
        // LÓGICA DE PROCESSAMENTO DO BACKEND
        // ----------------------------------------------------------------
        try {
            const dados = JSON.parse(texto)

            if (ws.role === "site") {
                // Mensagem do Frontend (Comando)
                if (dados.acao === "iniciar_rota") {
                    rotaEmAndamento = true
                    enviarComandoArduino({ acao: "iniciar_rota" })
                    broadcastEstadoRota()
                } else if (dados.acao === "finalizar_rota") {
                    rotaEmAndamento = false
                    enviarComandoArduino({ acao: "finalizar_rota" })
                    broadcastEstadoRota()
                    // Em um cenário real, salvaríamos a rota aqui
                }
            } else if (ws.role === "esp") {
                // Mensagem do Arduino (Telemetria)
                
                // 1. Atualização de Status dos Dispositivos
                if (typeof dados.bracelete === "boolean") statusDispositivos.bracelete = dados.bracelete
                if (typeof dados.oculos === "boolean") statusDispositivos.oculos = dados.oculos
                
                // 2. Atualização de Dados da Rota
                if (dados.distancia !== undefined) dadosRota.distancia = dados.distancia
                if (dados.velocidade !== undefined) dadosRota.velocidade = dados.velocidade
                if (dados.localizacao !== undefined) dadosRota.localizacao = dados.localizacao
                if (dados.latitude !== undefined) dadosRota.latitude = dados.latitude
                if (dados.longitude !== undefined) dadosRota.longitude = dados.longitude
                
                // Após receber dados do Arduino, envia o estado atualizado para o frontend
                broadcastEstadoRota()
            }

        } catch (e) {
            // Se não for JSON, ou se for um JSON que não processamos,
            // apenas repassamos para o outro lado (comportamento original)
            console.log(`[WS] Repassando mensagem não processada: ${texto}`)
            wss.clients.forEach(client => {
                if (client === ws || client.readyState !== client.OPEN) return;
                if (CROSS_ONLY) {
                    if (ws.role === "esp" && client.role === "site") {
                        client.send(texto)
                    }
                    else if (ws.role === "site" && client.role === "esp") {
                        client.send(texto)
                    }
                } else {
                    client.send(texto)
                }
            })
        }
        // ----------------------------------------------------------------
    });

    ws.on("close", () => console.log(`[WS] fechado: ${ws.role}`))
});

server.listen(PORT, () => {
    console.log(`HTTP on :${PORT} | WS on :${PORT}`)
});

