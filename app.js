import { soundEngine } from './audio.js';
import { Starfield } from './starfield.js';
import { ICEBREAKER_PROMPTS, SIMULATED_BUDDIES } from './icebreakers.js';
import { Peer } from 'peerjs';

// ===================================================================
// Hi Guy — Application Controller
// ===================================================================

class HiGuyApp {
  constructor() {
    this.peerId = 'higuy_' + Math.random().toString(36).substring(2, 9);
    this.altitude = 5;
    this.localStream = null;
    this.peer = null;
    this.currentCall = null;
    this.currentDataConn = null;
    this.peerConnection = null;
    this.dataChannel = null;
    this.broadcastChannel = null;
    this.friendIdFromUrl = new URLSearchParams(window.location.search).get('friend');

    this.state = 'idle'; // 'idle', 'searching', 'connected'
    this.currentBuddy = null;
    this.isMuted = false;
    this.isCamOff = false;
    this.isSelfBlurred = false;
    this.isRemoteBlurred = false;
    this.isPeerConnected = false;
    this.simulatedBuddyTimer = null;
    this.simulatedTypingTimer = null;
    this.simulatedAnimFrame = null;

    // Doodle state
    this.isDrawing = false;
    this.doodleColor = '#10b981';
    this.lastX = 0;
    this.lastY = 0;

    // Ground Me Breathing
    this.breathingInterval = null;

    this.init();
  }

  async init() {
    // 1. Initialize Cosmic Particle Canvas
    this.starfield = new Starfield('starfieldCanvas');
    this.updateThemeColors(this.altitude);

    // 2. Setup BroadcastChannel for Instant 2-Tab Live WebRTC P2P Testing
    this.initSignaling();

    // 3. Setup PeerJS Cloud for True Internet P2P Video with Friends
    this.initPeerNetwork();

    // 3. Cache DOM Elements
    this.cacheDom();

    // 4. Bind UI Event Listeners
    this.bindEvents();

    // 5. Initialize Icebreaker Card
    this.displayRandomIcebreaker();

    // 6. Check Age Gate
    this.checkAgeGate();

    // 7. Request Local Media Stream
    await this.initLocalMedia();

    // 8. Start with Simulated Avatar Rendering on Remote Canvas
    this.renderIdleRemoteCanvas();
  }

  cacheDom() {
    // Media elements
    this.remoteVideo = document.getElementById('remoteVideo');
    this.localVideo = document.getElementById('localVideo');
    this.simulatedCanvas = document.getElementById('simulatedStrangerCanvas');
    this.selfCanvasFallback = document.getElementById('selfCanvasFallback');

    // Overlays & Badges
    this.searchingOverlay = document.getElementById('searchingOverlay');
    this.searchTitle = document.getElementById('searchStatusTitle');
    this.searchSubtitle = document.getElementById('searchStatusSub');
    this.startSearchBtn = document.getElementById('startSearchBtn');
    this.strangerBadge = document.getElementById('strangerBadge');
    this.strangerName = document.getElementById('strangerName');
    this.strangerAvatar = document.getElementById('strangerAvatar');
    this.strangerAltitudeTag = document.getElementById('strangerAltitudeTag');
    this.strangerMunchieTag = document.getElementById('strangerMunchieTag');
    this.remoteFloatingActions = document.getElementById('remoteFloatingActions');

    // Controls
    this.nextBuddyBtn = document.getElementById('nextBuddyBtn');
    this.highnessSlider = document.getElementById('highnessSlider');
    this.altitudeDisplay = document.getElementById('altitudeDisplay');
    this.peerModeIndicator = document.getElementById('peerModeIndicator');
    this.peerModeText = document.getElementById('peerModeText');

    this.toggleMicBtn = document.getElementById('toggleMicBtn');
    this.toggleCamBtn = document.getElementById('toggleCamBtn');
    this.toggleSelfBlurBtn = document.getElementById('toggleSelfBlurBtn');
    this.unblurBtn = document.getElementById('unblurBtn');
    this.reportBuddyBtn = document.getElementById('reportBuddyBtn');

    // Audio & Header Buttons
    this.inviteFriendBtn = document.getElementById('inviteFriendBtn');
    this.inviteBtnText = document.getElementById('inviteBtnText');
    this.ambientSoundBtn = document.getElementById('ambientSoundBtn');
    this.soundLabel = document.getElementById('soundLabel');
    this.groundMeBtn = document.getElementById('groundMeBtn');
    this.groundMeModal = document.getElementById('groundMeModal');
    this.breathingOrb = document.getElementById('breathingOrb');
    this.breathingInstruction = document.getElementById('breathingInstruction');
    this.exitGroundBtn = document.getElementById('exitGroundBtn');

    // Chat
    this.chatForm = document.getElementById('chatForm');
    this.chatInput = document.getElementById('chatInput');
    this.chatMessages = document.getElementById('chatMessages');
    this.typingIndicator = document.getElementById('typingIndicator');
    this.reactionsStrip = document.getElementById('reactionsStrip');
    this.chatTabBtn = document.getElementById('chatTabBtn');
    this.icebreakersTabBtn = document.getElementById('icebreakersTabBtn');
    this.munchiesTabBtn = document.getElementById('munchiesTabBtn');

    // Icebreaker
    this.sparkCategory = document.getElementById('sparkCategory');
    this.sparkText = document.getElementById('sparkText');
    this.shuffleSparkBtn = document.getElementById('shuffleSparkBtn');
    this.beamSparkBtn = document.getElementById('beamSparkBtn');

    // Doodle
    this.toggleDoodleBtn = document.getElementById('toggleDoodleBtn');
    this.doodleModal = document.getElementById('doodleModal');
    this.doodleCanvas = document.getElementById('doodleCanvas');
    this.clearDoodleBtn = document.getElementById('clearDoodleBtn');
    this.closeDoodleBtn = document.getElementById('closeDoodleBtn');

    // Age Gate
    this.ageGateModal = document.getElementById('ageGateModal');
    this.acceptAgeBtn = document.getElementById('acceptAgeBtn');
    this.declineAgeBtn = document.getElementById('declineAgeBtn');
  }

