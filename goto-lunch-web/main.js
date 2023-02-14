// Config variables: change them to point to your own servers
const SIGNALING_SERVER_URL = 'http://10.5.65.215:9999';

// for communication that is local
const PC_CONFIG = {};

// button-related parameters and events
const connectButton = document.getElementById('connectButton');
const videoOnButton = document.getElementById('videoOnButton');
const videoOffButton = document.getElementById('videoOffButton');
const audioOnButton = document.getElementById('audioOnButton');
const audioOffButton = document.getElementById('audioOffButton');
const startPeakButton = document.getElementById('startPeakButton');
const stopPeakButton = document.getElementById('stopPeakButton');
const disconnectButton = document.getElementById('disconnectButton');
connectButton.disabled = false;
videoOnButton.disabled = true;
videoOffButton.disabled = true;
audioOnButton.disabled = true;
audioOffButton.disabled = true;
startPeakButton.disabled = true;
stopPeakButton.disabled = true;
disconnectButton.disabled = true;
connectButton.onclick = callConnect;
videoOnButton.onclick = videoOn;
videoOffButton.onclick = videoOff;
audioOnButton.onclick = audioOn;
audioOffButton.onclick = audioOff;
startPeakButton.onclick = startPeak;
stopPeakButton.onclick = stopPeak;
disconnectButton.onclick = callDisconnect;

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
  socketReady = true;
});

let sendData = (data) => {
  socket.emit('data', data);
};

// WebRTC methods
let pc = null;
let localStream = null;
let remoteStreamElement = document.querySelector('#remoteStream');
let localStreamElement = document.querySelector('#localStream');

let socketReady = false;

let videoSender;
let audioSender;

// parameters
let other_side_closed = false;

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
  console.log('sendAnswer: before, pc state is %s', pc.signalingState);
  if (pc.signalingState == "stable") {
    console.log('sendAnswer: we will change the stable state');
    pc.signalingState = "have-local-offer";
  }
  console.log('sendAnswer: after, pc state is %s', pc.signalingState);
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

let closeConnection = () => {
  sendData({
    type: 'close'
  });
};

let otherSideVideoOn = () => {
  sendData({
    type: 'video_on'
  });
};

let otherSideVideoOff = () => {
  sendData({
    type: 'video_off'
  });
};

let otherSideAudioOn = () => {
  sendData({
    type: 'audio_on'
  });
};

let otherSideAudioOff = () => {
  sendData({
    type: 'audio_off'
  });
};

let otherSideVideoAndAudioOn = () => {
  sendData({
    type: 'video_and_audio_on'
  });
}

let otherSideVideoAndAudioOff = () => {
  sendData({
    type: 'video_and_audio_off'
  });
}

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
      if (pc == null) {
        console.log("handleSignalingData offer: pc is undefined");
        createPeerConnection();
      }
      else {
        console.log("handleSignalingData offer: signalingState is %s", pc.signalingState);
      }
      pc.setRemoteDescription(new RTCSessionDescription(data));
      sendAnswer();
      break;
    case 'answer':
      console.log('handleSignalingData: case answer');
      console.log("handleSignalingData answer: signalingState is %s", pc.signalingState);
      pc.setRemoteDescription(new RTCSessionDescription(data));
      break;
    case 'candidate':
      console.log('handleSignalingData: case candidate');
      console.log("handleSignalingData candidate: signalingState is %s", pc.signalingState);
      pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      break;
    case 'close':
      other_side_closed = true;
      callDisconnect();
      break;
    case 'video_on':
      videoOn();
      break;
    case 'audio_on':
      audioOn();
      break;
    case 'video_off':
      videoOff();
      break;
    case 'audio_off':
      audioOff();
      break;
    case 'video_and_audio_on':
      videoAndAudioOn();
      startPeakButton.disabled = true;
      stopPeakButton.disabled = false;
      break;
    case 'video_and_audio_off':
      videoAndAudioOff();
      startPeakButton.disabled = false;
      stopPeakButton.disabled = true;
      break;
  }
};

