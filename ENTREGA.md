# CP03 — Azure DevOps Pipeline

## Links da entrega

- Repositório GitHub: https://github.com/Fredaoo22/atividade-azure-devops
- Branch usada pela esteira: https://github.com/Fredaoo22/atividade-azure-devops/tree/cp03-azure-devops
- Projeto Azure DevOps: https://dev.azure.com/mr565725-cp03/cp03-fred-devops
- Build Pipeline clássica: https://dev.azure.com/mr565725-cp03/cp03-fred-devops/_build?definitionId=1
- Release Pipeline clássica: https://dev.azure.com/mr565725-cp03/cp03-fred-devops/_release?_a=releases&view=mine&definitionId=1
- Service Connection: https://dev.azure.com/mr565725-cp03/cp03-fred-devops/_settings/adminservices?resourceId=79d3a9fd-aa80-4cc8-9357-0d0994dba1b2
- Azure App Service: https://portal.azure.com/#resource/subscriptions/9d6a706e-3d42-41d9-8858-09cf8e76c7b9/resourceGroups/rg-cp03-fred-devops/providers/Microsoft.Web/sites/cp03-fred-devops-565725/overview
- Aplicação pública: https://cp03-fred-devops-565725.azurewebsites.net
- Usuários da organização: https://dev.azure.com/mr565725-cp03/_settings/users

## Configuração comprovada

- Build clássica `cp03-build`, com gatilho CI na branch `cp03-azure-devops`.
- Tasks: Node.js 24.x, `npm install`, `npm test`, criação de `app.zip` e publicação do Artifact `drop`.
- Release clássica `cp03-release`, com gatilho de implantação contínua a partir do Artifact da Build.
- Deploy para o App Service Linux `cp03-fred-devops-565725` pelo Service Connection `azure-cp03`.
- Recursos Azure criados em Chile Central no Resource Group `rg-cp03-fred-devops`.
- Professor `pf2488@fiap.com.br` convidado com licença Basic e adicionado ao projeto.

## Checklist de prints

- [ ] Pipeline criada no Editor Clássico.
- [ ] Tasks da Build configuradas.
- [ ] Execução bem-sucedida da Build automática mais recente.
- [ ] Artifact `drop/app.zip` gerado.
- [ ] Service Connection `azure-cp03`.
- [ ] Release automática bem-sucedida mais recente.
- [ ] Página pública mostrando “Deploy realizado com sucesso pelo Azure DevOps”.
- [ ] Professor na lista de usuários com acesso Basic.
