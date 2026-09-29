# Azure Container Apps Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar a aplicação Node.js Biblioteca/Livros no Azure Container Apps, comprovar o SELECT real no Azure SQL e implantar automaticamente cada push da `main` pelo GitHub Actions.

**Architecture:** Uma imagem Node.js 22 será criada no Azure Container Registry e executada por um Container App com ingress HTTPS e escala de zero a uma réplica. O contêiner acessará o Azure SQL por variáveis/segredos e enviará telemetria diretamente ao Application Insights; o GitHub Actions reconstruirá a imagem e atualizará a revisão do Container App.

**Tech Stack:** Node.js 22, Express 4, `mssql`, Docker/OCI, Azure Container Registry Basic, Azure Container Apps Consumption, Azure SQL Basic, Application Insights, GitHub Actions e Azure CLI 2.89.1.

## Global Constraints

- Usar somente `rg-biblioteca-260928`; nunca alterar ou excluir `rg-avocato-toast-cp4`.
- Região dos novos recursos: `brazilsouth`.
- Registry: `acrbiblioteca89733`; Environment: `cae-biblioteca-260928`; App: `ca-biblioteca-89733`.
- Tema: Biblioteca/Livros; `/tema` deve retornar cinco linhas reais de `dbo.Livros`.
- Segredos nunca podem ser impressos, commitados ou incluídos no PDF.
- O Container App deve usar 0,25 vCPU, 0,5 GiB, mínimo zero e máximo uma réplica.
- O primeiro deploy e o deploy da alteração visual devem aparecer como execuções verdes separadas.
- O Resource Group será excluído somente após confirmação da usuária.

---

### Task 1: Empacotamento OCI da aplicação

**Files:**
- Create: `app/Dockerfile`
- Create: `app/.dockerignore`
- Test: `app/index.js`

**Interfaces:**
- Consumes: aplicação Express iniciada por `node index.js` e variável `PORT`.
- Produces: imagem Linux que expõe a porta 3000 e executa Node.js 22.

- [ ] **Step 1: Confirmar o contrato atual da aplicação**

Run:

```powershell
node --check app/index.js
npm --prefix app ci
npm --prefix app ls --depth=0
```

Expected: sintaxe válida, instalação concluída e dependências `express`, `mssql` e `applicationinsights` listadas.

- [ ] **Step 2: Criar o Dockerfile**

```dockerfile
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV PORT=3000
EXPOSE 3000

CMD ["node", "index.js"]
```

- [ ] **Step 3: Criar o arquivo de exclusões do build**

```text
node_modules
npm-debug.log
.env
.git
```

- [ ] **Step 4: Verificar os arquivos**

Run:

```powershell
Get-Content app/Dockerfile
Get-Content app/.dockerignore
node --check app/index.js
```

Expected: Node 22, porta 3000 e nenhuma inclusão de segredo.

- [ ] **Step 5: Commit**

```powershell
git add app/Dockerfile app/.dockerignore
git commit -m "build: package app for Azure Container Apps"
```

### Task 2: Infraestrutura Container Apps e implantação inicial

**Files:**
- Modify: `outputs/comandos-azure.txt`

**Interfaces:**
- Consumes: `app/Dockerfile`, `work/sql-credential.xml`, Azure SQL e Application Insights existentes.
- Produces: ACR `acrbiblioteca89733`, environment `cae-biblioteca-260928`, Container App `ca-biblioteca-89733` e URL HTTPS pública.

- [ ] **Step 1: Registrar providers e criar o ACR**

```powershell
az provider register --namespace Microsoft.App --wait
az provider register --namespace Microsoft.ContainerRegistry --wait
az acr create --name acrbiblioteca89733 --resource-group rg-biblioteca-260928 --location brazilsouth --sku Basic --admin-enabled true --output none
```

Expected: providers `Registered` e ACR Basic criado.

- [ ] **Step 2: Construir a imagem inicial no Azure**

```powershell
az acr build --registry acrbiblioteca89733 --image biblioteca:initial app
```

Expected: build `Succeeded` e imagem `biblioteca:initial` disponível.

- [ ] **Step 3: Criar o environment e o Container App**

