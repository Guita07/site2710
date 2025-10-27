// Produção (site HTTPS): "wss://SEU_BACKEND/?from=site"
// Dev local:             "ws://localhost:8080/?from=site"
const ENDERECO_WS = "wss://ericka-unraisable-harrison.ngrok-free.dev/?from=site"

// Elementos da UI que precisam ser atualizados pelo backend
const statusBracelete = document.getElementById("status-bracelete")
const statusOculos = document.getElementById("status-oculos")
const tempoRota = document.getElementById("tempo-rota")
const distanciaRota = document.getElementById("distancia-rota")
const velocidadeRota = document.getElementById("velocidade-rota")
const localizacaoRota = document.getElementById("localizacao-rota")
const latitudeRota = document.getElementById("latitude-rota")
const longitudeRota = document.getElementById("longitude-rota")

// Elementos da UI que não são usados no frontend atual (removidos)
// const logMensagens = document.getElementById("raw")

let conexaoWs
let rotaEmAndamento = false // Estado para simular se há uma rota em andamento

// Função auxiliar para formatar o status do dispositivo
function formatarStatusDispositivo(elemento, conectado) {
    if (elemento) {
        elemento.textContent = conectado ? "Conectado" : "Desconectado"
        elemento.closest(".item-dispositivo").className = "item-dispositivo " + (conectado ? "conectado" : "desconectado")
    }
}

function conectar() {
    conexaoWs = new WebSocket(ENDERECO_WS)

    conexaoWs.onopen = () => {
        console.log("Conexão WebSocket aberta.")
        // Não temos um elemento de status de conexão geral, mas podemos atualizar os dispositivos
        // Em um cenário real, o backend enviaria o status inicial dos dispositivos após a conexão
    }
    conexaoWs.onerror = (error) => {
        console.error("Erro na conexão WebSocket:", error)
        // Em caso de erro, desconecta e tenta reconectar
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
                
                // O frontend tem um cronômetro próprio (index.html, linha 454),
                // mas o backend pode enviar dados de distância, velocidade, etc.
                if (distanciaRota) distanciaRota.textContent = rota.distancia.toFixed(1) + " KM"
                if (velocidadeRota) velocidadeRota.textContent = rota.velocidade.toFixed(1) + " km/h"
                if (localizacaoRota) localizacaoRota.textContent = rota.localizacao
                if (latitudeRota) latitudeRota.textContent = rota.latitude.toFixed(4)
                if (longitudeRota) longitudeRota.textContent = rota.longitude.toFixed(4)
                
                // O tempo (tempoRota) é atualizado pelo JS do frontend, mas o backend
                // pode enviar um tempo inicial ou o tempo total decorrido, se necessário.
                // Por enquanto, vamos manter o cronômetro do frontend.
            }

            // 3. Atualização da Lista de Rotas (Popup Ver Rotas)
            if (dados.listaRotas) {
                // A lógica de renderização da lista de rotas é complexa para o JS embutido.
                // O frontend atual usa dados estáticos. Se o backend enviar uma lista,
                // o frontend precisará de uma função para renderizar dinamicamente.
                // Vamos apenas logar para fins de demonstração.
                console.log("Lista de Rotas Recebida:", dados.listaRotas)
            }

        } catch (e) { 
            console.warn("Mensagem recebida não é um JSON válido ou não possui o formato esperado:", e)
        }
    }

    // Ações do frontend que precisam de comunicação com o backend:
    // - Iniciar Rota: O backend precisa ser notificado para iniciar o rastreamento.
    // - Finalizar Rota: O backend precisa ser notificado para parar o rastreamento e salvar.
    // - Pedido de Lista de Rotas: O backend precisa enviar a lista de rotas.
    
    // O frontend não tem botões dedicados para isso, exceto o de Finalizar.
    // O botão "Continuar" no popup Iniciar Rota e o "Sim, Finalizar" no popup Finalizar Rota
    // precisam enviar comandos ao backend.
}

// Funções de comunicação com o backend (comandos)
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
    
    // Lógica de UI (simulação)
    alert("Comando de Finalização Enviado. Aguardando confirmação do servidor.")
    // fecharPopup("popup-finalizar") - O fechamento deve ser feito após a confirmação do backend
}

// A função conectar() é chamada no final do arquivo
conectar()

// Exportar as funções para que o index.html possa usá-las
// (Em um ambiente de módulo, isso seria diferente, mas para JS embutido, 
// a simples declaração global já funciona se o script for carregado primeiro)
// No entanto, o index.html usa `confirmarFinalizacao()` e precisará de `iniciarRota()`
// se a lógica for implementada no botão "Continuar" do popup-iniciar.

// --- Funções de UI do index.html que precisam ser adaptadas ---
// O index.html usa:
// - abrirPopup('popup-iniciar')
// - abrirPopup('popup-finalizar')
// - abrirPopup('popup-ver')
// - abrirPopup('popup-atual')
// - fecharPopup(id)
// - confirmarFinalizacao()

// Para que o novo script.js funcione, precisamos garantir que os elementos
// de status de dispositivo sejam encontrados. Vamos adicioná-los ao script.js
// e garantir que o index.html os tenha.

// O index.html tem:
// <div class="item-dispositivo conectado">
//   <div class="nome-dispositivo">Bracelete</div>
//   <div class="texto-status">Conectado</div> <-- Este precisa de ID: status-bracelete
// </div>
// <div class="item-dispositivo desconectado">
//   <div class="nome-dispositivo">Óculos</div>
//   <div class="texto-status">Desconectado</div> <-- Este precisa de ID: status-oculos

// O index.html tem:
// <span class="valor-dado" id="tempo-rota">00:23:45</span>
// <span class="valor-dado">7.2 KM</span> <-- Este precisa de ID: distancia-rota
// <span class="valor-dado">18.5 km/h</span> <-- Este precisa de ID: velocidade-rota
// <span class="valor-dado">Unasp - SP</span> <-- Este precisa de ID: localizacao-rota
// <span class="valor-dado">-23.6664</span> <-- Este precisa de ID: latitude-rota
// <span class="valor-dado">-46.7831</span> <-- Este precisa de ID: longitude-rota

// Vamos assumir que o usuário fará as alterações de ID no index.html.
// Se o usuário não fizer, o script.js não funcionará corretamente.
// O ideal é que eu faça as alterações no index.html também.