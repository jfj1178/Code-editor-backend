const express = require('express');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const pty = require('node-pty');
const Docker = require('dockerode');

const app = express();
const port = process.env.PORT || 5000;
const docker = new Docker();

app.use(express.json());

// File Operations
app.get('/api/files', (req, res) => {
    const filePath = path.join(__dirname, 'projects', req.query.path || '');
    fs.readdir(filePath, { withFileTypes: true }, (err, files) => {
        if (err) {
            return res.status(500).send(err.message);
        }
        const fileList = files.map(file => ({
            name: file.name,
            isDirectory: file.isDirectory(),
        }));
        res.json(fileList);
    });
});

app.get('/api/file', (req, res) => {
    const filePath = path.join(__dirname, 'projects', req.query.path);
    fs.readFile(filePath, 'utf-8', (err, data) => {
        if (err) {
            return res.status(500).send(err.message);
        }
        res.send(data);
    });
});

app.post('/api/file', (req, res) => {
    const filePath = path.join(__dirname, 'projects', req.body.path);
    fs.writeFile(filePath, req.body.content, (err) => {
        if (err) {
            return res.status(500).send(err.message);
        }
        res.send('File saved');
    });
});

app.post('/api/create', (req, res) => {
    const filePath = path.join(__dirname, 'projects', req.body.path);
    if (req.body.isDirectory) {
        fs.mkdir(filePath, (err) => {
            if (err) {
                return res.status(500).send(err.message);
            }
            res.send('Directory created');
        });
    } else {
        fs.writeFile(filePath, '', (err) => {
            if (err) {
                return res.status(500).send(err.message);
            }
            res.send('File created');
        });
    }
});

app.delete('/api/delete', (req, res) => {
    const filePath = path.join(__dirname, 'projects', req.query.path);
    fs.stat(filePath, (err, stats) => {
        if (err) {
            return res.status(500).send(err.message);
        }
        if (stats.isDirectory()) {
            fs.rmdir(filePath, { recursive: true }, (err) => {
                if (err) {
                    return res.status(500).send(err.message);
                }
                res.send('Directory deleted');
            });
        } else {
            fs.unlink(filePath, (err) => {
                if (err) {
                    return res.status(500).send(err.message);
                }
                res.send('File deleted');
            });
        }
    });
});

// Dockerized Terminal
const server = app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});

const wss = new WebSocket.Server({ server });

wss.on('connection', async (ws) => {
    try {
        const container = await docker.createContainer({
            Image: 'ubuntu:latest',
            Tty: true,
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
            Cmd: ['/bin/bash'],
            WorkingDir: '/workspace',
            Volumes: {
                '/workspace': {},
            },
            HostConfig: {
                Binds: [path.join(__dirname, 'projects') + ':/workspace'],
            },
        });

        await container.start();

        const ptyProcess = await container.attach({
            stream: true,
            stdin: true,
            stdout: true,
            stderr: true,
        });

        ptyProcess.on('data', (data) => {
            ws.send(data);
        });

        ws.on('message', (msg) => {
            ptyProcess.write(msg);
        });

        ws.on('close', async () => {
            await container.stop();
            await container.remove();
        });
    } catch (error) {
        console.error('Docker error:', error);
        ws.send(`Docker error: ${error.message}`);
        ws.close();
    }
});