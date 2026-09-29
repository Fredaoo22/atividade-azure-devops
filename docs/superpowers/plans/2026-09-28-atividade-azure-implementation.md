# Atividade Azure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar a aplicação Node.js do fork no Azure Web App, consultar cinco livros no Azure SQL, comprovar CI/CD e monitoramento e gerar o PDF de entrega.

**Architecture:** Um Resource Group exclusivo contém Azure SQL e Application Insights em `brazilsouth`, App Service Plan Windows F1 e Web App Node.js 22 em `chilecentral`. Um push na `main` do fork dispara GitHub Actions, que usa publish profile para implantar a pasta `app`; o Web App consulta `dbo.Livros` e envia telemetria ao Application Insights.

**Tech Stack:** Azure CLI 2.89.1, Azure App Service Windows F1, Node.js 22, Express 4, `mssql`, Azure SQL Basic, Application Insights, GitHub Actions e PowerShell 7.

## Global Constraints

- Regiões Azure: `brazilsouth` para Resource Group, SQL e monitoramento; `chilecentral` para App Service.
- Resource Group novo: `rg-biblioteca-260928`.
- O Resource Group existente `rg-avocato-toast-cp4` não pode ser alterado nem excluído.
- Tema: Biblioteca/Livros.
- SQL Server: `sql-biblioteca-89733`; banco: `db-biblioteca`; usuário: `sqladmin`.
- App Service Plan Windows F1: `plan-biblioteca-260928`, criado com sucesso em `chilecentral`. Por orientação do professor, a política “Locais permitidos” passou a incluir essa região após as falhas por cota em Brazil South. D1 e Container Apps foram abandonados.
- Web App: `web-biblioteca-89733`; runtime: `NODE:22LTS`.
- Application Insights: `appi-biblioteca-260928`.
- Log Analytics Workspace: `law-biblioteca-260928`, no mesmo Resource Group.
- Segredos nunca podem aparecer em Git, prints, logs entregues ou PDF.
- A regra ampla de firewall e a autenticação básica SCM só permanecem durante a atividade.
- O Resource Group novo só pode ser excluído após todos os prints, revisão do PDF e confirmação da submissão.

---

### Task 1: Criar a arquitetura e preparar as evidências

**Files:**
- Create: `outputs/arquitetura-azure.drawio`
- Create: `outputs/arquitetura-azure.png`
- Create: `work/evidencias/`

**Interfaces:**
- Consumes: nomes fixos dos recursos definidos nas restrições globais.
- Produces: diagrama editável e PNG para o PDF final.

- [ ] **Step 1: Montar o diagrama no diagrams.net**

Criar um contêiner `Azure Resource Group — rg-biblioteca-260928` contendo `Azure Web App — web-biblioteca-89733`, `Azure SQL Server + Database`, `Application Insights — appi-biblioteca-260928` e `Log Analytics — law-biblioteca-260928`. Fora do contêiner, inserir `Integrantes`, `GitHub Repository`, `GitHub Actions` e `Usuário / Navegador`.

- [ ] **Step 2: Adicionar os fluxos exatos**

```text
Integrantes -- commit / push --> GitHub Repository
GitHub Repository -- push na main --> GitHub Actions
GitHub Actions -- deploy --> Azure Web App
Usuário / Navegador -- HTTPS / e /tema --> Azure Web App
Azure Web App -- SELECT criptografado --> Azure SQL Database
Azure Web App -- requisições, dependências e erros --> Application Insights
Azure CLI -- provisionamento --> Azure Resource Group
```

- [ ] **Step 3: Exportar e verificar**

Exportar como `outputs/arquitetura-azure.png` em escala 2x. Verificar que todos os quatro componentes exigidos — GitHub, Azure Web App, Azure SQL e Application Insights — estão legíveis no PNG.

---

### Task 2: Provisionar a infraestrutura e inicializar o banco

**Files:**
- Create: `work/provision.ps1`
- Create: `outputs/comandos-azure.txt`
- Create: `work/evidencias/banco-livros.txt`

**Interfaces:**
- Consumes: sessão Azure CLI já autenticada na assinatura `Azure subscription 1`.
- Produces: recursos Azure, cinco registros em `dbo.Livros` e configurações protegidas do Web App.

