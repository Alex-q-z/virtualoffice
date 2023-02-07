// Config variables: change them to point to your own servers
const SIGNALING_SERVER_URL = 'http://10.5.136.159:9999';
// const SIGNALING_SERVER_URL = 'http://10.5.65.215:9999';
// const SIGNALING_SERVER_URL = 'http://localhost:9999';

// for communication that is local
const PC_CONFIG = {};

// button-related parameters and events
const startButton = document.getElementById('startButton');
const callButton = document.getElementById('callButton');
const upgradeButton = document.getElementById('upgradeButton');
// const hangupButton = document.getElementById('hangupButton');
callButton.disabled = true;
upgradeButton.disabled = true;
// hangupButton.disabled = true;
startButton.onclick = start;
callButton.onclick = call;
upgradeButton.onclick = videoOn;
// hangupButton.onclick = hangup;

// Signaling methods
let socket = io(SIGNALING_SERVER_URL, { autoConnect: false });

socket.on('data', (data) => {
  console.log('socket on: Data received: ', data);
  handleSignalingData(data);
});

socket.on('ready', () => {
  console.log('socket on: Ready');
  // Connection with signaling server is ready, and so is local stream
  console.log('socket on: before createPeerConnection');
  createPeerConnection();
  console.log('socket on: after createPeerConnection, before sendOffer');
  sendOffer();
});

let sendData = (data) => {
  socket.emit('data', data);
};

// WebRTC methods
let pc;
let localStream;
let remoteStreamElement = document.querySelector('#remoteStream');
let localStreamElement = document.querySelector('#localStream');

let getlocalStream = () => {
  // QZ: my version for multiple cameras
  console.log("getlocalStream: enter getLocalStream");

  navigator.enumerateDevices(async function(devices) {
    cameras = [];
    devices.forEach(async function(device) {
      if (device.kind === 'video' || device.kind === 'videoinput') {
          cameras.push(device);
      }
    });
    
    console.log("getlocalStream: after enumerateDevices(), cameras number %d", cameras.length);

    console.log("camera 1 id %s", cameras[0].deviceId);
    console.log("camera 1 label %s", cameras[0].label);

    // local stream
    constraints = {
      'audio': {'echoCancellation': true},
      'video': {
          'deviceId': cameras[0].deviceId
          }
      }

    console.log("getlocalStream: before localStream");
    let stream = await navigator.mediaDevices.getUserMedia(constraints);
    localStream = stream;
    localStreamElement.srcObject = stream;

    console.log("getlocalStream: ready for socket.connect()");
    socket.connect();
  })

}

let createPeerConnection = () => {
  console.log("================WARNING: connection reset================");
  console.log("createPeerConnection: enter createPeerConnection");
  try {
    pc = new RTCPeerConnection(PC_CONFIG);
    pc.onicecandidate = onIceCandidate;
    pc.ontrack = onTrack;
    pc.oniceconnectionstatechange = e => onIceStateChange(pc, e);
    console.log('createPeerConnection: PeerConnection created');
  } catch (error) {
    console.error('createPeerConnection: PeerConnection failed: ', error);
  }
};

let sendOffer = () => {
  console.log('sendOffer: enter sendOffer');
  pc.createOffer().then(
    setAndSendLocalDescription,
    (error) => { console.error('sendOffer: send offer failed: ', error); }
  );
};

let sendAnswer = () => {
  console.log('sendAnswer: enter sendAnswer');
  pc.createAnswer().then(
    setAndSendLocalDescription,
    (error) => { console.error('sendAnswer: send answer failed: ', error); }
  );
};

let setAndSendLocalDescription = (sessionDescription) => {
  pc.setLocalDescription(sessionDescription);
  console.log('setAndSendLocalDescription: local description set');
  sendData(sessionDescription);
};

let onIceCandidate = (event) => {
  if (event.candidate) {
    console.log('onIceCandidate: ICE candidate');
    sendData({
      type: 'candidate',
      candidate: event.candidate
    });
  }
};

function onIceStateChange(pc, event) {
  if (pc) {
    console.log(`PC ICE state: ${pc.iceConnectionState}`);
    console.log('ICE state change event: ', event);
  }
}

let onTrack = (event) => {
  console.log('onTrack: Add track');
  remoteStreamElement.srcObject = event.streams[0];
  console.log('onTrack: end');
};

let handleSignalingData = (data) => {
  switch (data.type) {
    case 'offer':
      console.log('handleSignalingData: case offer');
      createPeerConnection();
      pc.setRemoteDescription(new RTCSessionDescription(data));
      sendAnswer();
      break;
    case 'answer':
      console.log('handleSignalingData: case answer');
      pc.setRemoteDescription(new RTCSessionDescription(data));
      break;
    case 'candidate':
      console.log('handleSignalingData: case candidate');
      pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      break;
  }
};

let toggleMic = () => {
  let track = localStream.getAudioTracks()[0];
  track.enabled = !track.enabled;
  let micClass = track.enabled ? "unmuted" : "muted";
  document.getElementById("toggleMic").className = micClass;
};

function start() {
  console.log('in start(): but we do nothing');
  startButton.disabled = true;
  callButton.disabled = false;
}

function call() {
  console.log('in call(): before establishing connection with socket.connect()');
  // call socket.connect() to create webrtc connection
  socket.connect();

  // set button states
  console.log('in call(): before setting button states');
  callButton.disabled = true;
  upgradeButton.disabled = false;
  hangupButton.disabled = false;

  // establish connection
  // pc1 = new RTCPeerConnection(PC_CONFIG);
  // pc1.onicecandidate = e => onIceCandidate(pc1, e);
  // pc1.oniceconnectionstatechange = e => onIceStateChange(pc1, e);
  // pc1.createOffer(offerOptions).then(onCreateOfferSuccess, onCreateSessionDescriptionError);
}

function videoOn() {
  console.log('in videoOn(): enter videoOn');
  upgradeButton.disabled = true;
  navigator.mediaDevices
      .getUserMedia({audio: true, video: true})
      .then(stream => {
        console.log('in videoOn(): before assigning stream to localStream');
        localStream = stream;
        localStreamElement.srcObject = stream;

        // QZ: getTrack and addTrack so remote client can see local streams
        console.log('in videoOn(): before getTrack');
        const videoTracks = stream.getVideoTracks();
        const audioTracks = stream.getAudioTracks();

        console.log('in videoOn(): before addTrack');
        pc.addTrack(videoTracks[0], localStream);
        pc.addTrack(audioTracks[0], localStream);

        console.log('in videoOn(): before sendOffer()');
        sendOffer();
        // return pc.createOffer();
      })
      .catch(error => {
        console.error('in videoOn(): we met an error: ', error);
      });
}

// Start connection
console.log("main: starting everything");
