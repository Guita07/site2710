#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>  // usado aqui só pra montar o JSON de telemetria

// ============================
// Rede e servidor
// ============================
const char* NOME_WIFI   = "Pereira";
const char* SENHA_WIFI  = "Gulupri3";

// ⚠️ Somente o HOST, sem "http://"
const char* SERVIDOR_WS = "site-tcc1.vercel.app";   // "meuservidor.com" ou IP
const uint16_t PORTA_WS = 8080;
const char* CAMINHO_WS  = "/?from=esp";

// ============================
// Telemetria (exemplo)
// ============================
const unsigned long INTERVALO_TELEMETRIA_MS = 1500;

// ============================
// Estado
// ============================
WebSocketsClient clienteWs;
unsigned long instanteUltimoEnvio = 0;

// ============================
// Eventos do WebSocket
// ============================
void aoReceberEventoWs(WStype_t tipo, uint8_t* dados, size_t tamanho) {
  switch (tipo) {
    case WStype_CONNECTED:
      Serial.println("[WS] Conectado");
      break;
    case WStype_DISCONNECTED:
      Serial.println("[WS] Desconectado");
      break;
    case WStype_TEXT:
      // 👉 Apenas imprime no Serial TUDO que chegar do frontend (texto ou JSON)
      Serial.printf("[WS] Mensagem do front: %.*s\n", (int)tamanho, dados);
      break;
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

  // Conecta ao servidor WebSocket (sem TLS)
  clienteWs.begin(SERVIDOR_WS, PORTA_WS, CAMINHO_WS);
  // Para produção com HTTPS (wss): clienteWs.beginSSL("SEU_DOMINIO", 443, "/?from=esp");

  clienteWs.onEvent(aoReceberEventoWs);
  clienteWs.setReconnectInterval(1500);
}

// ============================
// Loop
// ============================
void loop() {
  clienteWs.loop();

  // Exemplo: envia telemetria fake a cada 1,5s (pode remover se não quiser enviar nada)
  const unsigned long agora = millis();
  const bool deveEnviar = clienteWs.isConnected() &&
                          (agora - instanteUltimoEnvio > INTERVALO_TELEMETRIA_MS);

  if (deveEnviar) {
    instanteUltimoEnvio = agora;

    // Simula sensores
    const float temperatura = 24.7 + (random(-5, 6) * 0.1);
    const float umidade    = 58.0 + (random(-10, 11) * 0.1);

    // Monta JSON de telemetria
    StaticJsonDocument<192> doc;
    doc["temperatura"] = temperatura;
    doc["umidade"]     = umidade;
    doc["timestamp"]   = agora;

    // Serializa e envia
    char buffer[192];
    size_t n = serializeJson(doc, buffer, sizeof(buffer));
    clienteWs.sendTXT(buffer, n);
  }
}
