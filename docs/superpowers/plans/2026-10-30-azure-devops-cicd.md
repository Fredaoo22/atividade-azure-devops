# CP03 Azure DevOps CI/CD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar automaticamente o fork GitHub da aplicação Node.js em um Azure App Service usando Build e Release Pipelines clássicas do Azure DevOps.

**Architecture:** O GitHub será a fonte da Build Pipeline clássica, que produzirá o artifact `drop/app.zip`. Uma Release Pipeline clássica consumirá esse artifact e fará deploy no App Service Linux por uma Service Connection Azure Resource Manager; CI e CD serão disparados automaticamente.

**Tech Stack:** GitHub, Git, Node.js 24 LTS, Express, Azure CLI, Azure DevOps Classic Build, Azure DevOps Classic Release, Azure App Service Linux.

## Global Constraints

- GitHub usa a conta `Fredaoo22`.
- Azure e Azure DevOps usam `mr565725@fiap.com.br`.
- O projeto Azure DevOps se chama `cp03-fred-devops`.
- Build e Release devem usar os editores clássicos, não YAML.
- Nenhum segredo, token ou publish profile pode ser commitado.
- O deploy deve ser realizado pela Release Pipeline, nunca manualmente pelo Portal Azure.
- O professor `pf2488@fiap.com.br` deve receber acesso `Basic`.
- O App Service deve usar o SKU gratuito `F1`; não criar um recurso pago sem nova autorização.

---

### Task 1: Autenticação e fork GitHub

**Files:**
- Existing clone: repository root
- Modify repository metadata: `.git/config` through Git commands only

**Interfaces:**
- Consumes: repository `karlosmiguell/atividade-azure-devops`
- Produces: fork `https://github.com/Fredaoo22/atividade-azure-devops` configured as `origin`

- [ ] **Step 1: Install GitHub CLI if absent**

Run:

```powershell
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  winget install --id GitHub.cli --exact --accept-package-agreements --accept-source-agreements
}
```

Expected: `gh --version` reports an installed version.

- [ ] **Step 2: Authenticate GitHub as Fredaoo22**

Run:

```powershell
gh auth login --hostname github.com --git-protocol https --web
gh api user --jq .login
```

Expected: browser/device login is completed by the user and the final command prints `Fredaoo22`.

- [ ] **Step 3: Create or reuse the fork**

Run:

```powershell
$forkExists = gh repo view Fredaoo22/atividade-azure-devops --json nameWithOwner 2>$null
if (-not $forkExists) {
  gh repo fork karlosmiguell/atividade-azure-devops --clone=false --remote=false
}
git remote rename origin upstream
git remote add origin https://github.com/Fredaoo22/atividade-azure-devops.git
git remote -v
```

Expected: `origin` points to `Fredaoo22/atividade-azure-devops` and `upstream` points to `karlosmiguell/atividade-azure-devops`.

---

### Task 2: Validação automatizada da aplicação

**Files:**
- Modify: `app/package.json`
- Create: `app/test.js`

**Interfaces:**
- Consumes: HTTP server exported by running `node index.js`
- Produces: `npm test`, which exits `0` only when `/` returns HTTP 200 and contains `Atividade DevOps & Cloud`

- [ ] **Step 1: Add the npm test script**

Update `app/package.json` so its scripts object is:

```json
"scripts": {
  "start": "node index.js",
  "test": "node test.js"
}
```

- [ ] **Step 2: Write the smoke test**

Create `app/test.js` with:

```javascript
const { spawn } = require('node:child_process');
const http = require('node:http');

const port = 18080;
const server = spawn(process.execPath, ['index.js'], {
  cwd: __dirname,
  env: { ...process.env, PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
});

const stop = (code, message) => {
  server.kill();
  if (message) console.error(message);
  process.exit(code);
};

const verify = (attempt = 0) => {
  http.get(`http://127.0.0.1:${port}/`, (response) => {
    let body = '';
    response.setEncoding('utf8');
    response.on('data', (chunk) => { body += chunk; });
    response.on('end', () => {
      const valid = response.statusCode === 200 && body.includes('Atividade DevOps & Cloud');
      stop(valid ? 0 : 1, valid ? '' : 'A página inicial não passou na validação.');
    });
  }).on('error', () => {
    if (attempt < 20) return setTimeout(() => verify(attempt + 1), 250);
    stop(1, 'A aplicação não iniciou dentro do tempo esperado.');
  });
};

