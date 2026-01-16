class WebRTCManager {
    constructor(config = {}) {
        this.config = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ],
            ...config
        };
        
        this.peerConnection = null;
        this.dataChannel = null;
        this.onConnection = config.onConnection || (() => {});
        this.onMessage = config.onMessage || (() => {});
        this.onDisconnect = config.onDisconnect || (() => {});
        this.onError = config.onError || (() => {});
        
        this.localStream = null;
        this.remoteStream = null;
    }

    async initialize() {
        try {
            // Запрашиваем доступ к медиаустройствам
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false
            });
            
            return true;
        } catch (error) {
            console.warn('Не удалось получить доступ к микрофону:', error);
            return true; // Продолжаем без аудио
        }
    }

    async createPeerConnection() {
        this.peerConnection = new RTCPeerConnection({
            iceServers: this.config.iceServers
        });

        // Добавляем локальный поток
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });
        }

        // Обработчики событий ICE
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                // Отправляем кандидата удаленной стороне
                this.sendIceCandidate(event.candidate);
            }
        };

        this.peerConnection.oniceconnectionstatechange = () => {
            console.log('ICE состояние:', this.peerConnection.iceConnectionState);
            
            if (this.peerConnection.iceConnectionState === 'disconnected' ||
                this.peerConnection.iceConnectionState === 'failed') {
                this.handleDisconnect();
            }
        };

        // Получение удаленного потока
        this.peerConnection.ontrack = (event) => {
            this.remoteStream = event.streams[0];
            // Уведомляем о получении медиапотока
            if (this.config.onStream) {
                this.config.onStream(this.remoteStream);
            }
        };

        // Создаем канал данных
        this.createDataChannel();
    }

    createDataChannel() {
        this.dataChannel = this.peerConnection.createDataChannel('google-chats', {
            ordered: true,
            maxPacketLifeTime: 3000
        });

        this.setupDataChannel();
    }

    setupDataChannel() {
        this.dataChannel.onopen = () => {
            console.log('Data channel открыт');
            this.onConnection({
                id: 'peer_' + Date.now(),
                name: 'Удаленный пользователь',
                connected: true
            });
        };

        this.dataChannel.onclose = () => {
            console.log('Data channel закрыт');
            this.handleDisconnect();
        };

        this.dataChannel.onerror = (error) => {
            console.error('Data channel ошибка:', error);
            this.onError(error);
        };

        this.dataChannel.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.onMessage(data);
            } catch (error) {
                // Если не JSON, обрабатываем как текст
                this.onMessage({
                    type: 'text',
                    content: event.data,
                    timestamp: Date.now()
                });
            }
        };
    }

    async createOffer() {
        if (!this.peerConnection) {
            await this.createPeerConnection();
        }

        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);

        return {
            type: 'offer',
            sdp: offer.sdp
        };
    }

    async handleOffer(offer) {
        if (!this.peerConnection) {
            await this.createPeerConnection();
        }

        await this.peerConnection.setRemoteDescription(
            new RTCSessionDescription(offer)
        );

        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);

        return {
            type: 'answer',
            sdp: answer.sdp
        };
    }

    async handleAnswer(answer) {
        if (!this.peerConnection) return;
        
        await this.peerConnection.setRemoteDescription(
            new RTCSessionDescription(answer)
        );
    }

    async handleIceCandidate(candidate) {
        if (!this.peerConnection) return;
        
        try {
            await this.peerConnection.addIceCandidate(
                new RTCIceCandidate(candidate)
            );
        } catch (error) {
            console.error('Ошибка добавления ICE кандидата:', error);
        }
    }

    sendMessage(message) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            const data = {
                type: 'text',
                content: message,
                timestamp: Date.now(),
                sender: JSON.parse(localStorage.getItem('googleChatsUser'))
            };
            
            this.dataChannel.send(JSON.stringify(data));
        } else {
            console.warn('Data channel не готов');
        }
    }

    sendFile(file) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            const reader = new FileReader();
            reader.onload = (event) => {
                const data = {
                    type: 'file',
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    data: event.target.result,
                    timestamp: Date.now()
                };
                
                this.dataChannel.send(JSON.stringify(data));
            };
            reader.readAsDataURL(file);
        }
    }

    sendIceCandidate(candidate) {
        // В реальном приложении здесь была бы отправка через сигнальный сервер
        console.log('ICE кандидат:', candidate);
    }

    handleDisconnect() {
        if (this.dataChannel) {
            this.dataChannel.close();
        }
        
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        this.onDisconnect('peer_disconnected');
    }

    disconnect() {
        this.handleDisconnect();
    }

    // Методы для локального обнаружения (mDNS или WebRTC data channels)
    async discoverLocalPeers() {
        // В реальном приложении здесь было бы использование mDNS или WebSockets
        // для обнаружения пиров в локальной сети
        console.log('Поиск пиров в локальной сети...');
        
        // Возвращаем мок данные для демо
        return [
            {
                id: 'local_peer_1',
                name: 'Устройство в локальной сети',
                type: 'local'
            }
        ];
    }

    // Метод для симуляции сигнального сервера в локальной сети
    async connectViaLocalSignaling(peerId) {
        console.log('Подключение через локальный сигнальный сервер к:', peerId);
        
        // В реальном приложении здесь было бы использование WebSocket
        // или HTTP запросов к локальному серверу
        
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    success: true,
                    peerId: peerId,
                    connectionType: 'local'
                });
            }, 1000);
        });
    }
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WebRTCManager;
}