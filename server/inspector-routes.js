/**
 * MCP Inspector API Routes
 */
const express = require('express');
const router = express.Router();
const inspectorController = require('./inspector-controller');

// Routes for inspector operations
router.post('/launch', inspectorController.launchInspector);
router.get('/status/:processId', inspectorController.getInspectorStatus);
router.get('/output/:serverId', inspectorController.getInspectorOutput);
router.delete('/terminate/:processId', inspectorController.terminateInspector);

module.exports = router;