  // ===================================================================
  // WebRTC & BroadcastChannel Signaling (Allows 2 browser tabs to connect!)
  // ===================================================================

  initSignaling() {
    try {
      this.broadcastChannel = new BroadcastChannel('higuy_p2p_channel');
      this.broadcastChannel.onmessage = (event) => this.handleSignalingMessage(event.data);
    } catch (e) {
      console.warn('BroadcastChannel not supported in this environment:', e);
    }
  }

  // ===================================================================
  // PeerJS Cloud Signaling (Connects 2 friends across the internet!)
  // ===================================================================

  initPeerNetwork() {
    try {
      this.peer = new Peer(this.peerId, {
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });

      this.peer.on('open', (id) => {
        this.peerId = id;
        console.log('PeerJS Cloud ready. Your ID:', id);

        // If user came via an invite link ?friend=...
        if (this.friendIdFromUrl && this.friendIdFromUrl !== id) {
          this.callFriend(this.friendIdFromUrl);
        }
      });

      // Handle incoming video call from a friend over the internet
      this.peer.on('call', (call) => {
        this.currentCall = call;
        this.isPeerConnected = true;

        const answerStream = () => {
          if (this.localStream) {
            call.answer(this.localStream);
          } else {
            setTimeout(answerStream, 300);
          }
        };
        answerStream();

        call.on('stream', (remoteStream) => {
          this.remoteVideo.srcObject = remoteStream;
          this.remoteVideo.style.display = 'block';
          this.simulatedCanvas.style.display = 'none';
        });

        call.on('close', () => {
          this.disconnectPeer();
          this.addSystemMessage('Your friend ended the call.');
        });

        this.onConnectedToPeer('Your Friend 🌿', 5);
      });

      // Handle incoming data connection from friend
      this.peer.on('connection', (conn) => {
        this.currentDataConn = conn;
        this.setupPeerDataEvents(conn);
      });

      this.peer.on('error', (err) => {
        console.warn('PeerJS notice:', err);
      });
    } catch (err) {
      console.warn('PeerJS setup error:', err);
    }
  }

  setupPeerDataEvents(conn) {
    conn.on('data', (data) => {
      try {
        const msg = typeof data === 'string' ? JSON.parse(data) : data;
        if (msg.type === 'chat') {
          this.appendChatMessage(msg.text, 'stranger', msg.senderName || 'Friend');
          soundEngine.playMessageChime();
        } else if (msg.type === 'doodle_draw') {
          this.drawRemoteDoodle(msg);
        } else if (msg.type === 'doodle_clear') {
          this.clearLocalDoodleCanvas();
        }
      } catch (err) {
        console.warn(err);
      }
    });
  }

  callFriend(targetId) {
    this.state = 'searching';
    this.searchTitle.textContent = 'Calling your friend...';
    this.searchSubtitle.textContent = 'Connecting live video across the internet...';
    this.searchingOverlay.classList.add('active');

    const tryCall = () => {
      if (!this.localStream) {
        setTimeout(tryCall, 400);
        return;
      }

      this.currentCall = this.peer.call(targetId, this.localStream);
      this.currentCall.on('stream', (remoteStream) => {
        this.remoteVideo.srcObject = remoteStream;
        this.remoteVideo.style.display = 'block';
        this.simulatedCanvas.style.display = 'none';
      });

      this.currentCall.on('close', () => {
        this.disconnectPeer();
        this.addSystemMessage('Your friend disconnected.');
      });

      this.currentDataConn = this.peer.connect(targetId);
      this.setupPeerDataEvents(this.currentDataConn);

      this.onConnectedToPeer('Invited Friend 🌿', 5);
    };

    tryCall();
  }

