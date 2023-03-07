// IP and port number of the signaling server
// const SIGNALING_SERVER_URL = 'http://172.27.76.160:9999';
const SIGNALING_SERVER_URL = 'http://10.5.65.215:9999';

// for communication that is local
const PC_CONFIG = {};

// button-associated HTML elements
// const startButton = document.getElementById('startButton');
const loginButton = document.getElementById('loginButton');
// const connectButton = document.getElementById('connectButton');
// const videoOnButton = document.getElementById('videoOnButton');
// const videoOffButton = document.getElementById('videoOffButton');
// const audioOnButton = document.getElementById('audioOnButton');
// const audioOffButton = document.getElementById('audioOffButton');
const startPeakButton = document.getElementById('startPeakButton');
const stopPeakButton = document.getElementById('stopPeakButton');
// const disconnectButton = document.getElementById('disconnectButton');
const logoffButton = document.getElementById('logoffButton');

// button status
// startButton.disabled = false;
loginButton.disabled = true;
// connectButton.disabled = true;
// videoOnButton.disabled = true;
// videoOffButton.disabled = true;
// audioOnButton.disabled = true;
// audioOffButton.disabled = true;
startPeakButton.disabled = true;
stopPeakButton.disabled = true;
// disconnectButton.disabled = true;
logoffButton.disabled = true;

// button onclick events
// startButton.onclick = start;
loginButton.onclick = serverConnect; // callConnect;
// connectButton.onclick = doNothing; // webrtcConnect; // serverConnect; // callConnect;
// videoOnButton.onclick = videoOn; // videoOnNew;
// videoOffButton.onclick = videoOff; // videoOff;
// audioOnButton.onclick = audioOn; // audioOnNew;
// audioOffButton.onclick = audioOff; // audioOff;
startPeakButton.onclick = webrtcConnectAndStartPeak; // startPeak; // startPeak;
stopPeakButton.onclick = webrtcDisconnectAndStopPeak; // stopPeak; // stopPeak;
// disconnectButton.onclick = webrtcDisconnect; // serverDisconnect; // callDisconnect;
logoffButton.onclick = serverDisconnect;

// do-not-disturb checkbox
const noDisturbCheckbox = document.getElementById("noDisturbCheckbox");

// device-selection-related parameters and events
const videoSelect = document.querySelector('select#videoSource');
const audioInputSelect = document.querySelector('select#audioSource');
const selectors = [videoSelect, audioInputSelect];
let videoSource = null;
let audioSource = null;

const activeUsersSelect = document.querySelector('select#activeUsers');

// state variables
let user_online_flag = false;

// signaling method
let socket = io(SIGNALING_SERVER_URL, { autoConnect: false });

// handler for events emitted from the server
socket.on('data', (data) => {
  console.log('socket on: Data received: ', data);
  handleSignalingData(data);
});

socket.on('broadcast_connection_update', (all_users_data) => {
  console.log('socket on: broadcast_connection_update received: ', all_users_data);
  active_users = all_users_data;
  // change the dynamic list that shows the list of online users
  updateActiveUsers();
});

