// index.js

// 1. Importar as bibliotecas necessárias
const express = require('express');
const axios = require('axios');
const cors = require('cors');

// IMPORTAÇÕES ADICIONAIS DO FIREBASE para consultar o banco de dados
const { initializeApp } = require("firebase/app");
const { getFirestore, doc, getDoc } = require("firebase/firestore");

// 2. CONFIGURAÇÃO DO FIREBASE
// As mesmas credenciais do seu arquivo HTML.
const firebaseConfig = {
    apiKey: "AIzaSyCmn-3gBSIC4olvZShWAsx6cLt6acLfCRM",
    authDomain: "growth-pharmacy.firebaseapp.com",
    projectId: "growth-pharmacy",
    storageBucket: "growth-pharmacy.appspot.com",
    messagingSenderId: "775598551801",
    appId: "SEU_APP_ID_AQUI" // Cole o seu App ID aqui
};

// Inicializar os serviços do Firebase na API
const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);

// 3. Inicializar a aplicação Express
const app = express();

// 4. Adicionar middlewares
app.use(cors()); 
app.use(express.json());

// 5. Definir constantes
const PORT = 3000;
const N8N_WEBHOOK_URL = 'https://n8n.growthopsbrazil.com.br/webhook/6555dd6f-5437-46eb-ab55-5c0366a5b89d';

// Constantes para ajudar a encontrar os dados no Firestore
const firestoreAppIdIdentifier = 'growth-pharmacy-local-login-data';
const localUserIdForFirestore = "admin-local-user";

// 6. Criar a rota (endpoint) principal da nossa API
app.post('/api/dados', async (req, res) => {
  // Usamos 'let' para que o objeto possa ser modificado
  let dadosRecebidos = req.body;

  console.log('Dados recebidos da aplicação:', JSON.stringify(dadosRecebidos, null, 2));

  // =========================================================================
  //  INÍCIO DA NOVA LÓGICA: ENRIQUECER OS DADOS DO PEDIDO
  // =========================================================================
  // Se for um novo pedido, busca o nome do cliente e da fórmula no Firebase
  if (dadosRecebidos.type === 'new_orders' && dadosRecebidos.data && dadosRecebidos.data.customerId) {
      try {
          console.log('Enriquecendo dados do pedido...');
          const customerId = dadosRecebidos.data.customerId;
          const customerRef = doc(db, `artifacts/${firestoreAppIdIdentifier}/users/${localUserIdForFirestore}/customers`, customerId);
          const customerSnap = await getDoc(customerRef);

          if (customerSnap.exists()) {
              const customerName = customerSnap.data().name;
              // Adiciona o nome do cliente aos dados que serão enviados ao n8n
              dadosRecebidos.data.customerName = customerName;
              console.log(`Nome do cliente encontrado: ${customerName}`);
          } else {
              console.log(`Cliente com ID ${customerId} não encontrado.`);
              dadosRecebidos.data.customerName = 'Cliente não encontrado';
          }
          
          // Lógica bónus: buscar o nome da fórmula também
          if (dadosRecebidos.data.formulaId) {
             const formulaId = dadosRecebidos.data.formulaId;
             const formulaRef = doc(db, `artifacts/${firestoreAppIdIdentifier}/users/${localUserIdForFirestore}/formulas`, formulaId);
             const formulaSnap = await getDoc(formulaRef);
             if (formulaSnap.exists()) {
                 dadosRecebidos.data.formulaName = formulaSnap.data().name;
                 console.log(`Nome da fórmula encontrado: ${formulaSnap.data().name}`);
             } else {
                 dadosRecebidos.data.formulaName = 'Fórmula não encontrada';
             }
          }

      } catch (dbError) {
          console.error("Erro ao buscar dados no Firebase:", dbError);
          // O processo continua mesmo se der erro aqui, para não parar o webhook.
      }
  }
  // =========================================================================
  //  FIM DA NOVA LÓGICA
  // =========================================================================


  // 7. Tentar redirecionar os dados (agora enriquecidos) para o webhook do n8n
  try {
    console.log(`Enviando dados (enriquecidos) para o webhook: ${N8N_WEBHOOK_URL}`);
    const respostaWebhook = await axios.post(N8N_WEBHOOK_URL, dadosRecebidos);
    console.log('Dados enviados ao n8n com sucesso!');

    // 8. Responder à aplicação original que deu tudo certo
    res.status(200).json({
      sucesso: true,
      mensagem: 'Dados recebidos, enriquecidos e redirecionados com sucesso.',
      dados: dadosRecebidos
    });

  } catch (error) {
    // 9. Se der erro ao contatar o webhook, registrar o erro e avisar a aplicação original
    console.error('Erro ao enviar dados para o webhook do n8n:', error.message);
    res.status(500).json({
      sucesso: false,
      mensagem: 'Erro ao redirecionar os dados para o serviço final.',
      erro: error.message
    });
  }
});

// 10. Iniciar o servidor
app.listen(PORT, () => {
  console.log(`API intermediária rodando na porta http://localhost:${PORT}`);
});