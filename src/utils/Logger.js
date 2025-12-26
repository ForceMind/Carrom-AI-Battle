export class Logger {
    static log(message, type = 'info') {
        const logContainer = document.getElementById('ai-logs');
        if (!logContainer) return;

        const entry = document.createElement('div');
        entry.className = `text-xs mb-1 ${this.getTypeClass(type)}`;
        const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        entry.innerHTML = `<span class="text-gray-500">[${time}]</span> ${message}`;
        
        logContainer.prepend(entry);
        
        // Keep only last 50 logs
        if (logContainer.children.length > 50) {
            logContainer.removeChild(logContainer.lastChild);
        }
    }

    static getTypeClass(type) {
        switch (type) {
            case 'ai': return 'text-blue-400';
            case 'success': return 'text-green-400';
            case 'warning': return 'text-yellow-400';
            case 'error': return 'text-red-400';
            default: return 'text-gray-300';
        }
    }

    static clear() {
        const logContainer = document.getElementById('ai-logs');
        if (logContainer) logContainer.innerHTML = '';
    }
}
