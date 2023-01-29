# Virtual Office Project

This repository serves as the codebase for the virtual office project. Currently, this demo works for two computers on a local network, e.g. Stanford CS, and assumes that each client in the chat has two available cameras.

## Get started

### Signaling server

The signaling server is built with aiohttp and socketio. Run the following commands to install the required libraries first.

```
cd signaling
pip install -r requirements.txt
python server.py
```

A websocket server will be hosted at the IP address and at the port number indicated in web.run_app(). Note that this server does not have to be hosted on any client's local computer.

### Web chat window

```
cd web
python -m http.server 6001
```

A web chat window will be started and hosted at `localhost:6001`. Feel free to change the port number.

### To-dos

As the next steps, we plan to make this demo work for computers on different networks, and to support more clients and more cameras in the chat.

## Reference

The implementation of the signaling server is adapted based on https://github.com/pfertyk/webrtc-working-example.