class GoogleChatsApp {
    constructor() {
        this.userData = null;
        this.peer = null;
        this.connections = new Map();
        this.activeConnection = null;
        this.connectionType = 'wifi';
        this.peerId = null;
        this.rtcManager = null;
        
        this.init();
    }

    async init() {
        await this.loadUserData();
        this.initUI();
        await this.initWebRTC();
        this.setupEventListeners();
        this.updateConnectionStatus();
    }

    async loadUserData() {
        try {
            const saved = localStorage.getItem('googleChatsUser');
            if (saved) {
                this.userData = JSON.parse(saved);
                this.updateUserAvatar();
                
                // Проверяем, первый ли запуск
                const firstLaunch = localStorage.getItem('googleChatsFirstLaunch');
                if (firstLaunch === 'true' || firstLaunch === null) {
                    this.showWelcomeMessage();
                }
            } else {
                // Если нет данных пользователя, перенаправляем на регистрацию
                window.location.href = 'index.html';
            }
        } catch (error) {
            console.error('Error loading user data:', error);
            window.location.href = 'index.html';
        }
    }

    updateUserAvatar() {
        const avatarEl = document.getElementById('userAvatar');
        if (!avatarEl || !this.userData) return;

        const initials = (
            (this.userData.firstName?.[0] || '') + 
            (this.userData.lastName?.[0] || '')
        ).toUpperCase() || 'Г';

        if (this.userData.avatar) {
            avatarEl.innerHTML = `<img src="${this.userData.avatar}" alt="Аватар">`;
        } else {
            avatarEl.innerHTML = `<span>${initials}</span>`;
            avatarEl.style.background = 'linear-gradient(135deg, #4285f4, #34a853)';
        }
    }