  copyInviteLink() {
    const url = `${window.location.origin}${window.location.pathname}?friend=${this.peerId}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        this.onInviteCopied(url);
      }).catch(() => {
        prompt('Copy your private invite link below to share with your friend:', url);
      });
    } else {
      prompt('Copy your private invite link below to share with your friend:', url);
    }
  }

  onInviteCopied(url) {
    if (this.inviteFriendBtn) this.inviteFriendBtn.classList.add('copied');
    if (this.inviteBtnText) this.inviteBtnText.textContent = 'Link Copied! 📋';

    this.addSystemMessage(`🔗 Private Invite Link copied! Text this link to your friend to start a 1-on-1 video call:\n${url}`);
    soundEngine.playPop(580);

    setTimeout(() => {
      if (this.inviteFriendBtn) this.inviteFriendBtn.classList.remove('copied');
      if (this.inviteBtnText) this.inviteBtnText.textContent = 'Invite Friend';
    }, 3000);
  }

  handleSignalingMessage(data) {
    if (!data || data.sender === this.peerId) return;

    switch (data.type) {
      case 'searching':
        if (this.state === 'searching') {
          // Both tabs are searching! Connect them!
          const isCaller = this.peerId < data.sender;
          if (isCaller) {
            this.broadcastChannel.postMessage({
              type: 'match_found',
              sender: this.peerId,
              target: data.sender,
              altitude: this.altitude
            });
            this.initiatePeerCall(data.sender, true);
          }
        }
        break;

      case 'match_found':
        if (data.target === this.peerId) {
          this.initiatePeerCall(data.sender, false);
        }
        break;

      case 'sdp_offer':
        if (data.target === this.peerId) {
          this.handleSdpOffer(data.offer, data.sender);
        }
        break;

      case 'sdp_answer':
        if (data.target === this.peerId && this.peerConnection) {
          this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
        break;

      case 'ice_candidate':
        if (data.target === this.peerId && this.peerConnection) {
          this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(e => console.warn(e));
        }
        break;

      case 'peer_leave':
        if (this.isPeerConnected) {
          this.addSystemMessage('Your smoking buddy disconnected or skipped.');
          this.disconnectPeer();
          this.startSearching();
        }
        break;

      case 'doodle_draw':
        this.drawRemoteDoodle(data);
        break;

      case 'doodle_clear':
        this.clearLocalDoodleCanvas();
        break;
    }
  }

  async initiatePeerCall(targetPeerId, isCaller) {
    this.isPeerConnected = true;
    this.createPeerConnection(targetPeerId);

    if (isCaller) {
      this.dataChannel = this.peerConnection.createDataChannel('higuy_chat');
      this.setupDataChannel();

      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      this.broadcastChannel.postMessage({
        type: 'sdp_offer',
        sender: this.peerId,
        target: targetPeerId,
        offer: offer
      });
    }

    this.onConnectedToPeer('Elevated Peer', this.altitude);
  }

  createPeerConnection(targetPeerId) {
    const config = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    };

    this.peerConnection = new RTCPeerConnection(config);

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });
    }

    this.peerConnection.ontrack = (event) => {
      this.remoteVideo.srcObject = event.streams[0];
      this.remoteVideo.style.display = 'block';
      this.simulatedCanvas.style.display = 'none';
    };

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.broadcastChannel) {
        this.broadcastChannel.postMessage({
          type: 'ice_candidate',
          sender: this.peerId,
          target: targetPeerId,
          candidate: event.candidate
        });
      }
    };

    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannel();
    };
  }

  async handleSdpOffer(offer, senderId) {
    this.isPeerConnected = true;
    this.createPeerConnection(senderId);

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    this.broadcastChannel.postMessage({
      type: 'sdp_answer',
      sender: this.peerId,
      target: senderId,
      answer: answer
    });

    this.onConnectedToPeer('Elevated Peer', this.altitude);
  }

  setupDataChannel() {
    if (!this.dataChannel) return;
    this.dataChannel.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'chat') {
          this.appendChatMessage(msg.text, 'stranger', msg.senderName || 'Buddy');
          soundEngine.playMessageChime();
        } else if (msg.type === 'reaction') {
          this.showReactionAnimation(msg.emoji);
        }
      } catch (e) {
        console.warn(e);
      }
    };
  }

  disconnectPeer() {
    if (this.currentCall) {
      this.currentCall.close();
      this.currentCall = null;
    }
    if (this.currentDataConn) {
      this.currentDataConn.close();
      this.currentDataConn = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    this.isPeerConnected = false;
    this.remoteVideo.srcObject = null;
    this.remoteVideo.style.display = 'none';
    this.simulatedCanvas.style.display = 'block';
  }

  // ===================================================================
  // Camera & Media Setup
  // ===================================================================

  async initLocalMedia() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: true
      });
      this.localVideo.srcObject = this.localStream;
      this.selfCanvasFallback.style.display = 'none';
    } catch (err) {
      console.info('No physical webcam available or permission denied. Using animated fallback:', err.message);
      this.renderSelfCanvasFallback();
    }
  }

  renderSelfCanvasFallback() {
    this.selfCanvasFallback.style.display = 'block';
    const ctx = this.selfCanvasFallback.getContext('2d');
    let frame = 0;

    const drawFallback = () => {
      ctx.clearRect(0, 0, this.selfCanvasFallback.width, this.selfCanvasFallback.height);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, this.selfCanvasFallback.width, this.selfCanvasFallback.height);

      // Draw glowing chill avatar
      const cx = this.selfCanvasFallback.width / 2;
      const cy = this.selfCanvasFallback.height / 2;
      const pulse = Math.sin(frame * 0.05) * 6;

      ctx.beginPath();
      ctx.arc(cx, cy, 28 + pulse, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(6, 182, 212, 0.2)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, 20, 0, Math.PI * 2);
      ctx.fillStyle = '#06b6d4';
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🍃', cx, cy + 6);

      frame++;
      requestAnimationFrame(drawFallback);
    };
    drawFallback();
  }

  // ===================================================================
  // Matchmaking Flow (Real P2P or Simulated Companions)
  // ===================================================================

  startSearching() {
    this.state = 'searching';
    soundEngine.playPop(380);

    // Hide stranger info & floating tools
    this.strangerBadge.style.display = 'none';
    this.remoteFloatingActions.style.display = 'none';
    this.searchingOverlay.classList.add('active');
    this.searchTitle.textContent = 'Scanning the multiverse...';
    this.searchSubtitle.textContent = `Aligning frequencies around Altitude Level ${this.altitude}...`;
    this.startSearchBtn.style.display = 'none';

    // Broadcast search message to other tabs
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'searching',
        sender: this.peerId,
        altitude: this.altitude
      });
    }

    // Set fallback timeout: If no real peer responds within 2.5 seconds, connect to a simulated stoner buddy!
    clearTimeout(this.simulatedBuddyTimer);
    this.simulatedBuddyTimer = setTimeout(() => {
      if (this.state === 'searching' && !this.isPeerConnected) {
        this.connectSimulatedBuddy();
      }
    }, 2400);
  }

  connectSimulatedBuddy() {
    // Pick random simulated buddy
    const buddyIndex = Math.floor(Math.random() * SIMULATED_BUDDIES.length);
    this.currentBuddy = { ...SIMULATED_BUDDIES[buddyIndex] };
    this.currentBuddy.msgIndex = 0;

    this.onConnectedToBuddy(this.currentBuddy);
  }

  onConnectedToPeer(name, altitude) {
    this.state = 'connected';
    this.searchingOverlay.classList.remove('active');
    this.strangerBadge.style.display = 'flex';
    this.remoteFloatingActions.style.display = 'flex';

    this.strangerName.textContent = name;
    this.strangerAvatar.textContent = '🪐';
    this.strangerAltitudeTag.textContent = `Altitude ${altitude} 🚀`;
    this.strangerMunchieTag.textContent = 'Snack: Sharing vibes';

    this.peerModeIndicator.classList.add('connected');
    this.peerModeText.textContent = '2-Tab Peer Linked! ⚡';

    this.addSystemMessage(`Connected with an Elevated Peer at altitude ${altitude}!`);
    soundEngine.playMessageChime();
  }

  onConnectedToBuddy(buddy) {
    this.state = 'connected';
    this.searchingOverlay.classList.remove('active');
    this.strangerBadge.style.display = 'flex';
    this.remoteFloatingActions.style.display = 'flex';

    this.strangerName.textContent = buddy.name;
    this.strangerAvatar.textContent = '✨';
    this.strangerAltitudeTag.textContent = `Altitude ${buddy.altitude} 🚀`;
    this.strangerMunchieTag.textContent = `Snack: ${buddy.munchie}`;

    this.peerModeIndicator.classList.remove('connected');
    this.peerModeText.textContent = 'Sim Companion Active';

    this.addSystemMessage(`Connected with ${buddy.name} (${buddy.status})`);
    soundEngine.playMessageChime();

    // Start animated canvas avatar for this buddy
    this.startSimulatedBuddyCanvas(buddy);

    // Schedule first simulated message
    this.scheduleNextBuddyMessage(1800);
  }

  skipToNextBuddy() {
    soundEngine.playPop(520);
    clearTimeout(this.simulatedBuddyTimer);
    clearTimeout(this.simulatedTypingTimer);
    this.typingIndicator.style.display = 'none';

    if (this.isPeerConnected && this.broadcastChannel) {
      this.broadcastChannel.postMessage({ type: 'peer_leave', sender: this.peerId });
      this.disconnectPeer();
    }

    this.addSystemMessage('You moved to the next buddy.');
    this.startSearching();
  }

  // ===================================================================
  // Simulated Buddy Animated Avatar Canvas
  // ===================================================================

  startSimulatedBuddyCanvas(buddy) {
    const canvas = this.simulatedCanvas;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.parentElement.clientWidth || 640;
    canvas.height = canvas.parentElement.clientHeight || 480;

    let tick = 0;
    if (this.simulatedAnimFrame) cancelAnimationFrame(this.simulatedAnimFrame);

    const animateBuddy = () => {
      if (this.state !== 'connected' || this.isPeerConnected) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      // Draw deep cosmic room glow
      const roomGrad = ctx.createRadialGradient(cx, cy, 20, cx, cy, canvas.width * 0.7);
      roomGrad.addColorStop(0, '#131b31');
      roomGrad.addColorStop(1, '#060912');
      ctx.fillStyle = roomGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Aura pulse
      const auraPulse = Math.sin(tick * 0.04) * 15;
      const auraGrad = ctx.createRadialGradient(cx, cy, 40, cx, cy, 140 + auraPulse);
      auraGrad.addColorStop(0, buddy.avatarGlow + '55');
      auraGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, 150 + auraPulse, 0, Math.PI * 2);
      ctx.fill();

      // Floating smoke rings
      for (let i = 0; i < 3; i++) {
        const sx = cx + Math.sin(tick * 0.02 + i) * 70;
        const sy = cy - 60 - ((tick * 1.2 + i * 80) % 220);
        const sRadius = 15 + ((tick + i * 40) % 60);
        ctx.beginPath();
        ctx.arc(sx, sy, sRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, 0.08 - sRadius * 0.001)})`;
        ctx.fill();
      }

