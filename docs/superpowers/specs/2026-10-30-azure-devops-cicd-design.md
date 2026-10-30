# CP03 Azure DevOps CI/CD — Design

## Objetivo

Publicar automaticamente a aplicação Node.js do repositório GitHub do aluno em um Azure App Service por meio de pipelines clássicas de Build e Release do Azure DevOps, comprovando que uma alteração enviada ao GitHub chega à aplicação pública sem deploy manual.

## Identidades e nomes

- GitHub: conta `fredsousa675`.
- Azure e Azure DevOps: conta `mr565725@fiap.com.br`.
- Repositório de origem: `karlosmiguell/atividade-azure-devops`.
- Nome preferencial do projeto Azure DevOps: `cp03-fred-devops`.
- Os nomes de Resource Group, App Service Plan e App Service usarão o prefixo `cp03-fred-devops`, com um sufixo curto apenas quando necessário para garantir unicidade global.
- Professor convidado: `pf2488@fiap.com.br`, com nível de acesso `Basic`.

## Arquitetura

O código ficará em um fork público do GitHub. Uma Build Pipeline criada no Editor Clássico do Azure DevOps será vinculada ao fork e executada automaticamente a cada push na branch principal. A build configurará Node.js, instalará dependências, validará a aplicação, preparará um pacote e publicará um artifact.

Uma Release Pipeline clássica consumirá o artifact da build. Seu gatilho de implantação contínua iniciará um release quando um novo artifact for publicado. O estágio de produção usará uma Service Connection baseada na assinatura Azure da conta FIAP para publicar o pacote em um Azure App Service Linux.

## Fluxo de entrega

1. Criar o fork na conta `fredsousa675` e torná-lo a origem do clone local.
2. Criar ou selecionar uma organização Azure DevOps pertencente à conta `mr565725@fiap.com.br`.
3. Criar o projeto `cp03-fred-devops`.
4. Criar a Build Pipeline pelo Editor Clássico e conectá-la ao fork GitHub.
5. Configurar tarefas de Node.js, instalação, validação, empacotamento e publicação do artifact.
6. Ativar o gatilho de integração contínua para a branch principal.
7. Criar Resource Group, App Service Plan Linux e App Service Node.js na assinatura ativa.
8. Criar a Service Connection entre Azure DevOps e Azure.
9. Criar a Release Pipeline clássica, vinculá-la ao artifact e configurar a tarefa de Azure App Service Deploy.
10. Ativar o gatilho de implantação contínua e executar o primeiro fluxo completo.
11. Alterar a página para exibir `Deploy realizado com sucesso pelo Azure DevOps`, enviar um novo push e validar que a atualização foi publicada automaticamente.
12. Convidar `pf2488@fiap.com.br` para a organização/projeto e confirmar o acesso `Basic`.

## Build clássico

A build executará em agente hospedado pelo Azure DevOps e terá, no mínimo:

- seleção de uma versão Node.js compatível com a aplicação;
- `npm install` dentro de `app`;
- validação por teste automatizado ou verificação equivalente reproduzível;
- preparação de todos os arquivos necessários para execução;
- criação de pacote de deploy;
- publicação de artifact com nome estável, preferencialmente `drop`.

A validação deve falhar quando a rota principal não puder ser carregada ou quando a aplicação não iniciar corretamente. Qualquer arquivo de teste acrescentado ao repositório será pequeno e focado nessa verificação.

## Infraestrutura Azure

O App Service será Linux e executará uma versão LTS do Node.js suportada pela assinatura. O plano usará o menor SKU disponível que permita concluir a atividade. A aplicação deverá responder publicamente por HTTPS em `https://<nome>.azurewebsites.net`.

Não será criado Azure SQL porque o desafio avalia a página principal e a esteira CI/CD; a rota opcional `/tema` não fará parte da validação de deploy.

## Automação e segurança

- Não será usado deploy manual pelo Portal Azure.
- A primeira e a segunda publicação ocorrerão pela Release Pipeline.
- Segredos, tokens, publish profiles e credenciais não serão commitados.
- A Service Connection terá somente o escopo necessário para o Resource Group da atividade quando o Azure DevOps permitir esse recorte.

## Validação

O trabalho será considerado concluído quando:

- um push na branch principal iniciar automaticamente a build;
- a build concluir e publicar o artifact;
- um release for iniciado automaticamente a partir desse artifact;
- o release publicar no App Service com sucesso;
- a URL pública exibir a mensagem alterada;
- o professor constar com acesso Basic;
- os links e as evidências visuais exigidos na atividade estiverem identificados.

## Evidências

Serão coletados ou deixados prontos para captura:

- Pipeline criada no Editor Clássico;
- lista de tarefas da build;
- execução bem-sucedida da build;
- artifact publicado;
- Service Connection;
- release/deploy bem-sucedido;
- página pública atualizada;
- professor com acesso Basic;
- links do GitHub, projeto Azure DevOps, pipeline, App Service e URL pública.