let toggleMic = () => {
  let track = localStream.getAudioTracks()[0];
  track.enabled = !track.enabled;
  let micClass = track.enabled ? "unmuted" : "muted";
  document.getElementById("toggleMic").className = micClass;
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function callConnect() {
  console.log('in callConnect(): before establishing connection with socket.connect()');
  
  // call socket.connect() to create webrtc connection
  socket.connect();

  // set button states
  console.log('in callConnect(): before setting button states');
  connectButton.disabled = true;
  videoOnButton.disabled = false;
  audioOnButton.disabled = false;
  startPeakButton.disabled = false;
  disconnectButton.disabled = false;
}

function videoOn() {
  console.log('in videoOn(): enter videoOn');
  videoOnButton.disabled = true;
  videoOffButton.disabled = false;

  if (localStream == null || localStream.getVideoTracks()[0] == undefined) {
    let audioState = ((localStream == null || localStream.getAudioTracks()[0] == undefined) ? false : true);
    navigator.mediaDevices
        .getUserMedia({audio: audioState, video: true})
        .then(stream => {
          console.log('in videoOn(): before assigning stream to localStream');
          localStream = stream;
          localStreamElement.srcObject = stream;
          localStreamElement.muted = true;

          // QZ: getTrack and addTrack so remote client can see local streams
          console.log('in videoOn(): before getTrack');
          if (audioState) {
            const audioTracks = stream.getAudioTracks();
            audioSender = pc.addTrack(audioTracks[0], localStream);
          }
          const videoTracks = stream.getVideoTracks();
          
          console.log('in videoOn(): before addTrack');
          videoSender = pc.addTrack(videoTracks[0], localStream);

          console.log('in videoOn(): before sendOffer()');
          sendOffer();
          // return pc.createOffer();
        })
        .catch(error => {
          console.error('in videoOn(): we met an error: ', error);
        });
  }
  else {
    let videoTrack = localStream.getVideoTracks()[0];
    videoTrack.enabled = !videoTrack.enabled;
  }
}

function audioOn() {
  console.log('in audioOn(): enter audioOn');
  audioOnButton.disabled = true;
  audioOffButton.disabled = false;

  if (localStream == null || localStream.getAudioTracks()[0] == undefined) {
    let videoState = ((localStream == null || localStream.getVideoTracks()[0] == undefined) ? false : true);
    navigator.mediaDevices
        .getUserMedia({audio: true, video: videoState})
        .then(stream => {
          console.log('in audioOn(): before assigning stream to localStream');
          localStream = stream;
          localStreamElement.srcObject = stream;
          localStreamElement.muted = true; // QZ: added for muting local audio

          // QZ: getTrack and addTrack so remote client can see local streams
          console.log('in audioOn(): before getTrack');
          if (videoState) {
            const videoTracks = stream.getVideoTracks();
            videoSender = pc.addTrack(videoTracks[0], localStream);
          }
          const audioTracks = stream.getAudioTracks();

          console.log('in audioOn(): before addTrack');
          audioSender = pc.addTrack(audioTracks[0], localStream);

          console.log('in audioOn(): before sendOffer()');
          sendOffer();
          // return pc.createOffer();
        })
        .catch(error => {
          console.error('in audioOn(): we met an error: ', error);
        });
  }
  else {
    let audioTrack = localStream.getAudioTracks()[0];
    audioTrack.enabled = !audioTrack.enabled;
  }
}

function videoOff() {
  console.log('in videoOff(): enter videoOff');
  videoOnButton.disabled = false;
  videoOffButton.disabled = true;
  let videoTrack = localStream.getVideoTracks()[0];
  videoTrack.enabled = !videoTrack.enabled;
}

function audioOff() {
  console.log('in audioOff(): enter audioOff');
  audioOnButton.disabled = false;
  audioOffButton.disabled = true;
  let audioTrack = localStream.getAudioTracks()[0];
  audioTrack.enabled = !audioTrack.enabled;
}

function videoAndAudioOn() {
  console.log('in videoAndAudioOn(): enter videoAndAudioOn');
  videoOnButton.disabled = true;
  videoOffButton.disabled = false;
  audioOnButton.disabled = true;
  audioOffButton.disabled = false;

  if (localStream == null) {
    navigator.mediaDevices
        .getUserMedia({audio: true, video: true})
        .then(stream => {
          console.log('in videoAndAudioOn(): before assigning stream to localStream');
          localStream = stream;
          localStreamElement.srcObject = stream;
          localStreamElement.muted = true;

          // QZ: getTrack and addTrack so remote client can see local streams
          console.log('in videoAndAudioOn(): before getTrack');
          const videoTracks = stream.getVideoTracks();
          const audioTracks = stream.getAudioTracks();
          
          console.log('in videoAndAudioOn(): before addTrack');
          videoSender = pc.addTrack(videoTracks[0], localStream);
          audioSender = pc.addTrack(audioTracks[0], localStream);

          console.log('in videoAndAudioOn(): before sendOffer()');
          sendOffer();
        })
        .catch(error => {
          console.error('in videoAndAudioOn(): we met an error: ', error);
        });
  }
  else {
    let videoTrack = localStream.getVideoTracks()[0];
    let audioTrack = localStream.getAudioTracks()[0];
    videoTrack.enabled = !videoTrack.enabled;
    audioTrack.enabled = !audioTrack.enabled;
  }

}

function videoAndAudioOff() {
  console.log('in videoAndAudioOff(): enter videoAndAudioOff');
  videoOnButton.disabled = false;
  videoOffButton.disabled = true;
  audioOnButton.disabled = false;
  audioOffButton.disabled = true;

  let videoTrack = localStream.getVideoTracks()[0];
  let audioTrack = localStream.getAudioTracks()[0];
  videoTrack.enabled = !videoTrack.enabled;
  audioTrack.enabled = !audioTrack.enabled;
}

async function startPeak() {
  videoAndAudioOn();
  await sleep(1000);
  otherSideVideoAndAudioOn();
  startPeakButton.disabled = true;
  stopPeakButton.disabled = false;
}

async function stopPeak() {
  videoAndAudioOff();
  await sleep(1000);
  otherSideVideoAndAudioOff();
  startPeakButton.disabled = false;
  stopPeakButton.disabled = true;
}

async function callDisconnect() {
  // set button states
  videoOnButton.disabled = true;
  videoOffButton.disabled = true;
  audioOnButton.disabled = true;
  audioOffButton.disabled = true;
  connectButton.disabled = false;
  disconnectButton.disabled = true;

  pc.close();
  pc = null;
  if (!other_side_closed) {
    closeConnection();
  }

  if (localStream != null) {
    const videoTracks = localStream.getVideoTracks();
    videoTracks.forEach(videoTrack => {
      videoTrack.stop();
      localStream.removeTrack(videoTrack);
    });

    const audioTracks = localStream.getAudioTracks();
    audioTracks.forEach(audioTrack => {
      audioTrack.stop();
      localStream.removeTrack(audioTrack);
    });

    localStream = null;
  }

  localStreamElement.srcObject = null;

  // finally, close the socket
  await sleep(500);
  socket.disconnect();
}

// Start connection
console.log("main: starting everything");
