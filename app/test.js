const { spawn } = require('node:child_process');
const http = require('node:http');

const port = 18080;
const server = spawn(process.execPath, ['index.js'], {
    cwd: __dirname,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
});

let finished = false;

const stop = (code, message = '') => {
    if (finished) return;
    finished = true;
    server.kill();
    if (message) console.error(message);
    process.exit(code);
};

const verify = (attempt = 0) => {
    http.get(`http://127.0.0.1:${port}/`, (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
            body += chunk;
        });
        response.on('end', () => {
            const valid = response.statusCode === 200
                && body.includes('Atividade DevOps & Cloud');

            stop(
                valid ? 0 : 1,
                valid ? '' : 'A página inicial não passou na validação.'
            );
        });
    }).on('error', () => {
        if (attempt < 20) {
            setTimeout(() => verify(attempt + 1), 250);
            return;
        }

        stop(1, 'A aplicação não iniciou dentro do tempo esperado.');
    });
};

server.on('exit', (code) => {
    if (!finished && code && code !== 0) {
        stop(1, `O servidor encerrou com código ${code}.`);
    }
});

setTimeout(verify, 250);
setTimeout(
    () => stop(1, 'Tempo limite da validação excedido.'),
    10000
).unref();