      // Head silhouette / stylized character
      const headY = cy + Math.sin(tick * 0.03) * 6;

      // Shoulders
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.ellipse(cx, headY + 130, 110, 60, 0, 0, Math.PI * 2);
      ctx.fill();

      // Head
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.arc(cx, headY, 65, 0, Math.PI * 2);
      ctx.fill();

      // Chill smiling visor / eyes
      const eyeBlink = Math.sin(tick * 0.02) > 0.95;
      ctx.strokeStyle = buddy.avatarGlow;
      ctx.lineWidth = 4;
      ctx.shadowColor = buddy.avatarGlow;
      ctx.shadowBlur = 18;

      if (!eyeBlink) {
        // Left Eye (chill crescent)
        ctx.beginPath();
        ctx.arc(cx - 24, headY - 6, 12, 0.1 * Math.PI, 0.9 * Math.PI, false);
        ctx.stroke();

        // Right Eye (chill crescent)
        ctx.beginPath();
        ctx.arc(cx + 24, headY - 6, 12, 0.1 * Math.PI, 0.9 * Math.PI, false);
        ctx.stroke();
      } else {
        // Blink line
        ctx.beginPath();
        ctx.moveTo(cx - 36, headY - 2);
        ctx.lineTo(cx - 12, headY - 2);
        ctx.moveTo(cx + 12, headY - 2);
        ctx.lineTo(cx + 36, headY - 2);
        ctx.stroke();
      }