- [ ] **Step 1: Criar o script de provisionamento**

Salvar em `work/provision.ps1`:

```powershell
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
New-Item -ItemType Directory -Force 'work/evidencias' | Out-Null

$resourceGroup = 'rg-biblioteca-260928'
$location = 'brazilsouth'
$appServiceLocation = 'chilecentral'
$sqlServer = 'sql-biblioteca-89733'
$database = 'db-biblioteca'
$sqlUser = 'sqladmin'
$plan = 'plan-biblioteca-260928'
$webApp = 'web-biblioteca-89733'
$appInsights = 'appi-biblioteca-260928'
$logWorkspace = 'law-biblioteca-260928'

$securePassword = Read-Host 'Digite uma senha forte e exclusiva para o Azure SQL' -AsSecureString
$credential = [pscredential]::new($sqlUser, $securePassword)
$dbPassword = $credential.GetNetworkCredential().Password

az account show --query '{Subscription:name,State:state}' --output table
az group create --name $resourceGroup --location $location --output table

az sql server create `
  --name $sqlServer `
  --resource-group $resourceGroup `
  --location $location `
  --admin-user $sqlUser `
  --admin-password $dbPassword `
  --output table

az sql db create `
  --resource-group $resourceGroup `
  --server $sqlServer `
  --name $database `
  --service-objective Basic `
  --backup-storage-redundancy Local `
  --output table

az sql server firewall-rule create `
  --resource-group $resourceGroup `
  --server $sqlServer `
  --name AllowAll `
  --start-ip-address 0.0.0.0 `
  --end-ip-address 255.255.255.255 `
  --output table

az appservice plan create `
  --name $plan `
  --resource-group $resourceGroup `
  --sku F1 `
  --location $appServiceLocation `
  --is-linux false `
  --output table

az webapp create `
  --name $webApp `
  --plan $plan `
  --resource-group $resourceGroup `
  --runtime 'NODE:22LTS' `
  --basic-auth Enabled `
  --output table

az extension add --name application-insights --upgrade --only-show-errors
az monitor log-analytics workspace create `
  --resource-group $resourceGroup `
  --workspace-name $logWorkspace `
  --location $location `
  --sku PerGB2018 `
  --retention-time 30 `
  --output table

$workspaceId = az monitor log-analytics workspace show `
  --resource-group $resourceGroup `
  --workspace-name $logWorkspace `
  --query id `
  --output tsv

az monitor app-insights component create `
  --app $appInsights `
  --location $location `
  --kind web `
  --resource-group $resourceGroup `
  --application-type web `
  --workspace $workspaceId `
  --output table

$insightsConnection = az monitor app-insights component show `
  --resource-group $resourceGroup `
  --app $appInsights `
  --query connectionString `
  --output tsv

az webapp config appsettings set `
  --resource-group $resourceGroup `
  --name $webApp `
  --settings `
    DB_SERVER="$sqlServer.database.windows.net" `
    DB_NAME=$database `
    DB_USER=$sqlUser `
    DB_PASSWORD=$dbPassword `
    APPLICATIONINSIGHTS_CONNECTION_STRING=$insightsConnection `
    WEBSITE_NODE_DEFAULT_VERSION='~22' `
  --output none

$connectionBuilder = [System.Data.SqlClient.SqlConnectionStringBuilder]::new()
$connectionBuilder['Data Source'] = "tcp:$sqlServer.database.windows.net,1433"
$connectionBuilder['Initial Catalog'] = $database
$connectionBuilder['Persist Security Info'] = $false
$connectionBuilder['User ID'] = $sqlUser
$connectionBuilder['Password'] = $dbPassword
$connectionBuilder['MultipleActiveResultSets'] = $false
$connectionBuilder['Encrypt'] = $true
$connectionBuilder['TrustServerCertificate'] = $false
$connectionBuilder['Connect Timeout'] = 30
$connection = [System.Data.SqlClient.SqlConnection]::new($connectionBuilder.ConnectionString)
$connection.Open()

