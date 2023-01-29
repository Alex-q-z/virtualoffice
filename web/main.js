// Config variables: change them to point to your own servers
const SIGNALING_SERVER_URL = 'http://10.5.136.159:9999';
// const SIGNALING_SERVER_URL = 'http://localhost:9999';

// const TURN_SERVER_URL = 'localhost:3478';
// const TURN_SERVER_USERNAME = 'username';
// const TURN_SERVER_CREDENTIAL = 'credential';
// WebRTC config: you don't have to change this for the example to work
// If you are testing on localhost, you can just use PC_CONFIG = {}
// const PC_CONFIG = {
//   iceServers: [
//     {
//       urls: 'turn:' + TURN_SERVER_URL + '?transport=tcp',
//       username: TURN_SERVER_USERNAME,
//       credential: TURN_SERVER_CREDENTIAL
//     },
//     {
//       urls: 'turn:' + TURN_SERVER_URL + '?transport=udp',
//       username: TURN_SERVER_USERNAME,
//       credential: TURN_SERVER_CREDENTIAL
//     }
//   ]
// };

// for communication that is local
const PC_CONFIG = {};

// for communication that requires public TURN/STUN server
// const PC_CONFIG = {
//   iceServers: [
//     {
//       urls: "turn:relay.metered.ca:80",
//       username: "50f3ad3c50c154a1ba446087",
//       credential: "YBB6GJSa+k65VRzW",
//     },
//     {
//       urls: "turn:relay.metered.ca:443",
//       username: "50f3ad3c50c154a1ba446087",
//       credential: "YBB6GJSa+k65VRzW",
//     }
//   ]
// };

// Signaling methods
let socket = io(SIGNALING_SERVER_URL, { autoConnect: false });

socket.on('data', (data) => {
  console.log('socket on: Data received: ',data);
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

let localStream2;
let localStream2Element = document.querySelector('#localStream2');
let remoteStream2Element = document.querySelector('#remoteStream2');

let allCameras = [];

let getlocalStream = () => {
  // navigator.mediaDevices.getUserMedia({ audio: true, video: true })
  //   .then((stream) => {
  //     console.log('Stream found');
  //     localStream = stream;
  //     // Disable the microphone by default
  //     stream.getAudioTracks()[0].enabled = false;
  //     localStreamElement.srcObject = localStream;
  //     // Connect after making sure that local stream is availble
  //     socket.connect();
  //   })
  //   .catch(error => {
  //     console.error('Stream not found: ', error);
  //   });

  // QZ: my version for multiple cameras
  console.log("getlocalStream: enter getLocalStream");

  navigator.enumerateDevices(async function(devices) {
    cameras = [];
    devices.forEach(async function(device) {
      // if (!device.deviceId) {
      //     device.deviceId = device.id;
      // }
      // if (!device.id) {
      //     device.id = device.deviceId;
      // }
      if (device.kind === 'video' || device.kind === 'videoinput') {
          // if (cameras.indexOf(device) === -1) {
          //   cameras.push(device);
          // }
          cameras.push(device);
          allCameras.push(device);
      }
    });
    
    console.log("getlocalStream: after enumerateDevices(), cameras number %d", cameras.length);

    console.log("camera 1 id %s", cameras[0].deviceId);
    console.log("camera 1 label %s", cameras[0].label);
    console.log("camera 2 id %s", cameras[1].deviceId);
    console.log("camera 2 label %s", cameras[1].label);

    // local stream 1
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

    // local stream 2
    constraints2 = {
      'audio': {'echoCancellation': true},
      'video': {
          'deviceId': cameras[1].deviceId
          }
      }

    console.log("getlocalStream: before localStream2");
    let stream2 = await navigator.mediaDevices.getUserMedia(constraints2);
    localStream2 = stream2;
    localStream2Element.srcObject = stream2;
    
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
    pc.addStream(localStream2);
    console.log("createPeerConnection: after pc.addStream(localStream2)");

    // QZ: add tracks here
    // allCameras.forEach(function(camera) {
    //   constraints = {
    //     'audio': {'echoCancellation': true},
    //     'video': {
    //         'deviceId': camera.deviceId
    //         }
    //     }

    //   navigator.mediaDevices.getUserMedia(constraints)
    //     .then((stream) => {
    //       for (const track of stream.getTracks()) {
    //         console.log("adding track %s", track.id);
    //         pc.addTrack(track);
    //       }
    //     })
    //     .catch(error => {
    //       console.error('Error when adding stream: ', error);
    //     });

    // });

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
  if (Object.is(remoteStreamElement.srcObject, null)) {
    console.log('onTrack: Go for remoteStreamElement');
    remoteStreamElement.srcObject = event.streams[0];
  }
  else {
    console.log('onTrack: Go for remoteStream2Element');
    remoteStream2Element.srcObject = event.streams[0];
  }
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
