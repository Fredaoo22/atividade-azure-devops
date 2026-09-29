# Design do fallback com Azure Container Apps

**Data:** 28 de setembro de 2026

## Contexto e decisão

O objetivo continua sendo publicar a aplicação Node.js do tema Biblioteca/Livros, consultar os cinco registros reais do Azure SQL, enviar telemetria ao Application Insights e comprovar integração contínua pelo GitHub Actions.

O Azure App Service prescrito no enunciado foi tentado nos níveis F1, D1 e P0v4, em Windows e Linux. A assinatura Free Trial retornou cota efetiva zero ou `ResourceNotAvailableForOffer`; a região alternativa também foi impedida pela combinação de política regional e indisponibilidade da oferta. Nenhum App Service Plan foi criado e não houve cobrança desse serviço.

Foram consideradas três alternativas:

1. **Azure Container Apps (selecionada):** executa o Express sem reescrever a aplicação, mantém o SELECT real no Azure SQL, aceita variáveis e segredos, integra com Application Insights e fornece URL pública. A divergência fica restrita ao serviço de hospedagem.
2. **Azure Static Web Apps:** teria pipeline simples, mas exigiria reescrever o backend como Functions e aumentaria o risco no prazo.
3. **GitHub Pages:** comprovaria apenas interface e pipeline estático; não executaria o Node.js nem o SELECT real e, por isso, foi rejeitado.

## Arquitetura do fallback

O Resource Group `rg-biblioteca-260928`, em `brazilsouth`, continuará contendo Azure SQL, Application Insights e Log Analytics. Serão adicionados:

- Azure Container Registry Basic `acrbiblioteca89733`, para armazenar a imagem Linux da aplicação;
- Container Apps Environment `cae-biblioteca-260928`;
- Container App `ca-biblioteca-89733`, com ingress HTTPS externo e escala de zero a uma réplica.

O fluxo será:

`GitHub main -> GitHub Actions -> Azure Container Registry -> Azure Container App -> Azure SQL`

O SDK da aplicação enviará telemetria diretamente ao Application Insights pela variável `APPLICATIONINSIGHTS_CONNECTION_STRING`.

## Aplicação e dados

A aplicação manterá a rota `/tema` já implementada. Ela executa um `SELECT` em `dbo.Livros`, ordenado por `Id`, e retorna os campos `Id`, `Titulo`, `Autor` e `AnoPublicacao`. A página inicial continuará sendo servida pelo Express.

Será adicionado um `Dockerfile` baseado em Node.js 22. O contêiner ouvirá a porta definida por `PORT`, usando `3000` como padrão.

## Segredos e permissões

As credenciais do banco e a connection string do Application Insights serão armazenadas como segredos do Container App e referenciadas por variáveis de ambiente. Nenhum valor secreto entrará no Git ou no PDF.

Para o GitHub Actions, será criada uma credencial de implantação com escopo apenas no Resource Group do trabalho. O JSON será salvo somente no segredo `AZURE_CREDENTIALS` do fork. Essa credencial permitirá ao workflow executar `az acr build` e `az containerapp update`.

## Pipeline

O job `build-and-deploy` será executado em cada push para `main`:

1. checkout do código;
2. instalação do Node.js 22;
3. `npm ci` e verificação de sintaxe;
4. login no Azure usando `AZURE_CREDENTIALS`;
5. build remoto da imagem no Azure Container Registry, com tag do SHA do commit;
6. atualização do Container App para a nova imagem;
7. chamada HTTP a `/tema` como smoke test.

A alteração visual exigida será feita em um segundo commit, depois que o primeiro pipeline estiver verde.

## Custos e limpeza

O Container Apps Consumption possui franquia mensal gratuita de 180.000 vCPU-segundos, 360.000 GiB-segundos e dois milhões de requisições. O Azure Container Registry Basic custa aproximadamente US$ 0,1666 por dia em `brazilsouth`. O Resource Group do trabalho será excluído após a entrega, mediante confirmação da usuária.

## Evidências e critérios de sucesso

O fallback estará concluído quando:

- a URL pública responder com HTTP 200;
- `/tema` retornar exatamente os cinco livros do Azure SQL;
- o GitHub Actions estiver verde após o commit inicial;
- um segundo commit visual for implantado automaticamente;
- Application Insights registrar requisições;
- as capturas e o PDF registrarem claramente o bloqueio do App Service e o fallback adotado.

## Tratamento de falhas

Se o build do ACR falhar, o workflow preservará a revisão anterior do Container App. Se a aplicação não conseguir acessar o banco, `/tema` responderá com erro sem expor credenciais, e os detalhes ficarão nos logs e no Application Insights. O smoke test impedirá que uma execução seja considerada concluída sem uma resposta válida.