$command = $connection.CreateCommand()
$command.CommandText = @'
IF OBJECT_ID(N'dbo.Livros', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Livros (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Titulo NVARCHAR(150) NOT NULL,
        Autor NVARCHAR(120) NOT NULL,
        AnoPublicacao SMALLINT NOT NULL
    );
END;

TRUNCATE TABLE dbo.Livros;

INSERT INTO dbo.Livros (Titulo, Autor, AnoPublicacao)
VALUES
    (N'Dom Casmurro', N'Machado de Assis', 1899),
    (N'A Hora da Estrela', N'Clarice Lispector', 1977),
    (N'Capitães da Areia', N'Jorge Amado', 1937),
    (N'Quarto de Despejo', N'Carolina Maria de Jesus', 1960),
    (N'Torto Arado', N'Itamar Vieira Junior', 2019);
'@
[void]$command.ExecuteNonQuery()

$select = $connection.CreateCommand()
$select.CommandText = 'SELECT Id, Titulo, Autor, AnoPublicacao FROM dbo.Livros ORDER BY Id;'
$adapter = [System.Data.SqlClient.SqlDataAdapter]::new($select)
$table = [System.Data.DataTable]::new()
[void]$adapter.Fill($table)
$connection.Close()

$table | Format-Table -AutoSize
$table | Format-Table -AutoSize | Out-String | Set-Content -Encoding utf8 'work/evidencias/banco-livros.txt'

$dbPassword = $null
$securePassword.Dispose()
$credential = $null
$insightsConnection = $null
$connectionBuilder.Clear()
$connectionBuilder = $null

az resource list --resource-group $resourceGroup --query '[].{Nome:name,Tipo:type,Localizacao:location}' --output table
```

- [ ] **Step 2: Executar e validar**

Run:

```powershell
pwsh -NoProfile -File .\work\provision.ps1
```

Expected: tabela final com cinco livros e uma lista contendo Web App, plano, SQL Server, banco, Application Insights e o workspace de logs. Se a criação indicar que um nome global já existe, alterar somente `89733` nos dois nomes globais, atualizar design/plano e executar novamente.

- [ ] **Step 3: Registrar comandos sem segredos**

Salvar em `outputs/comandos-azure.txt` os comandos Azure CLI do script, substituindo a senha por `[OCULTO]` e a connection string por `[OCULTA]`. O arquivo não deve conter a linha `$dbPassword = ...` nem qualquer valor secreto.

---

### Task 3: Fazer o fork e clonar o repositório correto

**Files:**
- Create: `atividade-azure-devops/` a partir do fork da usuária.
- Copy: `docs/superpowers/specs/2026-09-28-atividade-azure-design.md` para `atividade-azure-devops/docs/superpowers/specs/2026-09-28-atividade-azure-design.md`.
- Copy: `docs/superpowers/plans/2026-09-28-atividade-azure-implementation.md` para `atividade-azure-devops/docs/superpowers/plans/2026-09-28-atividade-azure-implementation.md`.

**Interfaces:**
- Consumes: conta GitHub autenticada no navegador.
- Produces: fork próprio, checkout local na branch `main` e remote `origin` apontando para o fork.

- [ ] **Step 1: Criar o fork no GitHub**

Abrir `https://github.com/karlosmiguell/atividade-azure-devops`, clicar em **Fork**, manter o nome `atividade-azure-devops` e criar o fork. Na página do fork, abrir **Code > HTTPS** e copiar a URL.

- [ ] **Step 2: Clonar a URL copiada**

Run:

```powershell
$forkUrl = Get-Clipboard
git clone $forkUrl atividade-azure-devops
git -C atividade-azure-devops remote -v
git -C atividade-azure-devops branch --show-current
```

Expected: `origin` aponta para a conta da usuária e a branch exibida é `main`.

- [ ] **Step 3: Levar a documentação validada para o repositório**

Run:

```powershell
New-Item -ItemType Directory -Force atividade-azure-devops\docs\superpowers\specs | Out-Null
New-Item -ItemType Directory -Force atividade-azure-devops\docs\superpowers\plans | Out-Null
Copy-Item docs\superpowers\specs\2026-09-28-atividade-azure-design.md atividade-azure-devops\docs\superpowers\specs\
Copy-Item docs\superpowers\plans\2026-09-28-atividade-azure-implementation.md atividade-azure-devops\docs\superpowers\plans\
```

---

### Task 4: Integrar Node.js, Azure SQL e App Service Windows

**Files:**
- Modify: `atividade-azure-devops/app/index.js`
- Modify: `atividade-azure-devops/app/package.json`
- Create: `atividade-azure-devops/app/web.config`
- Modify: `atividade-azure-devops/.github/workflows/main.yml`
- Create: `atividade-azure-devops/app/package-lock.json`

**Interfaces:**
- Consumes: `DB_SERVER`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` e `APPLICATIONINSIGHTS_CONNECTION_STRING` definidos no Web App.
- Produces: `/tema` com `Array<{Id:number,Titulo:string,Autor:string,AnoPublicacao:number}>` e pacote implantável no Windows App Service.

- [ ] **Step 1: Trocar a consulta placeholder**

Em `app/index.js`, mover a importação do Express para depois da inicialização do Application Insights. O início do arquivo deve ficar assim:

```js
const appInsights = require('applicationinsights');

if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
    appInsights.setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING)
        .setAutoDependencyCorrelation(true)
        .setAutoCollectRequests(true)
        .setAutoCollectPerformance(true, true)
        .setAutoCollectExceptions(true)
        .setAutoCollectDependencies(true)
        .setAutoCollectConsole(true)
        .setUseDiskRetryCaching(true)
        .start();
    console.log("App Insights configurado.");
} else {
    console.log("App Insights connection string não encontrada.");
}