server.on('exit', (code) => {
  if (code && code !== 0) stop(1, `O servidor encerrou com código ${code}.`);
});

setTimeout(verify, 250);
setTimeout(() => stop(1, 'Tempo limite da validação excedido.'), 10000).unref();
```

- [ ] **Step 3: Install dependencies and verify the test**

Run:

```powershell
Push-Location app
npm install
npm test
Pop-Location
```

Expected: `npm test` exits with code `0`.

- [ ] **Step 4: Commit the initial pipeline-ready application**

Run:

```powershell
git add app/package.json app/package-lock.json app/test.js docs/superpowers
git commit -m "test: add deployment smoke validation"
git push -u origin cp03-azure-devops
```

Expected: the commit appears in the fork's `cp03-azure-devops` branch while the existing `main` branch remains unchanged.

---

### Task 3: Autenticação Azure e infraestrutura gratuita

**Files:**
- No repository files

**Interfaces:**
- Consumes: Azure identity `mr565725@fiap.com.br`
- Produces: Resource Group `rg-cp03-fred-devops`, App Service Plan `asp-cp03-fred-devops`, Web App `cp03-fred-devops-565725`

- [ ] **Step 1: Replace the existing Azure CLI session**

Run:

```powershell
az logout
az login --use-device-code
az account show --query user.name -o tsv
```

Expected: the user completes device authentication and the last command prints `mr565725@fiap.com.br`.

- [ ] **Step 2: Select the enabled subscription**

Run:

```powershell
$subscriptionId = az account list --query "[?state=='Enabled'] | [0].id" -o tsv
if (-not $subscriptionId) { throw 'Nenhuma assinatura Azure habilitada foi encontrada.' }
az account set --subscription $subscriptionId
az account show --query "{name:name,id:id,user:user.name}" -o table
```

Expected: one enabled subscription owned or accessible by `mr565725@fiap.com.br` is selected.

- [ ] **Step 3: Confirm the globally unique Web App name**

Run:

```powershell
$webAppName = 'cp03-fred-devops-565725'
$available = az webapp list --query "[?name=='$webAppName'] | length(@)" -o tsv
if ($available -ne '0') { throw 'O nome previsto já existe nesta assinatura; verificar se é o recurso da atividade antes de continuar.' }
```

Expected: the command confirms no conflicting Web App in the selected subscription.

- [ ] **Step 4: Create the free Linux resources**

Run:

```powershell
az group create --name rg-cp03-fred-devops --location brazilsouth
az appservice plan create --name asp-cp03-fred-devops --resource-group rg-cp03-fred-devops --location brazilsouth --is-linux --sku F1
az webapp create --name cp03-fred-devops-565725 --resource-group rg-cp03-fred-devops --plan asp-cp03-fred-devops --runtime "NODE:22-lts"
az webapp config set --name cp03-fred-devops-565725 --resource-group rg-cp03-fred-devops --startup-file "npm start"
```

Expected: all commands succeed and no paid SKU is created.

- [ ] **Step 5: Verify the resource URL before deployment**

Run:

```powershell
az webapp show --name cp03-fred-devops-565725 --resource-group rg-cp03-fred-devops --query "{name:name,host:defaultHostName,state:state}" -o table
```

Expected: state is `Running` and host is `cp03-fred-devops-565725.azurewebsites.net`.

---

### Task 4: Azure DevOps organization, project and professor access

**Files:**
- No repository files

**Interfaces:**
- Consumes: Azure DevOps identity `mr565725@fiap.com.br`
- Produces: an Azure DevOps organization URL and project `cp03-fred-devops`; user `pf2488@fiap.com.br` with Basic access

- [ ] **Step 1: Open Azure DevOps and create or select the organization**

Open `https://aex.dev.azure.com/me` in a visible browser and sign in as `mr565725@fiap.com.br`. Reuse an existing organization owned by the account when available; otherwise create one whose generated name is based on `mr565725`.

Expected: the browser reaches `https://dev.azure.com/<organization>` with the FIAP account shown as the active identity.

- [ ] **Step 2: Install the Azure DevOps CLI extension and configure defaults**

Run after recording the returned organization URL:

```powershell
az extension add --name azure-devops
az devops configure --defaults organization=$adoOrgUrl project=cp03-fred-devops
```

Expected: `az devops configure --list` shows the selected organization and project name.

- [ ] **Step 3: Create or reuse the project**

Run:

```powershell
$project = az devops project show --project cp03-fred-devops --organization $adoOrgUrl 2>$null
if (-not $project) {
  az devops project create --name cp03-fred-devops --organization $adoOrgUrl --visibility private --source-control git --process Agile
}
az devops project show --project cp03-fred-devops --organization $adoOrgUrl --query "{name:name,url:url,state:state}" -o table
```

Expected: project state is `wellFormed`.

- [ ] **Step 4: Invite the professor with Basic access**

Run:

```powershell
$orgName = ([uri]$adoOrgUrl).Segments[-1].TrimEnd('/')
az devops user add --email-id pf2488@fiap.com.br --license-type express --send-email-invite true --organization $adoOrgUrl
az devops user update --user pf2488@fiap.com.br --license-type express --organization $adoOrgUrl
az devops user show --user pf2488@fiap.com.br --organization $adoOrgUrl --query "{mail:user.mailAddress,license:accessLevel.licenseDisplayName,status:accessLevel.status}" -o table
```

Expected: email is `pf2488@fiap.com.br`, license is `Basic`, and status is not rejected.

---

### Task 5: GitHub connection and classic Build Pipeline

**Files:**
- No repository files; classic definition stored in Azure DevOps

**Interfaces:**
- Consumes: fork `Fredaoo22/atividade-azure-devops`
- Produces: classic build definition `cp03-build`, CI trigger on `cp03-azure-devops`, artifact `drop/app.zip`

- [ ] **Step 1: Connect the GitHub repository**

In Azure DevOps, open Project Settings → Service connections → New service connection → GitHub, choose GitHub OAuth, authorize the logged-in `Fredaoo22` account, name the connection `github-fredaoo22`, and grant it to the `cp03-fred-devops` project.

Expected: the service connection reports `Verified` and can list `Fredaoo22/atividade-azure-devops`.

- [ ] **Step 2: Create the classic build definition**

In Pipelines → New pipeline, select `Use the classic editor`, GitHub as source, the `github-fredaoo22` connection, repository `Fredaoo22/atividade-azure-devops`, branch `cp03-azure-devops`, and `Empty job`. Name the definition `cp03-build`.

Expected: the Tasks tab displays an agent job using the self-hosted `cp03-local-agent` from the `Default` pool, because the new organization does not yet have a Microsoft-hosted parallel job grant.

- [ ] **Step 3: Configure the build tasks**

Add these tasks in order:

1. `Node.js tool installer`: version spec `24.x`.
2. `npm`: command `install`, working folder `$(Build.SourcesDirectory)/app`.
3. `npm`: custom command `test`, working folder `$(Build.SourcesDirectory)/app`.
4. `Archive files`: root folder `$(Build.SourcesDirectory)/app`, exclude root folder, archive type `zip`, archive file `$(Build.ArtifactStagingDirectory)/app.zip`, replace existing archive.
5. `Publish build artifacts`: path `$(Build.ArtifactStagingDirectory)`, artifact name `drop`, location `Azure Pipelines`.

Expected: saving the definition succeeds with no YAML file created.

- [ ] **Step 4: Enable continuous integration**

In the Triggers tab, enable Continuous integration and include the branch filter `cp03-azure-devops`.

Expected: the definition shows an enabled CI trigger for `cp03-azure-devops`.

- [ ] **Step 5: Queue and verify the initial build**

Select Save & queue and monitor all five tasks.

Expected: result `Succeeded`; artifact explorer contains `drop/app.zip`.

---

### Task 6: Azure Service Connection and classic Release Pipeline

**Files:**
- No repository files; service endpoint and release definition stored in Azure DevOps

**Interfaces:**
- Consumes: selected Azure subscription, `rg-cp03-fred-devops`, artifact from `cp03-build`
- Produces: service connection `azure-cp03`, classic release definition `cp03-release`

- [ ] **Step 1: Create the Azure Resource Manager connection**

In Project Settings → Service connections → New service connection → Azure Resource Manager, choose the automatic workload identity federation option, select the active subscription and Resource Group `rg-cp03-fred-devops`, name it `azure-cp03`, and save.

Expected: Verify succeeds and the connection is scoped to `rg-cp03-fred-devops`.

- [ ] **Step 2: Create the classic release definition**

In Pipelines → Releases → New pipeline, choose `Empty job`, rename the stage `Production`, rename the definition `cp03-release`, and add artifact source type `Build` with definition `cp03-build`, default version `Latest`, and source alias `_cp03-build`.

Expected: the artifact card is connected to the Production stage.

- [ ] **Step 3: Configure the production deployment task**

