// Config variables: change them to point to your own servers
const SIGNALING_SERVER_URL = 'http://172.27.76.160:9999';

// for communication that is local
const PC_CONFIG = {};

// button-associated HTML elements
const startButton = document.getElementById('startButton');
const connectButton = document.getElementById('connectButton');
const videoOnButton = document.getElementById('videoOnButton');
const videoOffButton = document.getElementById('videoOffButton');
const audioOnButton = document.getElementById('audioOnButton');
const audioOffButton = document.getElementById('audioOffButton');
const startPeakButton = document.getElementById('startPeakButton');
const stopPeakButton = document.getElementById('stopPeakButton');
const disconnectButton = document.getElementById('disconnectButton');

// button status
startButton.disabled = false;
connectButton.disabled = true;
videoOnButton.disabled = true;
videoOffButton.disabled = true;
audioOnButton.disabled = true;
audioOffButton.disabled = true;
startPeakButton.disabled = true;
stopPeakButton.disabled = true;
disconnectButton.disabled = true;

// button onclick events
startButton.onclick = start;
connectButton.onclick = callConnect;
videoOnButton.onclick = videoOn; // videoOnNew;
videoOffButton.onclick = videoOff; // videoOff;
audioOnButton.onclick = audioOn; // audioOnNew;
audioOffButton.onclick = audioOff; // audioOff;
startPeakButton.onclick = startPeak;
stopPeakButton.onclick = stopPeak;
disconnectButton.onclick = callDisconnect;

// device-selection-related parameters and events
const videoSelect = document.querySelector('select#videoSource');
const audioInputSelect = document.querySelector('select#audioSource');
const selectors = [videoSelect, audioInputSelect];
let videoSource = null;
let audioSource = null;

// signaling method
let socket = io(SIGNALING_SERVER_URL, { autoConnect: false });

// handler for events emitted from the server
socket.on('data', (data) => {
  console.log('socket on: Data received: ', data);
  handleSignalingData(data);
});