const express = require('express');
const sql = require('mssql');
const app = express();
```

Remover as importações duplicadas de `express`, `applicationinsights` e `mssql`. Depois, substituir:

```js
const result = await sql.query`SELECT * FROM NomeDaSuaTabela`; // ALTERAR AQUI!
```

por:

```js
const result = await sql.query`
    SELECT Id, Titulo, Autor, AnoPublicacao
    FROM dbo.Livros
    ORDER BY Id
`;
```

- [ ] **Step 2: Fixar a versão do Node**

Em `app/package.json`, adicionar após `"main": "index.js"`:

```json
"engines": {
  "node": "22.x"
},
```

- [ ] **Step 3: Criar a configuração IISNode**

Salvar em `app/web.config`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <handlers>
      <add name="iisnode" path="index.js" verb="*" modules="iisnode" />
    </handlers>
    <rewrite>
      <rules>
        <rule name="NodeExpress" stopProcessing="true">
          <match url=".*" />
          <conditions>
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
          </conditions>
          <action type="Rewrite" url="index.js" />
        </rule>
      </rules>
    </rewrite>
    <httpErrors existingResponse="PassThrough" />
  </system.webServer>
</configuration>
```

- [ ] **Step 4: Apontar o workflow ao Web App real**

Substituir o conteúdo de `.github/workflows/main.yml` por:

```yaml
name: Build and deploy Node.js app to Azure Web App

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

env:
  AZURE_WEBAPP_NAME: web-biblioteca-89733
  NODE_VERSION: '22.x'

jobs:
  build-and-deploy:
    runs-on: windows-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Install dependencies
        working-directory: ./app
        run: |
          npm install --omit=dev
          npm run build --if-present
          npm run test --if-present

      - name: Deploy to Azure Web App
        uses: azure/webapps-deploy@v3
        with:
          app-name: ${{ env.AZURE_WEBAPP_NAME }}
          publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
          package: ./app
```

- [ ] **Step 5: Instalar dependências e verificar sintaxe**

Run:

```powershell
Set-Location atividade-azure-devops\app
npm install
node --check index.js
npm run build --if-present
Set-Location ..\..
```

Expected: `node --check` encerra sem mensagem de erro; `npm install` cria `package-lock.json`; o build opcional encerra com código 0.

- [ ] **Step 6: Commitar a integração inicial**

Run:

```powershell
git -C atividade-azure-devops add app/index.js app/package.json app/package-lock.json app/web.config .github/workflows/main.yml docs/superpowers
git -C atividade-azure-devops diff --cached --check
git -C atividade-azure-devops commit -m "feat: integrate bookstore with Azure services"
```