    initUI() {
        window.setConnectionType = (type) => {
            this.connectionType = type;
            document.getElementById('wifiBtn').classList.toggle('active', type === 'wifi');
            document.getElementById('bluetoothBtn').classList.toggle('active', type === 'bluetooth');
            this.showToast(`Тип подключения: ${type === 'wifi' ? 'Wi-Fi P2P' : 'Bluetooth'}`);
        };

        window.connectToPeer = async () => {
            const remoteId = document.getElementById('remotePeerId').value.trim();
            if (remoteId && remoteId !== this.peerId) {
                await this.connectToPeer(remoteId);
            } else {
                this.showToast('Введите корректный ID собеседника', 'error');
            }
        };

        window.disconnect = () => {
            if (this.activeConnection) {
                this.rtcManager.disconnect();
                this.activeConnection = null;
                this.updateConnectionStatus();
                this.showToast('Соединение разорвано');
            }
        };

        window.sendMessage = () => {
            const input = document.getElementById('messageInput');
            const message = input.value.trim();
            if (message && this.activeConnection) {
                this.sendMessage(message);
                input.value = '';
                input.focus();
            }
        };

        window.handleKeyDown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                window.sendMessage();
            }
        };

        window.toggleUserDropdown = () => {
            const dropdown = document.getElementById('userDropdown');
            dropdown.classList.toggle('show');
        };

        window.copyPeerId = () => {
            if (this.peerId) {
                navigator.clipboard.writeText(this.peerId);
                this.showToast('ID скопирован в буфер обмена');
            }
        };

        window.discoverPeers = () => {
            this.discoverPeers();
        };

        // Закрытие dropdown при клике вне его
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.user-avatar') && !e.target.closest('.user-dropdown')) {
                document.getElementById('userDropdown').classList.remove('show');
            }
        });

        // Устанавливаем начальный тип подключения
        setConnectionType('wifi');
    }

    async initWebRTC() {
        try {
            this.rtcManager = new WebRTCManager({
                onConnection: this.handleConnection.bind(this),
                onMessage: this.handleMessage.bind(this),
                onDisconnect: this.handleDisconnect.bind(this),
                onError: this.handleError.bind(this)
            });

            // Генерируем уникальный ID для этого сеанса
            this.peerId = 'gc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
            document.getElementById('peerIdDisplay').textContent = this.peerId;
            
            this.showToast('P2P система инициализирована', 'success');
            
            // Запускаем обнаружение устройств в локальной сети
            this.startDiscovery();
            
        } catch (error) {
            console.error('Ошибка инициализации WebRTC:', error);
            this.showToast('Ошибка инициализации P2P', 'error');
        }
    }

    async startDiscovery() {
        if (this.connectionType === 'bluetooth' && navigator.bluetooth) {
            await this.startBluetoothDiscovery();
        } else {
            // Для Wi-Fi эмулируем обнаружение в локальной сети
            this.simulateNetworkDiscovery();
        }
    }

    async startBluetoothDiscovery() {
        try {
            const device = await navigator.bluetooth.requestDevice({
                filters: [{ services: ['google_chats'] }],
                optionalServices: ['battery_service']
            });
            
            this.showToast(`Найдено устройство: ${device.name || 'Неизвестно'}`);
            
            // Здесь будет логика подключения через Web Bluetooth API
            
        } catch (error) {
            console.log('Bluetooth discovery cancelled or failed');
        }
    }

    simulateNetworkDiscovery() {
        // В реальном приложении здесь было бы сканирование локальной сети
        // Для демо симулируем обнаружение устройств
        setInterval(() => {
            if (Math.random() > 0.7 && this.connections.size < 3) {
                this.simulateDeviceDiscovery();
            }
        }, 8000);
    }

    simulateDeviceDiscovery() {
        const fakeDevices = [
            {
                id: 'gc_' + (Date.now() - 1000) + '_' + Math.random().toString(36).substr(2, 6),
                name: 'Соседнее устройство',
                avatar: null,
                description: 'Найден в локальной сети'
            }
        ];
        
        const device = fakeDevices[0];
        if (!this.connections.has(device.id)) {
            this.showToast(`Обнаружено устройство в сети: ${device.id.substring(0, 12)}`, 'info');
        }
    }

    async connectToPeer(peerId) {
        this.showToast(`Подключение к ${peerId.substring(0, 12)}...`, 'info');
        
        try {
            // Здесь был бы реальный вызов WebRTC для установления соединения
            // Для демо симулируем подключение
            
            setTimeout(() => {
                const mockPeer = {
                    id: peerId,
                    name: 'Собеседник ' + peerId.substring(0, 8),
                    avatar: null,
                    description: 'Удаленный пользователь',
                    connected: true
                };
                
                this.addPeer(mockPeer);
                this.activeConnection = mockPeer;
                this.updateConnectionStatus();
                this.updatePeerList();
                
                // Активируем поле ввода
                document.getElementById('messageInput').disabled = false;
                document.getElementById('sendBtn').disabled = false;
                
                this.showToast('Подключение установлено!', 'success');
                
                // Добавляем системное сообщение
                this.addSystemMessage(`Подключено к ${peerId.substring(0, 12)}`);
                
                // Симулируем приветственное сообщение от собеседника
                setTimeout(() => {
                    this.addMessage(mockPeer, 'Привет! Я готов к общению через P2P.', false);
                }, 1000);
                
            }, 1500);
            
        } catch (error) {
            this.showToast('Ошибка подключения: ' + error.message, 'error');
        }
    }

    addPeer(peerData) {
        this.connections.set(peerData.id, peerData);
        this.updatePeerList();
    }

    updatePeerList() {
        const peerList = document.getElementById('peerList');
        const emptyState = document.getElementById('emptyPeersState');
        const peersCount = document.getElementById('peersCount');
        
        if (this.connections.size === 0) {
            peerList.innerHTML = '';
            peerList.appendChild(emptyState);
            peersCount.textContent = '0';
            return;
        }
        
        emptyState.remove();
        peerList.innerHTML = '';
        
        this.connections.forEach((peer, id) => {
            const initials = (peer.name || 'У').substring(0, 2).toUpperCase();
            
            const li = document.createElement('li');
            li.className = `peer-item ${this.activeConnection?.id === id ? 'active' : ''}`;
            li.onclick = () => this.switchToPeer(id);
            
            li.innerHTML = `
                <div class="peer-avatar">
                    ${peer.avatar ? `<img src="${peer.avatar}" alt="${peer.name}">` : initials}
                </div>
                <div class="peer-info">
                    <div class="peer-name">${peer.name || 'Собеседник'}</div>
                    <div class="peer-id">${id.substring(0, 16)}...</div>
                </div>
                <div class="peer-status ${peer.connected ? 'connected' : ''}"></div>
            `;
            
            peerList.appendChild(li);
        });
        
        peersCount.textContent = this.connections.size.toString();
    }

    switchToPeer(peerId) {
        const peer = this.connections.get(peerId);
        if (peer) {
            this.activeConnection = peer;
            this.updateConnectionStatus();
            this.showToast(`Переключено на ${peer.name || 'собеседника'}`, 'info');
        }
    }

    sendMessage(message) {
        if (!this.activeConnection) return;
        
        // Отправляем сообщение через WebRTC
        if (this.rtcManager) {
            this.rtcManager.sendMessage(message);
        }
        
        // Добавляем сообщение в интерфейс
        this.addMessage(this.userData, message, true);
        
        // В демо-режиме симулируем ответ
        if (Math.random() > 0.3) {
            setTimeout(() => {
                const responses = [
                    'Отличное сообщение! P2P работает отлично.',
                    'Получил твое сообщение напрямую!',
                    'Это прямое подключение без серверов!',
                    'Попробуй отправить файл через это соединение',
                    'Соединение стабильное, задержка минимальная'
                ];
                const response = responses[Math.floor(Math.random() * responses.length)];
                this.addMessage(this.activeConnection, response, false);
            }, 500 + Math.random() * 1000);
        }
    }

    addMessage(sender, text, isSent) {
        const messagesContainer = document.getElementById('messagesContainer');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
        
        const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const senderName = sender.firstName ? `${sender.firstName} ${sender.lastName}` : sender.name;
        
        const initials = isSent ? 
            ((this.userData.firstName?.[0] || '') + (this.userData.lastName?.[0] || '')).toUpperCase() || 'Я' :
            (senderName.substring(0, 2).toUpperCase() || 'С');
        
        const avatarHtml = sender.avatar ? 
            `<img src="${sender.avatar}" alt="${senderName}">` : 
            `<span>${initials}</span>`;
        
        messageDiv.innerHTML = `
            ${!isSent ? `
                <div class="message-sender">
                    <div class="sender-avatar">${avatarHtml}</div>
                    <span>${senderName}</span>
                </div>
            ` : ''}
            <div class="message-bubble">${this.escapeHtml(text)}</div>
            <div class="message-time">${time}</div>
        `;
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    addSystemMessage(text) {
        const messagesContainer = document.getElementById('messagesContainer');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message received';
        messageDiv.style.opacity = '0.7';
        
        const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        messageDiv.innerHTML = `
            <div class="message-sender">
                <div class="sender-avatar">ℹ️</div>
                <span>Система</span>
            </div>
            <div class="message-bubble" style="background: #e8f0fe; color: #1a73e8;">
                ${this.escapeHtml(text)}
            </div>
            <div class="message-time">${time}</div>
        `;
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    updateConnectionStatus() {
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');
        
        if (this.activeConnection) {
            statusDot.className = 'status-dot connected';
            statusText.textContent = `Подключен к ${this.activeConnection.name || 'собеседнику'}`;
        } else {
            statusDot.className = 'status-dot';
            statusText.textContent = 'Не подключен';
        }
    }

    handleConnection(peer) {
        console.log('Новое соединение:', peer);
        this.addPeer(peer);
    }

    handleMessage(data) {
        console.log('Получено сообщение:', data);
        // Обработка входящих сообщений
    }

    handleDisconnect(peerId) {
        console.log('Отключение:', peerId);
        this.connections.delete(peerId);
        this.updatePeerList();
        
        if (this.activeConnection?.id === peerId) {
            this.activeConnection = null;
            this.updateConnectionStatus();
            document.getElementById('messageInput').disabled = true;
            document.getElementById('sendBtn').disabled = true;
        }
        
        this.showToast(`Собеседник отключился`, 'warning');
    }

    handleError(error) {
        console.error('WebRTC ошибка:', error);
        this.showToast(`Ошибка соединения: ${error.message}`, 'error');
    }

    showWelcomeMessage() {
        setTimeout(() => {
            this.addSystemMessage(`Добро пожаловать, ${this.userData.firstName}! Ваш профиль загружен.`);
            this.addSystemMessage('Для начала общения подключитесь к собеседнику через боковую панель.');
        }, 1000);
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        const toastIcon = document.getElementById('toastIcon');
        const toastMessage = document.getElementById('toastMessage');
        
        const icons = {
            info: 'info',
            success: 'check_circle',
            error: 'error',
            warning: 'warning'
        };
        
        toastIcon.textContent = icons[type] || 'info';
        toastMessage.textContent = message;
        
        toast.style.background = type === 'error' ? 'var(--google-red)' : 
                                type === 'success' ? 'var(--google-green)' : 
                                type === 'warning' ? 'var(--google-yellow)' : 
                                'var(--google-dark-grey)';
        
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML.replace(/\n/g, '<br>');
    }

    setupEventListeners() {
        // Сохранение состояния при закрытии
        window.addEventListener('beforeunload', () => {
            this.saveState();
        });
    }

    saveState() {
        // Сохраняем состояние соединений
        const state = {
            connections: Array.from(this.connections.entries()),
            activeConnectionId: this.activeConnection?.id,
            connectionType: this.connectionType
        };
        localStorage.setItem('googleChatsState', JSON.stringify(state));
    }

    loadState() {
        try {
            const saved = localStorage.getItem('googleChatsState');
            if (saved) {
                const state = JSON.parse(saved);
                // Восстанавливаем состояние
            }
        } catch (error) {
            console.error('Error loading state:', error);
        }
    }
}

// Функции для меню пользователя
function showUserProfile() {
    const userData = JSON.parse(localStorage.getItem('googleChatsUser') || '{}');
    alert(`Профиль:\n\nИмя: ${userData.firstName} ${userData.lastName}\nОписание: ${userData.description || 'Не указано'}`);
}

function showInstructions() {
    window.location.href = 'instruction.html';
}

function shareApp() {
    if (navigator.share) {
        navigator.share({
            title: 'GoogleChats - P2P Messenger',
            text: 'Попробуй GoogleChats - мессенджер с прямым P2P подключением!',
            url: window.location.href
        });
    } else {
        navigator.clipboard.writeText(window.location.href);
        alert('Ссылка скопирована в буфер обмена!');
    }
}

function clearHistory() {
    if (confirm('Очистить всю историю сообщений?')) {
        const messagesContainer = document.getElementById('messagesContainer');
        const welcomeMessage = document.getElementById('welcomeMessage');
        messagesContainer.innerHTML = '';
        if (welcomeMessage) {
            messagesContainer.appendChild(welcomeMessage);
        }
        localStorage.removeItem('googleChatsMessages');
        alert('История очищена');
    }
}

function logout() {
    if (confirm('Выйти из аккаунта?')) {
        localStorage.removeItem('googleChatsUser');
        localStorage.removeItem('googleChatsRegistered');
        localStorage.removeItem('googleChatsState');
        window.location.href = 'index.html';
    }
}

// Инициализация приложения
let app;
document.addEventListener('DOMContentLoaded', async () => {
    try {
        app = new GoogleChatsApp();
        window.app = app;
    } catch (error) {
        console.error('Failed to initialize app:', error);
        window.location.href = 'index.html';
    }
});

// Service Worker для PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('ServiceWorker зарегистрирован');
            })
            .catch(error => {
                console.log('ServiceWorker ошибка:', error);
            });
    });
}

// Установка как PWA
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    // Показываем предложение об установке через 5 секунд
    setTimeout(() => {
        if (deferredPrompt && confirm('Установить GoogleChats как приложение для быстрого доступа?')) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('Пользователь установил приложение');
                }
                deferredPrompt = null;
            });
        }
    }, 5000);
});