socket.on('broadcast_update', (all_users_data) => {
  console.log('socket on: broadcast_update received: ', all_users_data);
  user_list = all_users_data;
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

// connection-related parameters
let other_side_closed = false;
let user_list;

// dummy audio and dummy video tracks
let silence = () => {
  let ctx = new AudioContext(), oscillator = ctx.createOscillator();
  let dst = oscillator.connect(ctx.createMediaStreamDestination());
  oscillator.start();
  return Object.assign(dst.stream.getAudioTracks()[0], {enabled: false});
}

let get_silent_audio_track = () => {
  let ctx = new AudioContext(), oscillator = ctx.createOscillator();
  let dst = oscillator.connect(ctx.createMediaStreamDestination());
  oscillator.start();
  return dst.stream.getAudioTracks()[0];
}

let black = ({width = 640, height = 480} = {}) => {
  let canvas = Object.assign(document.createElement("canvas"), {width, height});
  canvas.getContext('2d').fillRect(0, 0, width, height);
  let stream = canvas.captureStream();
  return Object.assign(stream.getVideoTracks()[0], {enabled: false});
}

let get_black_video_track = ({width = 640, height = 480} = {}) => {
  let canvas = Object.assign(document.createElement("canvas"), {width, height});
  canvas.getContext('2d').fillRect(0, 0, width, height);
  let stream = canvas.captureStream();
  return stream.getVideoTracks()[0];
}

let blackSilence = (...args) => new MediaStream([black(...args), silence()]);

// create peer connection
let createPeerConnection = () => {
  console.log("================WARNING: connection reset================");
  console.log("createPeerConnection: enter createPeerConnection");
  try {
    pc = new RTCPeerConnection(PC_CONFIG);
    pc.onicecandidate = onIceCandidate;
    pc.ontrack = onTrack;
    pc.oniceconnectionstatechange = e => onIceStateChange(pc, e);

    // Initialization: here we use dummy audio and video tracks before users turn on cameras/microphones
    // let constraints = {width: 640, height: 480};
    // // WARNING: we will begin to deprecate localStream and use localStreamElement.srcObject all the time
    // // localStream = blackSilence(constraints);
    // localStreamElement.srcObject = blackSilence(constraints);
    // localStreamElement.muted = true;
    // pc.addStream(localStreamElement.srcObject);

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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function gotDevices(deviceInfos) {
  // Handles being called several times to update labels. Preserve values.
  const values = selectors.map(select => select.value);
  selectors.forEach(select => {
    while (select.firstChild) {
      select.removeChild(select.firstChild);
    }
  });
  for (let i = 0; i !== deviceInfos.length; ++i) {
    const deviceInfo = deviceInfos[i];
    const option = document.createElement('option');
    option.value = deviceInfo.deviceId;
    if (deviceInfo.kind === 'audioinput') {
      option.text = deviceInfo.label || `microphone ${audioInputSelect.length + 1}`;
      audioInputSelect.appendChild(option);
      console.log('Audio source device: ', deviceInfo);
    } else if (deviceInfo.kind === 'videoinput') {
      option.text = deviceInfo.label || `camera ${videoSelect.length + 1}`;
      videoSelect.appendChild(option);
      console.log('Video source device: ', deviceInfo);
    } else {
      console.log('Some other kind of source/device: ', deviceInfo);
    }
  }
  selectors.forEach((select, selectorIndex) => {
    if (Array.prototype.slice.call(select.childNodes).some(n => n.value === values[selectorIndex])) {
      select.value = values[selectorIndex];
    }
  });
}

function gotStream(stream) {
  // window.stream = stream; // make stream available to console
  // localStreamElement.srcObject = stream;
  // Refresh button list in case labels have become available
  return navigator.mediaDevices.enumerateDevices();
}

function handleError(error) {
  console.log('navigator.MediaDevices.getUserMedia error: ', error.message, error.name);
}

function start() {
  startButton.disabled = true;
  connectButton.disabled = false;
  reset();
}

function reset() {
  // obtain all local device information, and configure video/audio source select
  console.log("in reset(): enter reset");
  // if (window.stream) {
  //   window.stream.getTracks().forEach(track => {
  //     track.stop();
  //   });
  // }
  
  audioSource = audioInputSelect.value;
  console.log("in reset(): audioSource is: ", audioSource);
  videoSource = videoSelect.value;
  console.log("in reset(): videoSource is: ", videoSource);

  console.log("in reset(): before navigator.mediaDevices.enumerateDevices()");
  navigator.mediaDevices.enumerateDevices().then(gotDevices).catch(handleError);
}

function callConnect() {
  console.log('in callConnect(): before establishing connection with socket.connect()');
  
  // call socket.connect() to create webrtc connection
  socket.connect();
  socket.emit("broadcast_update", {"user_id": "QizhengZhang", "device": "desk"});

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
        // .getUserMedia({audio: audioState, video: true})
        .getUserMedia({audio: audioState, 
                       video: {deviceId: videoSource ? {exact: videoSource} : undefined}})
        .then(stream => {
          console.log('in videoOn(): before assigning stream to localStream');
          localStream = stream;
          localStreamElement.srcObject = stream;
          localStreamElement.muted = true;

          // QZ: getTrack and addTrack so remote client can see local streams
          console.log('in videoOn(): before getTrack');
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

function videoOnNew() {
  console.log('in videoOnNew(): enter videoOn');
  videoOnButton.disabled = true;
  videoOffButton.disabled = false;

  navigator.mediaDevices
      .getUserMedia({audio: false,
                     video: {deviceId: videoSource ? {exact: videoSource} : undefined}})
      .then(stream => {
        console.log('in videoOnNew(): before assigning stream to localStream');
        // localStream = stream;
        // localStreamElement.srcObject = stream;

        // QZ: update track on localStreamElement.srcObject
        // let new_video_track = stream.getTracks().find(t => t.kind == 'video');
        // let local_video_track = localStreamElement.srcObject.getTracks().find(t => t.kind == 'video');
        // console.log('in videoOnNew(): before removeTrack', localStreamElement.srcObject.getTracks());
        // localStreamElement.srcObject.removeTrack(local_video_track);
        // console.log('in videoOnNew(): after removeTrack', localStreamElement.srcObject.getTracks());
        // localStreamElement.srcObject.addTrack(new_video_track);
        // console.log('in videoOnNew(): after addTrack', localStreamElement.srcObject.getTracks());
        // localStream = localStreamElement.srcObject;

        localStream = stream;
        localStreamElement.srcObject = stream;
        console.log('in videoOnNew(): after addTrack', localStreamElement.srcObject.getTracks());

        // QZ: replaceTrack on peer connection
        return Promise.all(pc.getSenders().map(sender =>
          (sender.track && sender.track.kind == 'video') ? sender.replaceTrack(stream.getTracks().find(t => t.kind == sender.track.kind), stream) : sender));
        // for (var sender in pc.getSenders()) {
        //   if (sender.track && sender.track.kind == 'video') {
        //     console.log("OK, the sender is", sender);
        //     sender.replaceTrack(stream.getTracks().find(t => t.kind == 'video'));
        //   }
        // }
        // let sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
        // console.log("OK, the sender is", sender);
        // console.log("OK, the new track is", stream.getTracks().find(t => t.kind == 'video'));
        // sender.replaceTrack(stream.getTracks().find(t => t.kind == 'video'));
      })
      .catch(error => {
        console.error('in videoOnNew(): we met an error: ', error);
      });
}

function audioOn() {
  console.log('in audioOn(): enter audioOn');
  audioOnButton.disabled = true;
  audioOffButton.disabled = false;

  if (localStream == null || localStream.getAudioTracks()[0] == undefined) {
    let videoState = ((localStream == null || localStream.getVideoTracks()[0] == undefined) ? false : true);
    navigator.mediaDevices
        // .getUserMedia({audio: true, video: videoState})
        .getUserMedia({audio: {deviceId: audioSource ? {exact: audioSource} : undefined}, 
                       video: videoState})
        .then(stream => {
          console.log('in audioOn(): before assigning stream to localStream');
          localStream = stream;
          localStreamElement.srcObject = stream;
          localStreamElement.muted = true; // QZ: added for muting local audio

          // QZ: getTrack and addTrack so remote client can see local streams
          console.log('in audioOn(): before getTrack');
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

function audioOnNew() {
  console.log('in audioOnNew(): enter videoOn');
  audioOnButton.disabled = true;
  audioOffButton.disabled = false;

  navigator.mediaDevices
      .getUserMedia({audio: {deviceId: audioSource ? {exact: audioSource} : undefined},
                     video: false})
      .then(stream => {
        console.log('in audioOnNew(): before assigning stream to localStream');
        localStream = stream;
        localStreamElement.srcObject = stream;
        localStreamElement.muted = true;

        // QZ: replaceTrack (video track only)
        return Promise.all(pc.getSenders().map(sender =>
          sender.replaceTrack(stream.getTracks().find(t => t.kind == sender.track.kind), stream)));
      })
      .catch(error => {
        console.error('in audioOnNew(): we met an error: ', error);
      });
}

function videoOff() {
  console.log('in videoOff(): enter videoOff');
  videoOnButton.disabled = false;
  videoOffButton.disabled = true;
  let videoTrack = localStream.getVideoTracks()[0];
  videoTrack.enabled = !videoTrack.enabled;
}

// function videoOffNew() {
//   console.log('in videoOffNew(): enter videoOff');
//   videoOnButton.disabled = false;
//   videoOffButton.disabled = true;
  
//   let constraints = {width: 640, height: 480};
//   let dummyStream = blackSilence(constraints);
//   // localStream = dummyStream;
//   // localStreamElement.srcObject = dummyStream;


//   localStream = stream;
//   localStreamElement.srcObject = stream;
//   localStreamElement.muted = true;

//   // QZ: replaceTrack (video track only)
//   return Promise.all(pc.getSenders().map(sender =>
//     sender.replaceTrack(stream.getTracks().find(t => t.kind == sender.track.kind), stream)));
// }

function audioOff() {
  console.log('in audioOff(): enter audioOff');
  audioOnButton.disabled = false;
  audioOffButton.disabled = true;
  let audioTrack = localStream.getAudioTracks()[0];
  audioTrack.enabled = !audioTrack.enabled;
}

// function audioOffNew() {
//   console.log('in audioOffNew(): enter audioOff');
//   audioOnButton.disabled = false;
//   audioOffButton.disabled = true;
  

// }

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
  otherSideVideoAndAudioOn();
  startPeakButton.disabled = true;
  stopPeakButton.disabled = false;
}

async function stopPeak() {
  videoAndAudioOff();
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

videoSelect.onchange = reset;
audioInputSelect.onchange = reset;