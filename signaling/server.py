from aiohttp import web
import socketio
from collections import defaultdict

LOBBY = 'lobby'
rooms_and_user_info = defaultdict(dict)
# an example
# rooms_and_user_info = {
#     "lobby": {SIDQZ: {"user_id": "Qizheng Zhang", "device": "laptop", "availability": "busy"},
#               SIDJH: {"user_id": "James Hong", "device": "laptop", "availability": "busy"},
#               SIDKF: {"user_id": "Kayvon Fatahalian", "device": "door", "availability": "free"}},
#     "gates_3b_381": {SIDQZ: {"user_id": "Qizheng Zhang", "device": "laptop", "availability": "busy"},
#                      SIDJH: {"user_id": "James Hong", "device": "laptop", "availability": "busy"}},
# }
sid_and_user_info = defaultdict(dict)
# an example
# sid_and_user_info = {
#     SIDQZ: {"user_id": "Qizheng Zhang", "device": "laptop", "availability": "busy", "current_chat_room": "gates_3b_381"}
# }

sio = socketio.AsyncServer(cors_allowed_origins='*', ping_timeout=35)
app = web.Application()
sio.attach(app)

def add_user_to_room(room, sid, user_info):
    if room != LOBBY:
        user_info["availability"] = "busy"
    else:
        user_info["availability"] = "free"
        sid_and_user_info[sid] = user_info
    # add user information to rooms_and_user_info
    sid_and_user_info[sid]["current_chat_room"] = room
    rooms_and_user_info[room][sid] = user_info

def remove_user_from_room(room, sid):
    # if user is not in the given room, return
    if not sid in rooms_and_user_info[room].keys():
        return
    
    if room != LOBBY:
        # set availability in rooms_and_user_info when they are removed from a private chat room
        rooms_and_user_info[LOBBY][sid]["availability"] = "free"
        # set current_chat_room in sid_and_user_info when they are removed from a private chat room
        sid_and_user_info[sid]["availability"] = "free"
        sid_and_user_info[sid]["current_chat_room"] = LOBBY
    else:
        sid_and_user_info.pop(sid)
    
    # remove user from the room in rooms_and_user_info
    rooms_and_user_info[room].pop(sid)

def close_room(room):
    assert room != LOBBY
    assert room in rooms_and_user_info.keys()
    rooms_and_user_info.pop(room)

def if_user_in_room(room, sid):
    return sid in rooms_and_user_info[room].keys()

@sio.event
def connect(sid, environ):
    print('Connected', sid)

@sio.event
async def new_user_connect_to_server(sid, user_info):
    print('New user info', user_info)
    sid_and_user_info[sid] = user_info
    # await sio.emit('ready', room=LOBBY, skip_sid=sid)
    # enter the main lobby
    sio.enter_room(sid, LOBBY)
    # 1. update rooms_and_user_info (stored at server side)
    # 1. broadcast latest rooms_and_user_info to everyone in the room
    add_user_to_room(LOBBY, sid, user_info)
    await sio.emit('broadcast_connection_update', rooms_and_user_info[LOBBY], room=LOBBY)

@sio.event
async def new_user_connect_to_call(sid, user_info):
    print('New user info', user_info)
    await sio.emit('ready', room=LOBBY, skip_sid=sid)
    # enter the chat room
    sio.enter_room(sid, LOBBY)
    # 1. update rooms_and_user_info (stored at server side)
    # 1. broadcast latest rooms_and_user_info to everyone in the room
    add_user_to_room(LOBBY, sid, user_info)
    await sio.emit('broadcast_connection_update', rooms_and_user_info[LOBBY], room=LOBBY)

@sio.event
async def webrtc_connect_request(sid, other_user_sid):
    assert if_user_in_room(LOBBY, other_user_sid)
    print(f"WebRTC connect request from {sid} to {other_user_sid}")
    private_chat_room_name = sid + "_" + other_user_sid

    # add both sides to the private chat room
    sio.enter_room(sid, private_chat_room_name)
    sio.enter_room(other_user_sid, private_chat_room_name)
    add_user_to_room(private_chat_room_name, sid, sid_and_user_info[sid])
    add_user_to_room(private_chat_room_name, other_user_sid, sid_and_user_info[other_user_sid])

    # broadcast the other side for further actions
    # WARNING: this would trigger the call initiator to send a webrtc offer
    await sio.emit('ready', room=private_chat_room_name, skip_sid=other_user_sid)

@sio.event
async def webrtc_disconnect_request(sid, other_user_sid):
    private_chat_room_name = sid + "_" + other_user_sid
    # broadcast the other side for further actions
    await sio.emit('webrtc_disconnect', room=private_chat_room_name, skip_sid=sid)
    # remove the private chatroom, and update the server-side user info cache
    remove_user_from_room(private_chat_room_name, sid)
    remove_user_from_room(private_chat_room_name, other_user_sid)
    sio.leave_room(sid, private_chat_room_name)
    sio.leave_room(other_user_sid, private_chat_room_name)
    close_room(private_chat_room_name)

@sio.event
async def disconnect(sid):
    # leave the main room
    sio.leave_room(sid, LOBBY)
    print('Disconnected', sid)
    
    # 1. update rooms_and_user_info (stored at server side)
    # 1. broadcast latest rooms_and_user_info to everyone in the room
    remove_user_from_room(room=LOBBY, sid=sid)
    await sio.emit('broadcast_connection_update', rooms_and_user_info[LOBBY], room=LOBBY)

# @sio.event
# async def data(sid, data):
#     # print('Message from {}: {}'.format(sid, data))
#     await sio.emit('data', data, room=LOBBY, skip_sid=sid)

@sio.event
async def global_data(sid, data):
    # print('Message from {}: {}'.format(sid, data))
    await sio.emit('data', data, room=LOBBY, skip_sid=sid)

@sio.event
async def local_data(sid, data):
    print('Local data from {}: {}'.format(sid, data))
    private_chat_room = sid_and_user_info[sid]["current_chat_room"]
    await sio.emit('data', data, room=private_chat_room, skip_sid=sid)

if __name__ == '__main__':
    web.run_app(app, host="10.5.65.215", port=9999)
