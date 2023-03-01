# Virtual Office Project

This repository serves as the codebase for the virtual office project. Currently, the system works on any device that has a private IP address on the Stanford campus network, and we expect that the signaling server would be able to host ~50 people at the same time at its maximum.

## Get started

### Enabling the Microphone/Camera in browser for (Local) Unsecure Origins 

For Chrome, navigate to

```
chrome://flags/#unsafely-treat-insecure-origin-as-secure
```

Enable the `Insecure origins treated as secure` section and enter `http://localhost:6001`.

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

### Web chat window

```
cd goto-lunch-web
python -m http.server 6001
```

A web chat window will be started and hosted at `localhost:6001`. Feel free to change the port number.

### To-dos

As the next steps, we plan to make this demo work for computers on different networks.

## Reference

The implementation of the signaling server is adapted based on https://github.com/pfertyk/webrtc-working-example.