Add `Azure App Service deploy` to the Production agent job with:

- Connection type: `Azure Resource Manager`.
- Azure subscription: `azure-cp03`.
- App type: `Web App on Linux`.
- App Service name: `cp03-fred-devops-565725`.
- Package or folder: `$(System.DefaultWorkingDirectory)/_cp03-build/drop/app.zip`.
- Startup command: `npm start` when the task exposes this field.

Expected: Save succeeds and task validation reports no missing required input.

- [ ] **Step 4: Enable continuous deployment**

Open the artifact's lightning-bolt trigger and enable Continuous deployment trigger for the `cp03-azure-devops` branch build.

Expected: a new successful `cp03-build` artifact automatically creates a release.

---

### Task 7: First pipeline deployment

**Files:**
- No repository files

**Interfaces:**
- Consumes: latest successful `cp03-build` artifact
- Produces: first successful release and working public page

- [ ] **Step 1: Create the first release from the existing artifact**

Use Create release → latest `cp03-build` artifact → Create.

Expected: the Production deployment succeeds through the Azure App Service deploy task.

- [ ] **Step 2: Validate the public page**

Run:

```powershell
$response = Invoke-WebRequest -UseBasicParsing https://cp03-fred-devops-565725.azurewebsites.net
if ($response.StatusCode -ne 200 -or $response.Content -notmatch 'Atividade DevOps & Cloud') {
  throw 'A primeira publicação não respondeu com o conteúdo esperado.'
}
```

Expected: no exception and HTTP status `200`.

---

### Task 8: Required visual change and automatic redeployment

**Files:**
- Modify: `app/index.js`

**Interfaces:**
- Consumes: working GitHub → Build → Artifact → Release flow
- Produces: public page containing `Deploy realizado com sucesso pelo Azure DevOps`

- [ ] **Step 1: Make the required visual change**

Replace the first paragraph inside `.container` with:

```html
<p class="success-message">Deploy realizado com sucesso pelo Azure DevOps</p>
```

Add this CSS immediately after the existing `p` rule:

```css
.success-message {
    color: #ffffff;
    font-size: 1.25em;
    font-weight: 700;
}
```

- [ ] **Step 2: Run the validation**

Run:

```powershell
Push-Location app
npm test
Pop-Location
```

Expected: `npm test` exits with code `0`.

- [ ] **Step 3: Commit and push the visual change**

Run:

```powershell
git add app/index.js
git commit -m "feat: confirm Azure DevOps deployment"
git push origin cp03-azure-devops
```

Expected: no manual build or release is queued; GitHub push triggers both automatically.

- [ ] **Step 4: Verify automatic build and release**

Observe the build reason as Continuous integration and the release reason as Continuous deployment.

Expected: both finish with `Succeeded`.

- [ ] **Step 5: Validate the updated public page**

Run:

```powershell
$expected = 'Deploy realizado com sucesso pelo Azure DevOps'
$response = Invoke-WebRequest -UseBasicParsing https://cp03-fred-devops-565725.azurewebsites.net
if ($response.StatusCode -ne 200 -or $response.Content -notmatch [regex]::Escape($expected)) {
  throw 'A alteração obrigatória ainda não está publicada.'
}
```

Expected: no exception and the required message is present.

---

### Task 9: Evidence and submission package

**Files:**
- Create: `ENTREGA.md`

**Interfaces:**
- Consumes: final GitHub, Azure DevOps and Azure resources
- Produces: exact submission links and evidence checklist

- [ ] **Step 1: Record the final links**

Create `ENTREGA.md` containing the resolved URLs for:

- `https://github.com/Fredaoo22/atividade-azure-devops`
- Azure DevOps project;
- `cp03-build` pipeline;
- Azure App Service resource;
- `https://cp03-fred-devops-565725.azurewebsites.net`.

- [ ] **Step 2: Capture the required evidence**

Capture readable images of:

1. classic build editor;
2. build task list;
3. successful build execution;
4. `drop/app.zip` artifact;
5. `azure-cp03` service connection;
6. successful `cp03-release` deployment;
7. updated public page;
8. `pf2488@fiap.com.br` with Basic access.

Expected: each image clearly shows the resource name and success state.

- [ ] **Step 3: Commit the delivery checklist**

Run:

```powershell
git add ENTREGA.md
git commit -m "docs: add CP03 delivery links"
git push origin cp03-azure-devops
```

Expected: the documentation push also triggers a successful build and release, confirming repeatability.
