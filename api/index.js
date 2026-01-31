"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.wss = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = require("http");
const ws_1 = require("ws");
const sessions_1 = require("./routes/sessions");
const files_1 = require("./routes/files");
const payments_1 = require("./routes/payments");
const printJobs_1 = require("./routes/printJobs");
const errorHandler_1 = require("./middleware/errorHandler");
const CustomerWorkflowService_1 = require("./services/CustomerWorkflowService");
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const wss = new ws_1.WebSocketServer({ server });
exports.wss = wss;
// Initialize workflow service
const workflowService = new CustomerWorkflowService_1.CustomerWorkflowService();
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.static('dist/client'));
// Set WebSocket server for print job routes
(0, printJobs_1.setWebSocketServer)(wss);
// Routes
app.use('/api/sessions', sessions_1.sessionRoutes);
app.use('/api/files', files_1.fileRoutes);
app.use('/api/payments', payments_1.paymentRoutes);
app.use('/api/print-jobs', printJobs_1.printJobRoutes);
// WebSocket handling
wss.on('connection', (ws, request) => {
    console.log('New WebSocket connection');
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            console.log('Received WebSocket message:', data);
            // Handle different message types
            switch (data.type) {
                case 'join-session':
                    // Join session room for updates
                    ws.sessionId = data.sessionId;
                    console.log(`Client joined session: ${data.sessionId}`);
                    break;
                case 'local-agent-connected':
                    // Local Agent connected
                    console.log('Local Agent connected:', data.data);
                    workflowService.setLocalAgentConnection(true);
                    break;
                case 'print-job-status-update':
                    // Forward print job status updates to session clients
                    broadcastToSession(data.sessionId, {
                        type: 'print-status-update',
                        jobId: data.jobId,
                        status: data.data.status,
                        progress: data.data.progress,
                        message: data.data.message,
                        error: data.data.error,
                        timestamp: data.timestamp
                    });
                    break;
                case 'session-status':
                    // Forward session status updates
                    broadcastToSession(data.sessionId, {
                        type: 'session-status-update',
                        status: data.data.status,
                        timestamp: data.timestamp
                    });
                    break;
                case 'printer-status':
                    // Broadcast printer status to all connected clients
                    broadcastToAll({
                        type: 'printer-status-update',
                        status: data.data,
                        timestamp: data.timestamp
                    });
                    break;
                case 'error':
                    // Forward error messages
                    if (data.sessionId) {
                        broadcastToSession(data.sessionId, {
                            type: 'error',
                            error: data.data.error,
                            timestamp: data.timestamp
                        });
                    }
                    break;
                default:
                    console.log('Unknown message type:', data.type);
            }
        }
        catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    });
    ws.on('close', () => {
        console.log('WebSocket connection closed');
    });
});
// Helper function to broadcast to all clients in a session
function broadcastToSession(sessionId, message) {
    wss.clients.forEach((client) => {
        if (client.sessionId === sessionId && client.readyState === ws_1.WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}
// Helper function to broadcast to all clients
function broadcastToAll(message) {
    wss.clients.forEach((client) => {
        if (client.readyState === ws_1.WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}
// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Workflow monitoring endpoints
app.get('/api/workflows/metrics', (req, res) => {
    try {
        const metrics = workflowService.getWorkflowStatistics();
        res.json({
            success: true,
            data: metrics
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get workflow metrics'
        });
    }
});
app.get('/api/workflows/active', (req, res) => {
    try {
        const activeWorkflows = workflowService.getActiveWorkflows();
        res.json({
            success: true,
            data: activeWorkflows
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get active workflows'
        });
    }
});
app.get('/api/workflows/history', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const history = workflowService.getWorkflowHistory(limit);
        res.json({
            success: true,
            data: history
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get workflow history'
        });
    }
});
// Catch-all handler for client-side routing
app.get('*', (req, res) => {
    res.sendFile('index.html', { root: 'dist/client' });
});
// Error handling middleware (must be last)
app.use(errorHandler_1.notFoundHandler);
app.use(errorHandler_1.errorHandler);
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Customer System server running on port ${PORT}`);
});
//# sourceMappingURL=index.js.map