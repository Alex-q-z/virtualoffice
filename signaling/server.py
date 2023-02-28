from aiohttp import web
import socketio
from collections import defaultdict

LOBBY = 'lobby'
rooms_and_user_info = defaultdict(list)
# an example
# rooms_and_user_info = {
#     "lobby": [{"user_id": "Qizheng Zhang", "device": "laptop", "sid": "XXXXXXXX"},
#               {"user_id": "James Hong", "device": "laptop", "sid": "YYYYYYYY"},
#               {"user_id": "Kayvon Fatahalian", "device": "door", "sid": "ZZZZZZZ"}],
#     "gates_3b_381": [{"user_id": "Qizheng Zhang", "device": "laptop", "sid": "XXXXXXXX"},
#                      {"user_id": "James Hong", "device": "laptop", "sid": "YYYYYYYY"}],
# }
sid_and_user_info = {}

sio = socketio.AsyncServer(cors_allowed_origins='*', ping_timeout=35)
app = web.Application()
sio.attach(app)

def add_user_to_room(room, user_info):
    if room != LOBBY:
        user_info["availability"] = "busy"
        sid_and_user_info[user_info["sid"]]["current_chat_room"] = room
    rooms_and_user_info[room].append(user_info)

def remove_user_from_room(room, sid):
    if not sid in [user_info["sid"] for user_info in rooms_and_user_info[room]]:
        return
    for k in range(len(rooms_and_user_info[room])):
        if rooms_and_user_info[room][k]["sid"] == sid:
            rooms_and_user_info[room].remove(rooms_and_user_info[room][k])
            break

def if_user_in_room(room, sid):
    all_user_sid_in_room = [user_info["sid"] for user_info in rooms_and_user_info[room]]
    return sid in all_user_sid_in_room

@sio.event
def connect(sid, environ):
    print('Connected', sid)

@sio.event
async def new_user_connect_to_server(sid, user_info):
    print('New user info', user_info)
    user_info["sid"] = sid
    user_info["availability"] = "free"
    sid_and_user_info[sid] = user_info
    # await sio.emit('ready', room=LOBBY, skip_sid=sid)
    # enter the main lobby
    sio.enter_room(sid, LOBBY)
    # 1. update rooms_and_user_info (stored at server side)
    # 1. broadcast latest rooms_and_user_info to everyone in the room
    add_user_to_room(room=LOBBY, user_info=user_info)
    await sio.emit('broadcast_connection_update', rooms_and_user_info[LOBBY], room=LOBBY)

@sio.event
async def new_user_connect_to_call(sid, user_info):
    print('New user info', user_info)
    user_info["sid"] = sid
    await sio.emit('ready', room=LOBBY, skip_sid=sid)
    # enter the chat room
    sio.enter_room(sid, LOBBY)
    # 1. update rooms_and_user_info (stored at server side)
    # 1. broadcast latest rooms_and_user_info to everyone in the room
    add_user_to_room(room=LOBBY, user_info=user_info)
    await sio.emit('broadcast_connection_update', rooms_and_user_info[LOBBY], room=LOBBY)

@sio.event
async def webrtc_connect_request(sid, other_user_sid):
    assert if_user_in_room(LOBBY, other_user_sid)
    private_chat_room_name = sid + "_" + other_user_sid

    # add both sides to the private chat room
    sio.enter_room(sid, private_chat_room_name)
    sio.enter_room(other_user_sid, private_chat_room_name)
    add_user_to_room(room=private_chat_room_name, user_info=sid_and_user_info[sid])
    add_user_to_room(room=private_chat_room_name, user_info=sid_and_user_info[other_user_sid])

    # broadcast both sides for further actions
    # WARNING: this would trigger the call initiator to send a webrtc offer
    await sio.emit('ready', room=private_chat_room_name, skip_sid=other_user_sid)

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
async def data(sid, data):
    # print('Message from {}: {}'.format(sid, data))
    private_chat_room = sid_and_user_info[sid]["current_chat_room"]
    await sio.emit('data', data, room=private_chat_room, skip_sid=sid)

@sio.event
async def global_data(sid, data):
    # print('Message from {}: {}'.format(sid, data))
    await sio.emit('data', data, room=LOBBY, skip_sid=sid)

# @sio.event
# async def local_data(sid, data):
#     # print('Message from {}: {}'.format(sid, data))
#     private_chat_room = sid_and_user_info[sid]["current_chat_room"]
#     await sio.emit('data', data, room=private_chat_room, skip_sid=sid)

if __name__ == '__main__':
    web.run_app(app, host="10.5.65.215", port=9999)