```powershell
az containerapp env create --name cae-biblioteca-260928 --resource-group rg-biblioteca-260928 --location brazilsouth --logs-destination none --output none
$acrServer = az acr show --name acrbiblioteca89733 --query loginServer -o tsv
$acrUsername = az acr credential show --name acrbiblioteca89733 --query username -o tsv
$acrPassword = az acr credential show --name acrbiblioteca89733 --query 'passwords[0].value' -o tsv
az containerapp create --name ca-biblioteca-89733 --resource-group rg-biblioteca-260928 --environment cae-biblioteca-260928 --image "$acrServer/biblioteca:initial" --target-port 3000 --ingress external --registry-server $acrServer --registry-username $acrUsername --registry-password $acrPassword --cpu 0.25 --memory 0.5Gi --min-replicas 0 --max-replicas 1 --output none
```

Expected: app criado com ingress externo; a senha do ACR não aparece no output.

- [ ] **Step 4: Configurar segredos e variáveis**

```powershell
$credential = Import-Clixml ..\work\sql-credential.xml
$dbPassword = $credential.GetNetworkCredential().Password
$aiConnection = az monitor app-insights component show --app appi-biblioteca-260928 --resource-group rg-biblioteca-260928 --query connectionString -o tsv
az containerapp secret set --name ca-biblioteca-89733 --resource-group rg-biblioteca-260928 --secrets "db-password=$dbPassword" "ai-connection=$aiConnection" --output none
az containerapp update --name ca-biblioteca-89733 --resource-group rg-biblioteca-260928 --set-env-vars "DB_SERVER=sql-biblioteca-89733.database.windows.net" "DB_NAME=db-biblioteca" "DB_USER=sqladmin" "DB_PASSWORD=secretref:db-password" "APPLICATIONINSIGHTS_CONNECTION_STRING=secretref:ai-connection" "PORT=3000" "NODE_ENV=production" --output none
```

Expected: somente nomes das configurações são verificáveis; valores sensíveis permanecem ocultos.

- [ ] **Step 5: Smoke test inicial**

```powershell
$fqdn = az containerapp show --name ca-biblioteca-89733 --resource-group rg-biblioteca-260928 --query properties.configuration.ingress.fqdn -o tsv
$homeResponse = Invoke-WebRequest -UseBasicParsing "https://$fqdn/"
$tema = Invoke-RestMethod "https://$fqdn/tema"
$homeResponse.StatusCode
$tema | Format-Table Id,Titulo,Autor,AnoPublicacao -AutoSize
```

Expected: HTTP 200 e exatamente cinco livros.

### Task 3: Pipeline GitHub Actions para Container Apps

**Files:**
- Modify: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: segredo GitHub `AZURE_CREDENTIALS`, ACR, Container App e pasta `app`.
- Produces: imagem `biblioteca:<commit SHA>`, nova revisão do Container App e smoke test verde.

- [ ] **Step 1: Substituir o workflow pelo pipeline do Container Apps**

```yaml
name: Build and deploy Container App

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

env:
  RESOURCE_GROUP: rg-biblioteca-260928
  ACR_NAME: acrbiblioteca89733
  CONTAINER_APP_NAME: ca-biblioteca-89733

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: npm
          cache-dependency-path: app/package-lock.json
      - name: Validate application
        working-directory: app
        run: |
          npm ci
          node --check index.js
      - uses: azure/login@v2
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}
      - name: Build image and deploy
        run: |
          az extension add --name containerapp --upgrade --allow-preview false
          az acr build --registry "$ACR_NAME" --image "biblioteca:$GITHUB_SHA" app
          ACR_SERVER=$(az acr show --name "$ACR_NAME" --query loginServer -o tsv)
          az containerapp update --name "$CONTAINER_APP_NAME" --resource-group "$RESOURCE_GROUP" --image "$ACR_SERVER/biblioteca:$GITHUB_SHA" --output none
      - name: Smoke test
        run: |
          FQDN=$(az containerapp show --name "$CONTAINER_APP_NAME" --resource-group "$RESOURCE_GROUP" --query properties.configuration.ingress.fqdn -o tsv)
          curl --fail --retry 12 --retry-delay 10 --retry-all-errors "https://$FQDN/tema"
```

- [ ] **Step 2: Criar credencial de implantação restrita ao Resource Group**

Run only after action-time confirmation:

```powershell
$subscriptionId = az account show --query id -o tsv
$scope = "/subscriptions/$subscriptionId/resourceGroups/rg-biblioteca-260928"
$azureCredentials = az ad sp create-for-rbac --name sp-github-biblioteca-260928 --role Contributor --scopes $scope --sdk-auth
```

Expected: JSON capturado em memória, nunca exibido.

- [ ] **Step 3: Salvar o segredo no GitHub**

Run only after action-time confirmation:

