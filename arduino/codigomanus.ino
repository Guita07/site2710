#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

// ============================
// Rede e servidor
// ============================
// ATENÇÃO: Substitua pelas suas credenciais de Wi-Fi
const char* NOME_WIFI   = "Pereira";
const char* SENHA_WIFI  = "Gulupri3";

// ATENÇÃO: Substitua pelo endereço do seu backend Vercel
// O Vercel usa o protocolo WSS (WebSocket Secure) na porta 443
const char* SERVIDOR_WS = "site-backend-iota.vercel.app";
const uint16_t PORTA_WS = 443;
const char* CAMINHO_WS  = "/?from=esp";

// ============================
// Telemetria (Rota e Sensores)
// ============================
const unsigned long INTERVALO_TELEMETRIA_MS = 1500;

// ============================
// Estado
// ============================
WebSocketsClient clienteWs;
unsigned long instanteUltimoEnvio = 0;
bool rotaEmAndamento = false;

// Simulação de dados de rota (ajustar para dados reais do seu projeto)
float distancia = 0.0;
float velocidade = 0.0;
float latitude = -23.6664;
float longitude = -46.7831;
const char* localizacao = "Unasp - SP";

// Simulação de status dos dispositivos
bool braceleteConectado = true;
bool oculosConectado = false;

// Simulação de telemetria adicional (Temperatura e Umidade)
float temperatura = 25.0;
float umidade = 60.0;

// ============================
// Funções de Comunicação
// ============================

void enviarTelemetria() {
  if (!clienteWs.isConnected()) return;

  StaticJsonDocument<256> doc;
  
  // Status dos dispositivos
  doc["bracelete"] = braceleteConectado;
  doc["oculos"] = oculosConectado;
  
  // Dados da rota
  doc["distancia"] = distancia;
  doc["velocidade"] = velocidade;
  doc["localizacao"] = localizacao;
  doc["latitude"] = latitude;
  doc["longitude"] = longitude;
  
  // Dados de telemetria adicional
  doc["temperatura"] = temperatura;
  doc["umidade"] = umidade;

  // Serializa e envia
  char buffer[256];
  size_t n = serializeJson(doc, buffer, sizeof(buffer));
  clienteWs.sendTXT(buffer, n);
}

void simularDados() {
  temperatura = 24.0 + (random(-5, 6) * 0.1);
  umidade = 55.0 + (random(-10, 11) * 0.1);
  
  if (rotaEmAndamento) {
    distancia += 0.05; // 50 metros a cada 1.5s
    velocidade = 15.0 + (random(-20, 21) / 10.0); // Velocidade entre 13 e 17 km/h
    latitude += (random(-1, 2) / 10000.0);
    longitude += (random(-1, 2) / 10000.0);
  } else {
    velocidade = 0.0;
  }
}

// ============================
// Eventos do WebSocket
// ============================
void aoReceberEventoWs(WStype_t tipo, uint8_t* dados, size_t tamanho) {
  switch (tipo) {
    case WStype_CONNECTED:
      Serial.println("[WS] Conectado");
      enviarTelemetria(); 
      break;

    case WStype_DISCONNECTED:
      Serial.println("[WS] Desconectado");
      break;

    case WStype_TEXT: {
      Serial.printf("[WS] Mensagem do front: %.*s\n", (int)tamanho, dados);
      
      StaticJsonDocument<128> doc;
      DeserializationError erro = deserializeJson(doc, (const char*)dados);
      
      if (!erro) {
        const char* acao = doc["acao"];
        if (acao) {
          if (strcmp(acao, "iniciar_rota") == 0) {
            rotaEmAndamento = true;
            distancia = 0.0;
            Serial.println("[AÇÃO] Rota Iniciada");
          } else if (strcmp(acao, "finalizar_rota") == 0) {
            rotaEmAndamento = false;
            Serial.println("[AÇÃO] Rota Finalizada");
          }
        }
      }
      break;
    }

    default:
      break;
  }
}

// ============================
// Setup
// ============================
void setup() {
  Serial.begin(115200);

  // Conecta ao Wi-Fi
  WiFi.begin(NOME_WIFI, SENHA_WIFI);
  Serial.print("Conectando ao Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\nIP: %s\n", WiFi.localIP().toString().c_str());

  // Conecta ao servidor WebSocket (com TLS/SSL para Vercel)
  clienteWs.beginSSL(SERVIDOR_WS, PORTA_WS, CAMINHO_WS);
  clienteWs.onEvent(aoReceberEventoWs);
  clienteWs.setReconnectInterval(1500);
}

// ============================
// Loop
// ============================
void loop() {
  clienteWs.loop();

  const unsigned long agora = millis();
  const bool deveEnviar = clienteWs.isConnected() &&
                          (agora - instanteUltimoEnvio > INTERVALO_TELEMETRIA_MS);

  if (deveEnviar) {
    instanteUltimoEnvio = agora;
    simularDados();
    enviarTelemetria();
  }
}