socket.on('webrtc_disconnect', (data) => {
  console.log('socket on: webrtc_disconnect');
  webrtcClose();
  // set button states
  // connectButton.disabled = false;
  // disconnectButton.disabled = true;
  startPeakButton.disabled = false;
  stopPeakButton.disabled = true;
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

socket.on('peak_ready', () => {
  console.log('socket on: Ready');
  // Connection with signaling server is ready, and so is local stream
  console.log('socket on: before createPeerConnection');
  createPeerConnection(video_audio_on = true);
  console.log('socket on: after createPeerConnection, before sendOffer');
  sendOffer();
  socketReady = true;
});

// let sendData = (data) => {
//   socket.emit('data', data);
// };

let sendData = (data) => {
  socket.emit('local_data', data);
};

let sendGlobalData = (data) => {
  socket.emit('global_data', data);
};

// let sendLocalData = (data) => {
//   socket.emit('local_data', data);
// };

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
let active_users = null;
let selectedUser = null;

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
function createPeerConnection(video_audio_on = false, peaked_on = false) {
  console.log("================WARNING: connection reset================");
  console.log("createPeerConnection: enter createPeerConnection");
  try {
    pc = new RTCPeerConnection(PC_CONFIG);
    pc.onicecandidate = onIceCandidate;
    pc.ontrack = onTrack;
    pc.oniceconnectionstatechange = e => onIceStateChange(pc, e);

    // add video and audio tracks if specified
    console.log('in createPeerConnection(): should we add video and audio tracks? ', video_audio_on);
    if (video_audio_on) {

      if (peaked_on) {
        // before turning on video and audio, do two things:
        // 1. release a sound effect that reminds the user
        playDoorKnock();
        // 2. wait for 2-3 seconds before turning on video
        sleep(3000);
      }

      navigator.mediaDevices
        .getUserMedia({audio: {deviceId: audioSource ? {exact: audioSource} : undefined},
                       video: {deviceId: videoSource ? {exact: videoSource} : undefined}})
        .then(stream => {
          console.log('in createPeerConnection(): before assigning stream to localStream');
          localStream = stream;
          localStreamElement.srcObject = stream;
          localStreamElement.muted = true;

          // QZ: getTrack and addTrack so remote client can see local streams
          console.log('in createPeerConnection(): before getTrack');
          const videoTracks = stream.getVideoTracks();
          const audioTracks = stream.getAudioTracks();
          
          console.log('in createPeerConnection(): before addTrack');
          videoSender = pc.addTrack(videoTracks[0], localStream);
          audioSender = pc.addTrack(audioTracks[0], localStream);

          console.log('in createPeerConnection(): before sendOffer()');
          sendOffer();
        })
        .catch(error => {
          console.error('in createPeerConnection(): we met an error: ', error);
        });
    }

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
        // WARNING: fix this later! video_audio_on should be dependent on server-side signal
        createPeerConnection(video_audio_on = true, peaked_on = true);
        // QZ: this might not be the best place
        // connectButton.disabled = true;
        // disconnectButton.disabled = false;
        startPeakButton.disabled = true;
        stopPeakButton.disabled = false;
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
      // turn on video and audio
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

function playDoorKnock() {
  // create audio context
  const audioContext = new AudioContext();

  // create audio buffer from door knock sound file
  const audioFileUrl = "https://alex-q-z.github.io/files/door-knock.mp3";
  const audioRequest = new XMLHttpRequest();
  audioRequest.open("GET", audioFileUrl, true);
  audioRequest.responseType = "arraybuffer";
  audioRequest.onload = function() {
    audioContext.decodeAudioData(audioRequest.response, function(audioBuffer) {
      // create audio source from audio buffer
      const audioSource = audioContext.createBufferSource();
      audioSource.buffer = audioBuffer;
      audioSource.connect(audioContext.destination);
      audioSource.start();
    });
  };
  audioRequest.send();
}

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

function get_user_status(user_info) {
  if (user_info["do_not_disturb"]) {
    return "do not disturb";
  }
  else if (user_info["availability"] == "busy") {
    return "on a call";
  }
  return "free";
}

function updateActiveUsers() {
  // Clear all existing options from the select element
  activeUsersSelect.innerHTML = '';

  if ((selectedUser != null) && !(selectedUser in active_users)) {
    selectedUser = null;
    startPeakButton.disabled = true;
  }

  let first_user_not_myself = true;
  for (let sid in active_users) {
    if (active_users[sid]["user_id"] == USER_ID) {
      continue;
    }
    else {
      if (selectedUser == null && first_user_not_myself) {
        selectedUser = sid;
        startPeakButton.disabled = false;
        // connectButton.disabled = false;
        first_user_not_myself = false;
      }
      const optionElement = document.createElement('option');
      optionElement.value = sid;
      let user_status = get_user_status(active_users[sid]);
      optionElement.text = active_users[sid]["user_id"] + " (" + active_users[sid]["device"] + "): " + user_status;
      activeUsersSelect.appendChild(optionElement);
    }
  }

  // active_users.filter(user => user.user_id != USER_ID).forEach(function(user) {
  //   const optionElement = document.createElement('option');
  //   optionElement.value = user.sid;
  //   optionElement.text = user.user_id + " (" + user.device + ")";
  //   activeUsersSelect.appendChild(optionElement);
  // });

  // if (selectedUser == null && 
  //     active_users.filter(user => user.user_id != USER_ID) != null && 
  //     active_users.filter(user => user.user_id != USER_ID).length > 0) {
  //   selectedUser = active_users.filter(user => user.user_id != USER_ID)[0].sid;
  //   connectButton.disabled = false;
  // }
}

function updateSelectedUser() {
  if (selectedUser == null) {
    startPeakButton.disabled = false;
  }
  selectedUser = activeUsersSelect.value;
}

function resetActiveUsers() {
  // Clear all existing options from the select element
  activeUsersSelect.innerHTML = '';
  selectedUser = null;
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
  // startButton.disabled = true;
  loginButton.disabled = false;
  // connectButton.disabled = false;
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

  // set default options for audioSource and videoSource
  // if (audioSource == null) {

  // }
  // if (videoSource == null) {

  // }
}

function serverConnect() {
  console.log('in serverConnect(): before we make a web socket connection with the signaling server');
  socket.connect();
  socket.emit("new_user_connect_to_server", USER_INFO);
  console.log('in serverConnect(): after we called socket.connect()');
  
  user_online_flag = true;
  loginButton.disabled = true;
  logoffButton.disabled = false;
}

function serverDisconnect() {
  console.log('in serverDisconnect(): before webrtcClose');
  webrtcClose();
  console.log('in serverDisconnect(): before socket.disconnect');
  socket.disconnect();
  user_online_flag = false;
  loginButton.disabled = false;
  logoffButton.disabled = true;
  startPeakButton.disabled = true;
  stopPeakButton.disabled = true;
  resetActiveUsers();
}

function webrtcConnect() {
  // send a webrtc connect request to the server
  // this will put us and the other user in the same chat room
  socket.emit("webrtc_connect_request", {"other_user": selectedUser, "video_audio_on": 0});
  // connectButton.disabled = true;
  // disconnectButton.disabled = false;

  // QZ: there might be race condition, ignore for now
  startPeakButton.disabled = false;
}

function webrtcClose() {
  if (pc != null) {
    pc.close();
    pc = null;
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
  remoteStreamElement.srcObject = null;
}

function webrtcDisconnect() {
  // send a webrtc disconnect request to the server
  // this will end the webrtc connection we have with the selected user
  socket.emit("webrtc_disconnect_request", selectedUser);

  // this would close and clean up the WebRTC peer connection on our side
  webrtcClose();

  // set button states
  // connectButton.disabled = false;
  // disconnectButton.disabled = true;
  startPeakButton.disabled = true;
  stopPeakButton.disabled = true;
}

// function callConnect() {
//   console.log('in callConnect(): before establishing connection with socket.connect()');
  
//   // call socket.connect() to create webrtc connection
//   socket.connect();
//   socket.emit("new_user_connect_to_call", USER_INFO);

//   // set button states
//   console.log('in callConnect(): before setting button states');
//   connectButton.disabled = true;
//   videoOnButton.disabled = false;
//   audioOnButton.disabled = false;
//   startPeakButton.disabled = false;
//   disconnectButton.disabled = false;
// }

// function videoOn() {
//   console.log('in videoOn(): enter videoOn');
//   videoOnButton.disabled = true;
//   videoOffButton.disabled = false;

//   if (localStream == null || localStream.getVideoTracks()[0] == undefined) {
//     let audioState = ((localStream == null || localStream.getAudioTracks()[0] == undefined) ? false : true);
//     navigator.mediaDevices
//         // .getUserMedia({audio: audioState, video: true})
//         .getUserMedia({audio: audioState, 
//                        video: {deviceId: videoSource ? {exact: videoSource} : undefined}})
//         .then(stream => {
//           console.log('in videoOn(): before assigning stream to localStream');
//           localStream = stream;
//           localStreamElement.srcObject = stream;
//           localStreamElement.muted = true;

//           // QZ: getTrack and addTrack so remote client can see local streams
//           console.log('in videoOn(): before getTrack');
//           const videoTracks = stream.getVideoTracks();
          
//           console.log('in videoOn(): before addTrack');
//           videoSender = pc.addTrack(videoTracks[0], localStream);

//           console.log('in videoOn(): before sendOffer()');
//           sendOffer();
//           // return pc.createOffer();
//         })
//         .catch(error => {
//           console.error('in videoOn(): we met an error: ', error);
//         });
//   }
//   else {
//     let videoTrack = localStream.getVideoTracks()[0];
//     videoTrack.enabled = !videoTrack.enabled;
//   }
// }

// function videoOnNew() {
//   console.log('in videoOnNew(): enter videoOn');
//   videoOnButton.disabled = true;
//   videoOffButton.disabled = false;

//   navigator.mediaDevices
//       .getUserMedia({audio: false,
//                      video: {deviceId: videoSource ? {exact: videoSource} : undefined}})
//       .then(stream => {
//         console.log('in videoOnNew(): before assigning stream to localStream');
//         // localStream = stream;
//         // localStreamElement.srcObject = stream;

//         // QZ: update track on localStreamElement.srcObject
//         // let new_video_track = stream.getTracks().find(t => t.kind == 'video');
//         // let local_video_track = localStreamElement.srcObject.getTracks().find(t => t.kind == 'video');
//         // console.log('in videoOnNew(): before removeTrack', localStreamElement.srcObject.getTracks());
//         // localStreamElement.srcObject.removeTrack(local_video_track);
//         // console.log('in videoOnNew(): after removeTrack', localStreamElement.srcObject.getTracks());
//         // localStreamElement.srcObject.addTrack(new_video_track);
//         // console.log('in videoOnNew(): after addTrack', localStreamElement.srcObject.getTracks());
//         // localStream = localStreamElement.srcObject;

//         localStream = stream;
//         localStreamElement.srcObject = stream;
//         console.log('in videoOnNew(): after addTrack', localStreamElement.srcObject.getTracks());

//         // QZ: replaceTrack on peer connection
//         return Promise.all(pc.getSenders().map(sender =>
//           (sender.track && sender.track.kind == 'video') ? sender.replaceTrack(stream.getTracks().find(t => t.kind == sender.track.kind), stream) : sender));
//         // for (var sender in pc.getSenders()) {
//         //   if (sender.track && sender.track.kind == 'video') {
//         //     console.log("OK, the sender is", sender);
//         //     sender.replaceTrack(stream.getTracks().find(t => t.kind == 'video'));
//         //   }
//         // }
//         // let sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
//         // console.log("OK, the sender is", sender);
//         // console.log("OK, the new track is", stream.getTracks().find(t => t.kind == 'video'));
//         // sender.replaceTrack(stream.getTracks().find(t => t.kind == 'video'));
//       })
//       .catch(error => {
//         console.error('in videoOnNew(): we met an error: ', error);
//       });
// }

// function audioOn() {
//   console.log('in audioOn(): enter audioOn');
//   audioOnButton.disabled = true;
//   audioOffButton.disabled = false;

//   if (localStream == null || localStream.getAudioTracks()[0] == undefined) {
//     let videoState = ((localStream == null || localStream.getVideoTracks()[0] == undefined) ? false : true);
//     navigator.mediaDevices
//         // .getUserMedia({audio: true, video: videoState})
//         .getUserMedia({audio: {deviceId: audioSource ? {exact: audioSource} : undefined}, 
//                        video: videoState})
//         .then(stream => {
//           console.log('in audioOn(): before assigning stream to localStream');
//           localStream = stream;
//           localStreamElement.srcObject = stream;
//           localStreamElement.muted = true; // QZ: added for muting local audio

//           // QZ: getTrack and addTrack so remote client can see local streams
//           console.log('in audioOn(): before getTrack');
//           const audioTracks = stream.getAudioTracks();

//           console.log('in audioOn(): before addTrack');
//           audioSender = pc.addTrack(audioTracks[0], localStream);

//           console.log('in audioOn(): before sendOffer()');
//           sendOffer();
//           // return pc.createOffer();
//         })
//         .catch(error => {
//           console.error('in audioOn(): we met an error: ', error);
//         });
//   }
//   else {
//     let audioTrack = localStream.getAudioTracks()[0];
//     audioTrack.enabled = !audioTrack.enabled;
//   }
// }

// function audioOnNew() {
//   console.log('in audioOnNew(): enter videoOn');
//   audioOnButton.disabled = true;
//   audioOffButton.disabled = false;

//   navigator.mediaDevices
//       .getUserMedia({audio: {deviceId: audioSource ? {exact: audioSource} : undefined},
//                      video: false})
//       .then(stream => {
//         console.log('in audioOnNew(): before assigning stream to localStream');
//         localStream = stream;
//         localStreamElement.srcObject = stream;
//         localStreamElement.muted = true;

//         // QZ: replaceTrack (video track only)
//         return Promise.all(pc.getSenders().map(sender =>
//           sender.replaceTrack(stream.getTracks().find(t => t.kind == sender.track.kind), stream)));
//       })
//       .catch(error => {
//         console.error('in audioOnNew(): we met an error: ', error);
//       });
// }

// function videoOff() {
//   console.log('in videoOff(): enter videoOff');
//   videoOnButton.disabled = false;
//   videoOffButton.disabled = true;
//   let videoTrack = localStream.getVideoTracks()[0];
//   videoTrack.enabled = !videoTrack.enabled;
// }

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

// function audioOff() {
//   console.log('in audioOff(): enter audioOff');
//   audioOnButton.disabled = false;
//   audioOffButton.disabled = true;
//   let audioTrack = localStream.getAudioTracks()[0];
//   audioTrack.enabled = !audioTrack.enabled;
// }

// function audioOffNew() {
//   console.log('in audioOffNew(): enter audioOff');
//   audioOnButton.disabled = false;
//   audioOffButton.disabled = true;

// }

function videoAndAudioOn() {
  console.log('in videoAndAudioOn(): enter videoAndAudioOn');
  // videoOnButton.disabled = true;
  // videoOffButton.disabled = false;
  // audioOnButton.disabled = true;
  // audioOffButton.disabled = false;

  if (localStream == null) {
    navigator.mediaDevices
        .getUserMedia({audio: {deviceId: audioSource ? {exact: audioSource} : undefined},
                       video: {deviceId: videoSource ? {exact: videoSource} : undefined}})
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
  // videoOnButton.disabled = false;
  // videoOffButton.disabled = true;
  // audioOnButton.disabled = false;
  // audioOffButton.disabled = true;

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

async function webrtcConnectAndStartPeak() {
  if (active_users[selectedUser]["do_not_disturb"] || active_users[selectedUser]["availability"] == "busy") {
    return ;
  }

  // send a connect request to the server, which will be redirected to the other user
  socket.emit("webrtc_connect_request", {"other_user": selectedUser, "video_audio_on": 1});
  
  // set button states
  startPeakButton.disabled = true;
  stopPeakButton.disabled = false;
}

async function webrtcDisconnectAndStopPeak() {
  socket.emit("webrtc_disconnect_request", selectedUser);

  // this would close and clean up the WebRTC peer connection on our side
  webrtcClose();

  startPeakButton.disabled = false;
  stopPeakButton.disabled = true;
}

// async function callDisconnect() {
//   // set button states
//   videoOnButton.disabled = true;
//   videoOffButton.disabled = true;
//   audioOnButton.disabled = true;
//   audioOffButton.disabled = true;
//   connectButton.disabled = false;
//   disconnectButton.disabled = true;

//   pc.close();
//   pc = null;
//   if (!other_side_closed) {
//     closeConnection();
//   }

//   if (localStream != null) {
//     const videoTracks = localStream.getVideoTracks();
//     videoTracks.forEach(videoTrack => {
//       videoTrack.stop();
//       localStream.removeTrack(videoTrack);
//     });

//     const audioTracks = localStream.getAudioTracks();
//     audioTracks.forEach(audioTrack => {
//       audioTrack.stop();
//       localStream.removeTrack(audioTrack);
//     });

//     localStream = null;
//   }

//   localStreamElement.srcObject = null;

//   // finally, close the socket
//   await sleep(500);
//   socket.disconnect();
// }

function updateDoNotDisturb() {
  socket.emit("update_do_not_disturb", USER_INFO["do_not_disturb"]);
}

function noDisturbCheckboxChange() {
  USER_INFO["do_not_disturb"] = noDisturbCheckbox.checked;
  if (user_online_flag) {
    updateDoNotDisturb();
  }
}

function doNothing() { 
}

// Start connection
console.log("main: starting everything");
start();

videoSelect.onchange = reset;
audioInputSelect.onchange = reset;
activeUsersSelect.onchange = updateSelectedUser;
noDisturbCheckbox.onchange = noDisturbCheckboxChange;