```powershell
$azureCredentials | gh secret set AZURE_CREDENTIALS --repo Fredaoo22/atividade-azure-devops
```

Expected: GitHub confirma apenas o nome `AZURE_CREDENTIALS`.

- [ ] **Step 4: Commit do workflow**

```powershell
git add .github/workflows/deploy.yml
git commit -m "ci: deploy application to Azure Container Apps"
```

- [ ] **Step 5: Push e pipeline inicial**

Run only after confirmation for the public repository update:

```powershell
git push origin main
```

Expected: job `build-and-deploy` verde e smoke test de `/tema` aprovado.

### Task 4: Alteração visual e comprovação ponta a ponta

**Files:**
- Modify: `app/index.js`

**Interfaces:**
- Consumes: pipeline funcional da Task 3.
- Produces: segundo commit visível no site e segunda execução verde.

- [ ] **Step 1: Aplicar a identidade Biblioteca Aurora**

Em `app/index.js`, fazer estas substituições exatas no HTML da rota `/`:

```diff
-        <title>FIAP - Atividade DevOps</title>
+        <title>Biblioteca Aurora</title>
@@
-                background-color: #1a1a1a;
+                background: radial-gradient(circle at top, #4d1730 0%, #190b13 72%);
@@
-                background-color: #262626;
+                background: rgba(44, 18, 29, 0.96);
@@
-                border-top: 5px solid #ED145B;
+                border-top: 5px solid #d8ad4a;
@@
-                color: #ED145B;
+                color: #f3cf77;
@@
-                background-color: #ED145B;
+                background-color: #8a2147;
@@
-                background-color: #c0104a;
+                background-color: #b43161;
@@
-                background-color: #4CAF50;
-                color: white;
+                background-color: #d8ad4a;
+                color: #271018;
@@
-            <h1>Atividade DevOps & Cloud</h1>
-            <p>Parabéns! Sua aplicação Node.js foi implementada com sucesso no Azure Web App através da sua esteira CI/CD.</p>
-            <p>O App Insights já está monitorando sua aplicação.</p>
-            <a href="/tema" class="btn">🚀 Ver Dados do Banco</a>
+            <h1>Biblioteca Aurora</h1>
+            <p>Um acervo brasileiro publicado com Node.js, Azure SQL e integração contínua.</p>
+            <p>As requisições estão sendo acompanhadas pelo Application Insights.</p>
+            <a href="/tema" class="btn">📚 Consultar o acervo</a>
```

- [ ] **Step 2: Verificar localmente**

```powershell
node --check app/index.js
rg -n "Biblioteca Aurora|Consultar o acervo|#d8ad4a|/tema" app/index.js
```

Expected: título e rota presentes; sintaxe Node válida.

- [ ] **Step 3: Commit e push visual**

```powershell
git add app/index.js
git commit -m "style: apply Biblioteca Aurora theme"
git push origin main
```

Expected: nova execução verde e mudança visível automaticamente na mesma URL.

### Task 5: Evidências, documentação e entrega

**Files:**
- Modify: `outputs/comandos-azure.txt`
- Modify: `docs/superpowers/specs/2026-09-28-atividade-azure-design.md`
- Modify: `docs/superpowers/plans/2026-09-28-atividade-azure-implementation.md`
- Create: `outputs/entrega-atividade-azure.pdf`

**Interfaces:**
- Consumes: URL pública, pipelines verdes, Azure SQL, Application Insights e arquitetura existente.
- Produces: capturas verificáveis e PDF final.

- [ ] **Step 1: Registrar os comandos reais e o fallback**

Documentar as tentativas F1/D1/P0v4, os erros de cota sem segredos e os comandos efetivamente usados para ACR/Container Apps.

- [ ] **Step 2: Capturar evidências**

Capturar: arquitetura, cinco inserts, pipeline verde, Application Insights, página inicial com identidade Biblioteca Aurora, `/tema` com cinco livros e visão geral do Container App. Nenhuma captura pode mostrar senha, publish profile, connection string ou segredo GitHub.

- [ ] **Step 3: Gerar e verificar o PDF**

Criar o PDF com nomes do grupo, tema, arquitetura, comandos e capturas; renderizar todas as páginas e confirmar legibilidade antes da entrega.

- [ ] **Step 4: Limpeza após confirmação**

```powershell
az group delete --name rg-biblioteca-260928 --yes --no-wait
```

Expected: executar somente depois de a usuária confirmar que o PDF e a entrega foram enviados.