Expected: um commit contendo consulta SQL, configuração Windows, workflow e documentação, sem qualquer segredo.

---

### Task 5: Configurar o secret e concluir o primeiro deploy

**Files:**
- Create temporarily: `work/publish-profile.xml`
- Delete after use: `work/publish-profile.xml`

**Interfaces:**
- Consumes: publish profile de `web-biblioteca-89733`.
- Produces: secret GitHub `AZURE_WEBAPP_PUBLISH_PROFILE` e primeiro pipeline verde.

- [ ] **Step 1: Baixar o publish profile sem mostrá-lo**

Run:

```powershell
az webapp deployment list-publishing-profiles `
  --resource-group rg-biblioteca-260928 `
  --name web-biblioteca-89733 `
  --xml | Set-Content -Encoding utf8 -NoNewline work\publish-profile.xml
```

Expected: o arquivo começa com `<publishData>`; não imprimir seu conteúdo no terminal.

- [ ] **Step 2: Criar o secret no GitHub**

No fork, abrir **Settings > Secrets and variables > Actions > New repository secret**. Usar o nome exato `AZURE_WEBAPP_PUBLISH_PROFILE`. Copiar o conteúdo com:

```powershell
Get-Content -Raw work\publish-profile.xml | Set-Clipboard
```

Colar no campo do valor, salvar, limpar a área de transferência e remover o arquivo temporário:

```powershell
Set-Clipboard -Value ''
$profilePath = (Resolve-Path work\publish-profile.xml).Path
if ($profilePath -like "$((Resolve-Path work).Path)*") {
    Remove-Item -LiteralPath $profilePath
}
```

- [ ] **Step 3: Enviar o primeiro commit**

Run:

```powershell
git -C atividade-azure-devops push origin main
```

Expected: GitHub Actions executa o job `build-and-deploy` com sucesso.

- [ ] **Step 4: Verificar a implantação inicial**

Run:

```powershell
$homeResponse = Invoke-WebRequest -UseBasicParsing https://web-biblioteca-89733.azurewebsites.net/
$tema = Invoke-RestMethod https://web-biblioteca-89733.azurewebsites.net/tema
$homeResponse.StatusCode
$tema | Format-Table Id,Titulo,Autor,AnoPublicacao -AutoSize
```

Expected: status `200` e exatamente cinco livros.

---

### Task 6: Comprovar o CI/CD com a alteração visual

**Files:**
- Modify: `atividade-azure-devops/app/index.js`

**Interfaces:**
- Consumes: primeiro deploy funcional.
- Produces: segundo commit na `main`, pipeline verde e página visualmente diferente.

- [ ] **Step 1: Aplicar uma mudança visual clara**

Em `app/index.js`, realizar estas substituições exatas:

```text
<title>FIAP - Atividade DevOps</title>
→ <title>Biblioteca na Azure - CI/CD</title>

background-color: #1a1a1a;
→ background-color: #0f172a;

border-top: 5px solid #ED145B;
→ border-top: 5px solid #38bdf8;

color: #ED145B;
→ color: #38bdf8;

