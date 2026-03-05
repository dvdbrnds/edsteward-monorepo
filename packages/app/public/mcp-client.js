/**
 * MCP Engine Client Integration for EdSteward
 * Simple WebSocket client that connects to MCP Engine and shows regulation updates
 */

(function() {
    let ws = null;
    let connectionStatus = 'disconnected';
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const reconnectDelay = 3000;

    // Status indicator functions (disabled to prevent overlap with React component)
    function createStatusIndicator() {
        // Return null - status is now handled by React WebSocketStatus component
        return null;
    }

    // Update status indicator (disabled)
    function updateStatusIndicator(indicator, status) {
        // Status updates now handled by React WebSocketStatus component
        console.log('MCP Engine status:', status);
    }

    // Show toast notification
    function showToast(title, message, type = 'info') {
        // Create toast element
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#007bff'};
            color: white;
            padding: 16px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10001;
            max-width: 400px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            animation: slideIn 0.3s ease-out;
        `;

        toast.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 4px;">${title}</div>
            <div style="font-size: 14px; opacity: 0.9;">${message}</div>
        `;

        // Add animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(toast);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 5000);

        // Click to dismiss
        toast.addEventListener('click', () => {
            toast.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        });
    }

    // Connect to MCP Engine
    function connect() {
        if (ws && ws.readyState === WebSocket.OPEN) {
            return;
        }

        connectionStatus = 'connecting';
        const indicator = document.getElementById('mcp-status-indicator');
        if (indicator) updateStatusIndicator(indicator, 'connecting');

        console.log('🔗 Connecting to MCP Engine...');

        ws = new WebSocket('ws://localhost:3051/regulation-updates');

        ws.onopen = function() {
            connectionStatus = 'connected';
            const wasReconnecting = reconnectAttempts > 0;
            reconnectAttempts = 0;
            const indicator = document.getElementById('mcp-status-indicator');
            if (indicator) updateStatusIndicator(indicator, 'connected');

            console.log('✅ Connected to MCP Engine');
            // Toast disabled - MCP connection status is shown in UI badge instead

            // Subscribe to REG-66
            const subscribeMessage = {
                type: 'subscribe',
                regulationIds: ['REG-66']
            };
            ws.send(JSON.stringify(subscribeMessage));
            console.log('📋 Subscribed to REG-66 updates');
        };

        ws.onmessage = function(event) {
            try {
                const message = JSON.parse(event.data);
                console.log('📥 MCP Engine message:', message);

                switch(message.type) {
                    case 'connected':
                        console.log('🎯 MCP Engine client ID:', message.clientId);
                        break;
                    
                    case 'subscription_confirmed':
                        console.log('✅ Subscribed to regulations:', message.regulationIds);
                        break;
                    
                    case 'regulation_updated':
                        console.log('🚨 REGULATION UPDATE:', message);
                        // Toast and refresh prompt disabled - updates are handled silently
                        // The React app's query invalidation will refresh data automatically
                        break;
                    
                    default:
                        console.log('📋 Unknown message type:', message.type);
                }
            } catch (error) {
                console.error('❌ Failed to parse MCP Engine message:', error);
            }
        };

        ws.onclose = function(_event) {
            connectionStatus = 'disconnected';
            const indicator = document.getElementById('mcp-status-indicator');
            if (indicator) updateStatusIndicator(indicator, 'disconnected');

            console.log('📴 Disconnected from MCP Engine');

            // Attempt to reconnect
            if (reconnectAttempts < maxReconnectAttempts) {
                reconnectAttempts++;
                console.log(`🔄 Reconnecting in ${reconnectDelay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
                setTimeout(connect, reconnectDelay);
            } else {
                console.log('❌ Max reconnection attempts reached');
                // Toast disabled - MCP connection status is shown in UI badge instead
            }
        };

        ws.onerror = function(error) {
            connectionStatus = 'error';
            const indicator = document.getElementById('mcp-status-indicator');
            if (indicator) updateStatusIndicator(indicator, 'error');

            console.error('❌ MCP Engine WebSocket error:', error);
        };
    }

    // Initialize when page loads
    function initialize() {
        console.log('🚀 Initializing MCP Engine client...');
        
        // Create status indicator
        createStatusIndicator();
        
        // Connect to MCP Engine
        connect();
        
        // Add global function for manual connection
        window.mcpConnect = connect;
        window.mcpStatus = () => connectionStatus;
    }

    // Wait for page to load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

})();
