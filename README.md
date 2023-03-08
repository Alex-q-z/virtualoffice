# Virtual Office Project

This repository serves as the codebase for the virtual office project. Currently, the system works on any device that has a private IP address on the Stanford campus network, and we expect that the signaling server would be able to host ~50 people at the same time at its maximum.

## Get started

### Enabling the Microphone/Camera in browser for (Local) Unsecure Origins 

For Chrome, type the following in the URL field

```
chrome://flags/#unsafely-treat-insecure-origin-as-secure
```

Enable the `Insecure origins treated as secure` section and enter `http://localhost:6001`.

**WARNING: For Chrome, you might need to restart your browser after you change the settings above. Save the tabs!**

For Firefix, type `about:config` and set the values of `media.devices.insecure.enabled` and `media.getusermedia.insecure.enabled` to be `true`.

### Signaling server

**NOTE: Qizheng is hosting and maintaining the signaling server now, so you can skip this step.**

The signaling server is built with aiohttp and socketio. Run the following commands to install the required libraries first.

```
cd signaling
pip install -r requirements.txt
python server.py
```

A websocket server will be hosted at the IP address and at the port number indicated in web.run_app(). Note that this server does not have to be hosted on any client's local computer.

### User information

To set up personal info that will be displayed during the chat, do

```
cd goto-lunch-web
touch clientconfig.js
```

In `clientconfig.js`, put the following lines

```
const USER_ID = "your name";
const DEVICE = "your device";
let USER_INFO = {"user_id": USER_ID, "device": DEVICE};
```

Note that this information will be broadcast to other users when you get online.

### Web chat client

To start the web chat client, do

```
cd goto-lunch-web
python -m http.server 6001
```

A web chat window will be started and hosted at `localhost:6001`. Feel free to change the port number.

## Reference

The implementation of the signaling server is adapted based on https://github.com/pfertyk/webrtc-working-example.