<h1>Atividade DevOps & Cloud</h1>
→ <h1>📚 Biblioteca na Azure</h1>
```

Também substituir o primeiro texto descritivo por:

```html
<p>Aplicação Node.js integrada ao Azure SQL e publicada automaticamente pelo GitHub Actions.</p>
```

- [ ] **Step 2: Testar, commitar e enviar**

Run:

```powershell
node --check atividade-azure-devops\app\index.js
git -C atividade-azure-devops add app/index.js
git -C atividade-azure-devops diff --cached --check
git -C atividade-azure-devops commit -m "style: customize bookstore landing page"
git -C atividade-azure-devops push origin main
```

Expected: segundo workflow verde associado ao commit `style: customize bookstore landing page`.

---

### Task 7: Validar monitoramento e capturar todos os prints

**Files:**
- Create: `work/evidencias/arquitetura.png`
- Create: `work/evidencias/banco.png`
- Create: `work/evidencias/pipeline-verde.png`
- Create: `work/evidencias/rota-tema.png`
- Create: `work/evidencias/webapp-visual.png`
- Create: `work/evidencias/app-insights.png`

**Interfaces:**
- Consumes: segundo pipeline concluído e aplicação pública.
- Produces: seis evidências legíveis para o PDF.

- [ ] **Step 1: Gerar tráfego de telemetria**

Run:

```powershell
1..10 | ForEach-Object {
    Invoke-WebRequest -UseBasicParsing https://web-biblioteca-89733.azurewebsites.net/ | Out-Null
    Invoke-WebRequest -UseBasicParsing https://web-biblioteca-89733.azurewebsites.net/tema | Out-Null
}
```

Expected: vinte requisições bem-sucedidas; aguardar de dois a cinco minutos para agregação.

- [ ] **Step 2: Capturar as evidências na ordem mais eficiente**

1. Diagrama completo com título `Arquitetura — Biblioteca na Azure`.
2. Azure SQL Query Editor mostrando servidor/banco, `SELECT` e os cinco registros.
3. GitHub Actions mostrando check verde, branch `main`, mensagem do segundo commit e job de deploy.
4. URL pública `/tema` e os cinco objetos JSON.
5. URL pública `/` e a página com título azul `Biblioteca na Azure`.
6. Application Insights Overview, Metrics ou Live Metrics mostrando o nome do recurso e requisições recentes.

Nenhum print pode revelar senha, app settings, publish profile ou connection string.

- [ ] **Step 3: Conferir a aplicação após o cache**

Abrir a home e pressionar `Ctrl+F5`. Expected: título `Biblioteca na Azure - CI/CD`, cabeçalho `📚 Biblioteca na Azure` e destaque azul `#38bdf8`.

---

### Task 8: Gerar e verificar o PDF de entrega

**Files:**
- Create: `outputs/entrega-atividade-azure.pdf`
- Create: `work/entrega-atividade-azure.docx` ou fonte equivalente usada para gerar o PDF.

**Interfaces:**
- Consumes: nomes reais dos integrantes, comandos sanitizados e seis evidências.
- Produces: PDF final legível e pronto para submissão.

- [ ] **Step 1: Coletar os nomes completos**

Solicitar em chat os nomes dos integrantes exatamente como devem aparecer na capa; não inventar nomes ausentes.

- [ ] **Step 2: Montar o documento**

Usar esta ordem:

1. Capa com atividade, tema, turma e integrantes.
2. Arquitetura.
3. Tabela dos recursos Azure.
4. Comandos Azure CLI, com senha e connection string marcadas como `[OCULTO]`.
5. SQL de criação, cinco inserts e print do resultado.
6. Integração Node.js e print de `/tema`.
7. Pipeline verde.
8. Alteração visual publicada.
9. Application Insights.
10. Conclusão e comando de exclusão do Resource Group.

- [ ] **Step 3: Renderizar e revisar**

Usar a skill de PDF para renderizar todas as páginas em PNG. Verificar que imagens, URLs, comandos e nomes dos recursos estão legíveis e que nenhuma imagem está cortada. Corrigir e renderizar novamente quando necessário.

---

### Task 9: Submeter e remover somente o ambiente novo

**Files:**
- Verify: `outputs/entrega-atividade-azure.pdf`

**Interfaces:**
- Consumes: confirmação de que o PDF foi submetido com sucesso.
- Produces: ambiente da atividade removido sem afetar o projeto anterior.

- [ ] **Step 1: Confirmar a submissão antes da exclusão**

Abrir o PDF final uma última vez, confirmar o envio na plataforma e obter confirmação explícita da usuária. Não executar exclusão antes disso.

- [ ] **Step 2: Excluir apenas o novo Resource Group**

Run:

```powershell
$targetGroup = az group show --name rg-biblioteca-260928 --query name --output tsv
if ($targetGroup -eq 'rg-biblioteca-260928') {
    az group delete --name rg-biblioteca-260928 --yes --no-wait
}
```

Expected: exclusão assíncrona iniciada somente para `rg-biblioteca-260928`; `rg-avocato-toast-cp4` permanece intacto.
