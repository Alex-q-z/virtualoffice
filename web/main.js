// Config variables: change them to point to your own servers
const SIGNALING_SERVER_URL = 'http://10.5.136.159:9999';
// const SIGNALING_SERVER_URL = 'http://10.5.65.215:9999';
// const SIGNALING_SERVER_URL = 'http://localhost:9999';

// for communication that is local
const PC_CONFIG = {};

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
  console.log("createPeerConnection: enter createPeerConnection");
  try {
    pc = new RTCPeerConnection(PC_CONFIG);
    pc.onicecandidate = onIceCandidate;
    console.log("createPeerConnection: after pc.onicecandidate");
    pc.ontrack = onTrack;
    console.log("createPeerConnection: after pc.ontrack");
    pc.addStream(localStream);
    console.log("createPeerConnection: after pc.addStream(localStream)");

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

// Start connection
console.log("main: before getlocalStream()");
getlocalStream();