      // Smile
      const talking = (this.typingIndicator.style.display !== 'none');
      const mouthOpen = talking ? Math.sin(tick * 0.3) * 6 : 0;
      ctx.beginPath();
      ctx.arc(cx, headY + 16, 16 + mouthOpen, 0.15 * Math.PI, 0.85 * Math.PI, false);
      ctx.stroke();

      ctx.shadowBlur = 0; // reset shadow

      tick++;
      this.simulatedAnimFrame = requestAnimationFrame(animateBuddy);
    };

    animateBuddy();
  }

  renderIdleRemoteCanvas() {
    const canvas = this.simulatedCanvas;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.parentElement.clientWidth || 640;
    canvas.height = canvas.parentElement.clientHeight || 480;

    ctx.fillStyle = '#090d18';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // ===================================================================
  // Chat & Communication Engine
  // ===================================================================

  sendChatMessage(text) {
    if (!text || !text.trim()) return;
    const cleanText = text.trim();

    this.appendChatMessage(cleanText, 'you', 'You');
    soundEngine.playPop(620);

    // Send via PeerJS Cloud data connection if friend is connected
    if (this.currentDataConn && this.currentDataConn.open) {
      this.currentDataConn.send({
        type: 'chat',
        text: cleanText,
        senderName: `Altitude ${this.altitude} Traveler`
      });
    }

    // If connected to a real peer via WebRTC DataChannel
    if (this.isPeerConnected && this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify({
        type: 'chat',
        text: cleanText,
        senderName: `Altitude ${this.altitude} Traveler`
      }));
    } else if (this.currentBuddy) {
      // Trigger simulated buddy reaction
      this.scheduleBuddyReplyToUser(cleanText);
    }
  }

  appendChatMessage(text, senderType, senderName, isSpark = false) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${senderType} ${isSpark ? 'spark-msg' : ''}`;

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    bubble.innerHTML = `
      <span class="bubble-sender">${senderName}</span>
      <p class="bubble-text">${this.escapeHtml(text)}</p>
      <span class="bubble-time">${timeStr}</span>
    `;

    this.chatMessages.appendChild(bubble);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  addSystemMessage(text) {
    const sys = document.createElement('div');
    sys.className = 'system-message';
    sys.innerHTML = `<span class="system-icon">🍃</span><p>${this.escapeHtml(text)}</p>`;
    this.chatMessages.appendChild(sys);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  scheduleNextBuddyMessage(delay = 3000) {
    if (!this.currentBuddy || this.state !== 'connected') return;

    this.simulatedTypingTimer = setTimeout(() => {
      if (this.state !== 'connected' || !this.currentBuddy) return;

      // Show typing indicator
      this.typingIndicator.style.display = 'flex';
      this.chatMessages.scrollTop = this.chatMessages.scrollHeight;

      setTimeout(() => {
        if (this.state !== 'connected' || !this.currentBuddy) return;
        this.typingIndicator.style.display = 'none';

        const msg = this.currentBuddy.messages[this.currentBuddy.msgIndex % this.currentBuddy.messages.length];
        this.currentBuddy.msgIndex++;

        this.appendChatMessage(msg, 'stranger', this.currentBuddy.name);
        soundEngine.playMessageChime();

        // Queue another thought in 8-12 seconds
        this.scheduleNextBuddyMessage(9000 + Math.random() * 4000);
      }, 1600);
    }, delay);
  }

  scheduleBuddyReplyToUser(userText) {
    clearTimeout(this.simulatedTypingTimer);

    setTimeout(() => {
      if (this.state !== 'connected' || !this.currentBuddy) return;
      this.typingIndicator.style.display = 'flex';

      setTimeout(() => {
        if (this.state !== 'connected' || !this.currentBuddy) return;
        this.typingIndicator.style.display = 'none';

        const replies = [
          "Dude, that honestly blew my mind just now 🤯",
          "Hahaha facts!! You're on such a high wavelength right now",
          "Woah wait, repeat that... I need a second to process how deep that was",
          "Pass the cosmic vibes man, that is legendary ✨",
          "Literally couldn't agree more, we are definitely on the same frequency tonight 🍃"
        ];
        const randomReply = replies[Math.floor(Math.random() * replies.length)];
        this.appendChatMessage(randomReply, 'stranger', this.currentBuddy.name);
        soundEngine.playMessageChime();
      }, 1500);
    }, 800);
  }

  // ===================================================================
  // Icebreakers & Mind Sparks
  // ===================================================================

  displayRandomIcebreaker(category = 'all') {
    const list = category === 'all'
      ? ICEBREAKER_PROMPTS
      : ICEBREAKER_PROMPTS.filter(p => p.category.includes(category));

    const prompt = list[Math.floor(Math.random() * list.length)] || ICEBREAKER_PROMPTS[0];
    this.sparkCategory.textContent = prompt.category;
    this.sparkText.textContent = `"${prompt.text}"`;
  }

  beamCurrentSparkToChat() {
    const text = `Mind Spark: ${this.sparkText.textContent}`;
    this.appendChatMessage(text, 'you', 'You', true);
    soundEngine.playPop(580);

    // Switch to Chat Tab so user sees it beamed
    this.switchTab('chatTab');

    if (this.isPeerConnected && this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify({
        type: 'chat',
        text: text,
        senderName: 'Deep Spark'
      }));
    } else if (this.currentBuddy) {
      this.scheduleBuddyReplyToUser(text);
    }
  }

  // ===================================================================
  // Ground Me (Emergency Chill Sanctuary)
  // ===================================================================

  openGroundMe() {
    this.groundMeModal.style.display = 'flex';
    soundEngine.startGroundingDrone();

    // Start 4-7-8 Breathing Guide Loop
    let phase = 0; // 0: Inhale (4s), 1: Hold (7s), 2: Exhale (8s)
    const phases = [
      { text: "Inhale gently through your nose (4s)...", duration: 4000 },
      { text: "Hold peacefully and relax your jaw (7s)...", duration: 7000 },
      { text: "Exhale softly and let everything melt (8s)...", duration: 8000 }
    ];

    const runPhase = () => {
      if (this.groundMeModal.style.display === 'none') return;
      const current = phases[phase];
      this.breathingInstruction.textContent = current.text;
      phase = (phase + 1) % phases.length;
      this.breathingInterval = setTimeout(runPhase, current.duration);
    };

    runPhase();
  }

  closeGroundMe() {
    this.groundMeModal.style.display = 'none';
    clearTimeout(this.breathingInterval);
    soundEngine.stopGroundingDrone();
    soundEngine.playPop(440);
  }

  // ===================================================================
  // Shared Collaborative Doodle Pad
  // ===================================================================

  openDoodlePad() {
    this.doodleModal.style.display = 'flex';
    this.doodleModal.showModal();
    this.resizeDoodleCanvas();
  }

  resizeDoodleCanvas() {
    const rect = this.doodleCanvas.parentElement.getBoundingClientRect();
    this.doodleCanvas.width = rect.width;
    this.doodleCanvas.height = rect.height;
  }

  initDoodleDrawing() {
    const canvas = this.doodleCanvas;
    const ctx = canvas.getContext('2d');

    const startDraw = (e) => {
      this.isDrawing = true;
      const rect = canvas.getBoundingClientRect();
      this.lastX = e.clientX - rect.left;
      this.lastY = e.clientY - rect.top;
    };

    const draw = (e) => {
      if (!this.isDrawing) return;
      const rect = canvas.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      ctx.beginPath();
      ctx.moveTo(this.lastX, this.lastY);
      ctx.lineTo(currentX, currentY);
      ctx.strokeStyle = this.doodleColor;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.shadowColor = this.doodleColor;
      ctx.shadowBlur = 12;
      ctx.stroke();

      // Send stroke to peer if connected
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({
          type: 'doodle_draw',
          sender: this.peerId,
          x0: this.lastX / canvas.width,
          y0: this.lastY / canvas.height,
          x1: currentX / canvas.width,
          y1: currentY / canvas.height,
          color: this.doodleColor
        });
      }

      this.lastX = currentX;
      this.lastY = currentY;
    };

    const stopDraw = () => {
      this.isDrawing = false;
    };

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', stopDraw);

    // Touch support
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      startDraw(touch);
    });
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      draw(touch);
    });
    canvas.addEventListener('touchend', stopDraw);
  }

  drawRemoteDoodle(data) {
    const canvas = this.doodleCanvas;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(data.x0 * canvas.width, data.y0 * canvas.height);
    ctx.lineTo(data.x1 * canvas.width, data.y1 * canvas.height);
    ctx.strokeStyle = data.color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.shadowColor = data.color;
    ctx.shadowBlur = 12;
    ctx.stroke();
  }

  clearLocalDoodleCanvas() {
    const canvas = this.doodleCanvas;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // ===================================================================
  // Theme & Altitude Meter
  // ===================================================================

  updateAltitude(val) {
    this.altitude = parseInt(val, 10);
    document.body.setAttribute('data-theme-level', this.altitude);

    let desc = "Gently Lifted 🍃";
    if (this.altitude >= 4 && this.altitude <= 6) desc = "Cruising Orbit 🚀";
    else if (this.altitude >= 7 && this.altitude <= 8) desc = "Deep Cosmos 🪐";
    else if (this.altitude >= 9) desc = "Transcendent 👽";

    this.altitudeDisplay.textContent = `Level ${this.altitude} — ${desc}`;
    this.updateThemeColors(this.altitude);
    soundEngine.playPop(300 + this.altitude * 40);
  }

  updateThemeColors(level) {
    if (level <= 3) {
      this.starfield.setAccentColor(16, 185, 129); // emerald
    } else if (level <= 6) {
      this.starfield.setAccentColor(6, 182, 212); // cyan
    } else if (level <= 8) {
      this.starfield.setAccentColor(139, 92, 246); // purple
    } else {
      this.starfield.setAccentColor(236, 72, 153); // magenta
    }
  }

  // ===================================================================
  // Tabs & Navigation
  // ===================================================================

  switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.style.display = panel.id === tabId ? 'flex' : 'none';
      panel.classList.toggle('active', panel.id === tabId);
    });
  }

  // ===================================================================
  // Event Listeners
  // ===================================================================

  bindEvents() {
    // Start Search button
    this.startSearchBtn.addEventListener('click', () => this.startSearching());

    // Next Buddy Skip button
    this.nextBuddyBtn.addEventListener('click', () => this.skipToNextBuddy());
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        this.skipToNextBuddy();
      }
    });

    // Invite Friend Button
    if (this.inviteFriendBtn) {
      this.inviteFriendBtn.addEventListener('click', () => this.copyInviteLink());
    }

    // Altitude Slider
    this.highnessSlider.addEventListener('input', (e) => this.updateAltitude(e.target.value));

    // Lo-Fi Sound Toggle
    this.ambientSoundBtn.addEventListener('click', () => {
      const active = soundEngine.toggleAmbient();
      this.ambientSoundBtn.classList.toggle('active', active);
      this.soundLabel.textContent = active ? 'Lo-Fi Playing 🎶' : 'Lo-Fi Soundscape';
    });

    // Ground Me Button
    this.groundMeBtn.addEventListener('click', () => this.openGroundMe());
    this.exitGroundBtn.addEventListener('click', () => this.closeGroundMe());

    // Self Video Controls
    this.toggleMicBtn.addEventListener('click', () => {
      this.isMuted = !this.isMuted;
      if (this.localStream) {
        this.localStream.getAudioTracks().forEach(t => t.enabled = !this.isMuted);
      }
      this.toggleMicBtn.classList.toggle('off', this.isMuted);
    });

    this.toggleCamBtn.addEventListener('click', () => {
      this.isCamOff = !this.isCamOff;
      if (this.localStream) {
        this.localStream.getVideoTracks().forEach(t => t.enabled = !this.isCamOff);
      }
      this.toggleCamBtn.classList.toggle('off', this.isCamOff);
    });

    this.toggleSelfBlurBtn.addEventListener('click', () => {
      this.isSelfBlurred = !this.isSelfBlurred;
      this.localVideo.classList.toggle('blurred', this.isSelfBlurred);
    });

    // Remote Stranger Controls
    this.unblurBtn.addEventListener('click', () => {
      this.isRemoteBlurred = !this.isRemoteBlurred;
      this.remoteVideo.classList.toggle('blurred', this.isRemoteBlurred);
      this.simulatedCanvas.classList.toggle('blurred', this.isRemoteBlurred);
      this.unblurBtn.classList.toggle('active', !this.isRemoteBlurred);
    });

    this.reportBuddyBtn.addEventListener('click', () => {
      alert('Thank you for keeping Hi Guy peaceful. Buddy has been reported and blocked.');
      this.skipToNextBuddy();
    });

    // Chat Form Submit
    this.chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.sendChatMessage(this.chatInput.value);
      this.chatInput.value = '';
    });

    // Quick Reaction Emojis
    this.reactionsStrip.addEventListener('click', (e) => {
      const btn = e.target.closest('.reaction-chip');
      if (btn) {
        const emoji = btn.dataset.emoji;
        this.sendChatMessage(emoji);
      }
    });

    // Tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    // Icebreaker Buttons
    this.shuffleSparkBtn.addEventListener('click', () => {
      soundEngine.playPop(480);
      this.displayRandomIcebreaker();
    });

    this.beamSparkBtn.addEventListener('click', () => {
      this.beamCurrentSparkToChat();
    });

    // Category Tags
    document.querySelectorAll('.topic-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        document.querySelectorAll('.topic-tag').forEach(t => t.classList.remove('active'));
        tag.classList.add('active');
        this.displayRandomIcebreaker(tag.dataset.category);
      });
    });

    // Doodle Pad Modal Controls
    this.toggleDoodleBtn.addEventListener('click', () => this.openDoodlePad());
    this.closeDoodleBtn.addEventListener('click', () => {
      this.doodleModal.close();
      this.doodleModal.style.display = 'none';
    });
    this.clearDoodleBtn.addEventListener('click', () => {
      this.clearLocalDoodleCanvas();
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({ type: 'doodle_clear', sender: this.peerId });
      }
    });

    // Color Pickers
    document.querySelectorAll('.color-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        this.doodleColor = dot.dataset.color;
      });
    });

    this.initDoodleDrawing();

    // Munchies Poll Voting
    document.querySelectorAll('.snack-vote-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        soundEngine.playPop(520);
        btn.classList.toggle('voted');
      });
    });
  }

  // ===================================================================
  // Age Gate & Disclaimer
  // ===================================================================

  checkAgeGate() {
    const verified = localStorage.getItem('higuy_age_verified');
    if (!verified) {
      this.ageGateModal.style.display = 'flex';
      this.ageGateModal.showModal();
    } else {
      this.ageGateModal.close();
      this.ageGateModal.style.display = 'none';
      this.startSearching();
    }

    this.acceptAgeBtn.addEventListener('click', () => {
      localStorage.setItem('higuy_age_verified', 'true');
      this.ageGateModal.close();
      this.ageGateModal.style.display = 'none';
      soundEngine.playPop(550);
      this.startSearching();
    });

    this.declineAgeBtn.addEventListener('click', () => {
      window.location.href = 'https://google.com';
    });
  }

  escapeHtml(str) {
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }
}

// Start app when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  new HiGuyApp();
});
