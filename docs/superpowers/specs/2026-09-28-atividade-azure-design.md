# Atividade Azure — Design da Solução

## Objetivo

Entregar uma aplicação Node.js publicada no Azure Web App, integrada ao Azure SQL e ao Application Insights, com deploy automático pelo GitHub Actions e evidências reunidas em PDF.

## Escopo mínimo

- Tema: Biblioteca/Livros.
- Uma tabela `dbo.Livros` com cinco registros personalizados.
- Rota `/tema` retornando os registros em JSON.
- Página inicial com uma alteração visual clara feita em um segundo commit.
- Infraestrutura criada por Azure CLI em um Resource Group exclusivo.
- Pipeline acionado por push na branch `main`.

## Arquitetura e fluxo

```text
Integrantes -- commit/push --> GitHub Repository
GitHub Repository -- push na main --> GitHub Actions
GitHub Actions -- publish profile --> Azure Web App (Node.js 22)
Navegador -- HTTPS / e /tema --> Azure Web App
Azure Web App -- SELECT criptografado --> Azure SQL Database
Azure Web App -- telemetria --> Application Insights + Log Analytics
Azure CLI -- provisiona --> Resource Group da atividade
```

## Recursos

Todos os recursos novos ficarão em `rg-biblioteca-260928`, na região `brazilsouth`. O Resource Group antigo `rg-avocato-toast-cp4` não será alterado.

| Recurso | Nome |
| --- | --- |
| Resource Group | `rg-biblioteca-260928` |
| Azure SQL Server | `sql-biblioteca-89733` |
| Azure SQL Database | `db-biblioteca` |
| App Service Plan F1 Windows | `plan-biblioteca-260928` |
| Azure Web App | `web-biblioteca-89733` |
| Application Insights | `appi-biblioteca-260928` |
| Log Analytics Workspace | `law-biblioteca-260928` |

Os nomes globais do SQL Server e do Web App serão validados durante a criação. Caso algum já exista, somente o sufixo numérico será alterado.

## Banco de dados

A tabela terá as colunas `Id`, `Titulo`, `Autor` e `AnoPublicacao`. `Id` será chave primária `IDENTITY`; os campos textuais usarão `NVARCHAR` para preservar acentos. A senha administrativa será digitada pela usuária, usada nas configurações protegidas do Web App e nunca registrada no Git ou no PDF.

## Aplicação

O fork de `karlosmiguell/atividade-azure-devops` será mantido com a estrutura existente. A consulta placeholder da rota `/tema` será substituída por uma consulta explícita a `dbo.Livros`, ordenada por `Id`. Como a atividade exige plano Windows, será incluído `web.config` para encaminhar as requisições ao processo Node/IISNode.

## CI/CD

O workflow existente será ajustado com o nome real `web-biblioteca-89733`. O GitHub receberá o secret `AZURE_WEBAPP_PUBLISH_PROFILE`. Como Web Apps novos desabilitam autenticação básica por padrão, o Web App será criado com SCM basic auth habilitada para que o workflow didático baseado em publish profile funcione.

## Configuração e segurança

O Web App receberá `DB_SERVER`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` e `APPLICATIONINSIGHTS_CONNECTION_STRING`. O Log Analytics Workspace será criado explicitamente no mesmo Resource Group para que nenhum grupo auxiliar permaneça após a exclusão. Nenhum segredo será versionado ou exibido nos prints. A regra ampla de firewall solicitada pelo enunciado existirá apenas durante a atividade. O novo Resource Group será excluído após a coleta das evidências e a submissão.

## Tratamento de erros

A rota `/tema` manterá resposta HTTP 500 em falhas de conexão/consulta. Antes dos prints finais serão verificados o status do Web App, o JSON com cinco registros, a execução verde do pipeline e a chegada de telemetria ao Application Insights.

## Evidências e validação

1. Diagrama da arquitetura.
2. Resultado SQL contendo os cinco livros.
3. Pipeline verde.
4. Application Insights recebendo requisições.
5. Web App respondendo em `/tema`.
6. Página inicial após a alteração visual entregue pelo segundo push.
7. PDF contendo integrantes, comandos executados e todos os prints.
