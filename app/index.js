const appInsights = require('applicationinsights');

// Configuração do Application Insights
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
const port = process.env.PORT || 8080;

// Configuração do Banco de Dados (Os alunos devem preencher as variáveis no Azure WebApp)
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER, // Ex: meuserver.database.windows.net
    database: process.env.DB_NAME,
    options: {
        encrypt: true, // Necessário para Azure SQL
        trustServerCertificate: false
    }
};

app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Biblioteca Aurora | Azure DevOps</title>
        <style>
            body {
                background: radial-gradient(circle at top, #54243a 0%, #21131c 48%, #0f0b0e 100%);
                color: #fff8e8;
                font-family: Georgia, 'Times New Roman', serif;
                margin: 0;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100vh;
                text-align: center;
            }
            .container {
                background: rgba(30, 18, 25, 0.92);
                padding: 48px;
                border-radius: 18px;
                box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
                border: 1px solid rgba(222, 184, 92, 0.45);
                border-top: 6px solid #deb85c;
                max-width: 650px;
            }
            h1 {
                color: #f0ca70;
                margin-top: 0;
                font-size: 2.7rem;
                letter-spacing: 0.04em;
            }
            p {
                font-size: 1.1em;
                line-height: 1.5;
                color: #e8ddcf;
                font-family: 'Segoe UI', Tahoma, sans-serif;
            }
            .btn {
                display: inline-block;
                margin-top: 20px;
                padding: 12px 24px;
                background-color: #deb85c;
                color: #24151d;
                text-decoration: none;
                border-radius: 999px;
                font-weight: bold;
                font-family: 'Segoe UI', Tahoma, sans-serif;
                transition: transform 0.2s, background-color 0.2s;
            }
            .btn:hover {
                background-color: #f0ca70;
                transform: translateY(-2px);
            }
            .badge {
                display: inline-block;
                background-color: #2c765d;
                color: #ffffff;
                padding: 6px 12px;
                border-radius: 999px;
                font-size: 0.9em;
                margin-bottom: 15px;
                font-family: 'Segoe UI', Tahoma, sans-serif;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="badge">Azure DevOps • aplicação online</div>
            <h1>Biblioteca Aurora</h1>
            <p>Um acervo brasileiro conectado ao Azure SQL e publicado automaticamente pelo GitHub Actions.</p>
            <p>O Application Insights acompanha a saúde e o desempenho desta aplicação Node.js.</p>
            <a href="/tema" class="btn">📚 Consultar o acervo</a>
        </div>
    </body>
    </html>
    `);
});

app.get('/tema', async (req, res) => {
    try {
        // ALUNOS: Usem a configuração dbConfig para conectar no banco e fazer o SELECT na tabela do tema escolhido!
        await sql.connect(dbConfig);
        const result = await sql.query`
            SELECT Id, Titulo, Autor, AnoPublicacao
            FROM dbo.Livros
            ORDER BY Id
        `;
        
        res.json(result.recordset);
    } catch (err) {
        console.error("Erro ao conectar no banco:", err);
        res.status(500).send("Erro ao buscar os dados: " + err.message);
    }
});

app.listen(port, () => {
    console.log(`Server rodando na porta ${port}`);
});
