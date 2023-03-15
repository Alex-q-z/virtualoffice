from aiohttp import web
import socketio
from collections import defaultdict

import logging
import time
logging.basicConfig(filename='sig_server.log', level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

LOBBY = 'lobby'
# rooms_and_user_info = defaultdict(dict)
rooms_and_user_info = defaultdict(list)
# an example
# rooms_and_user_info = {
#     "lobby": [SIDQZ, SIDJH, SIDKF],
#     "gates_3b_381": [SIDQZ, SIDJH]
# }

sid_and_user_info = defaultdict(dict)
# an example
# sid_and_user_info = {
#     SIDQZ: {"user_id": "Qizheng Zhang", "device": "laptop", "availability": "busy", "current_chat_room": "gates_3b_381"}
# }

routes = web.RouteTableDef()
@routes.get('/')
async def index_handler(request):
    return web.Response(
        text='<h1>Hello!</h1>',
        content_type='text/html')

sio = socketio.AsyncServer(cors_allowed_origins='*', ping_timeout=35)
app = web.Application()
app.add_routes(routes)
sio.attach(app)

# def add_user_to_room(room, sid, user_info):
#     if room != LOBBY:
#         user_info["availability"] = "busy"
#     else:
#         user_info["availability"] = "free"
#         sid_and_user_info[sid] = user_info
#     # add user information to rooms_and_user_info
#     sid_and_user_info[sid]["current_chat_room"] = room
#     rooms_and_user_info[room][sid] = user_info

def add_user_to_room(room, sid):
    if room != LOBBY:
        sid_and_user_info[sid]["availability"] = "busy"
    else:
        sid_and_user_info[sid]["availability"] = "free"
    # add user information to rooms_and_user_info
    sid_and_user_info[sid]["current_chat_room"] = room
    rooms_and_user_info[room].append(sid)

def remove_user_from_room(room, sid):
    # if user is not in the given room, return
    if not sid in rooms_and_user_info[room]:
        return
    
    if room != LOBBY:
        sid_and_user_info[sid]["availability"] = "free"
        sid_and_user_info[sid]["current_chat_room"] = LOBBY
    else:
        sid_and_user_info.pop(sid)
    
    # remove user from the room in rooms_and_user_info
    rooms_and_user_info[room].remove(sid)

def close_room(room):
    assert room != LOBBY
    assert room in rooms_and_user_info
    rooms_and_user_info.pop(room)

def if_user_in_room(room, sid):
    return sid in rooms_and_user_info[room]

def generate_broadcast_content():
    broadcast_content = {}
    for sid in rooms_and_user_info[LOBBY]:
        # for now, let's just broadcast all info of a user
        # this should be changed later for privacy concerns
        broadcast_content[sid] = sid_and_user_info[sid]
    return broadcast_content

@sio.event
def connect(sid, environ):
    print('Connected', sid)

@sio.event
async def new_user_connect_to_server(sid, user_info):
    print('New user info', user_info)
    logging.info(f"User connects to the server: {user_info}")
    sid_and_user_info[sid] = user_info
    sio.enter_room(sid, sid)
    # enter the main lobby
    sio.enter_room(sid, LOBBY)
    # 1. update rooms_and_user_info (stored at server side)
    # 1. broadcast latest rooms_and_user_info to everyone in the room
    add_user_to_room(LOBBY, sid)
    # generate the broadcast content (user info that all clients should have access to)
    broadcast_content = generate_broadcast_content()
    await sio.emit('broadcast_connection_update', broadcast_content, room=LOBBY)

# @sio.event
# async def new_user_connect_to_call(sid, user_info):
#     print('New user info', user_info)
#     await sio.emit('ready', room=LOBBY, skip_sid=sid)
#     # enter the chat room
#     sio.enter_room(sid, LOBBY)
#     # 1. update rooms_and_user_info (stored at server side)
#     # 1. broadcast latest rooms_and_user_info to everyone in the room
#     add_user_to_room(LOBBY, sid, user_info)
#     await sio.emit('broadcast_connection_update', rooms_and_user_info[LOBBY], room=LOBBY)

# @sio.event
# async def update_user_info(sid, user_info):
#     for user_info_key in user_info:
#         if user_info_key in sid_and_user_info[sid]:
#             sid_and_user_info[sid][user_info_key] = user_info[user_info_key]

@sio.event
async def update_do_not_disturb(sid, doNotDisturb):
    # logging.info(f"WebRTC connect request from <{user_1}/{sid}> to <{user_2}/{other_user_sid}>")
    sid_and_user_info[sid]["do_not_disturb"] = doNotDisturb
    # broadcast (WARNING: could be a DoS attack)
    broadcast_content = generate_broadcast_content()
    await sio.emit('broadcast_connection_update', broadcast_content, room=LOBBY)

@sio.event
async def webrtc_connect_request(sid, request_details):
    other_user_sid = request_details["other_user"]
    video_audio_on = request_details["video_audio_on"]

    assert if_user_in_room(LOBBY, other_user_sid)
    
    user_1 = sid_and_user_info[sid]["user_id"]
    user_2 = sid_and_user_info[other_user_sid]["user_id"]
    print(f"WebRTC connect request from <{user_1}/{sid}> to <{user_2}/{other_user_sid}>")
    logging.info(f"WebRTC connect request from <{user_1}/{sid}> to <{user_2}/{other_user_sid}>")

    # do-not-disturb related
    if "do_not_disturb" in sid_and_user_info[other_user_sid] \
        and sid_and_user_info[other_user_sid]["do_not_disturb"]:
        logging.info(f"WebRTC connect request declined: <{user_2}/{other_user_sid}> is on do-not-disturb mode")
        # await sio.emit('connect_request_declined', room=private_chat_room_name, skip_sid=other_user_sid)
        return 

    if sid_and_user_info[other_user_sid]["availability"] == "busy":
        logging.info(f"WebRTC connect request declined: <{user_2}/{other_user_sid}> is on another call right now")
        # await sio.emit('connect_request_declined', room=private_chat_room_name, skip_sid=other_user_sid)
        return 

    # add both sides to the private chat room
    private_chat_room_name = sid + "_" + other_user_sid
    sio.enter_room(sid, private_chat_room_name)
    sio.enter_room(other_user_sid, private_chat_room_name)
    add_user_to_room(private_chat_room_name, sid)
    add_user_to_room(private_chat_room_name, other_user_sid)

    # broadcast the other side for further actions
    # WARNING: this would trigger the call initiator to send a webrtc offer
    if video_audio_on == 0:
        await sio.emit('ready', room=private_chat_room_name, skip_sid=other_user_sid)
    elif video_audio_on == 1:
        await sio.emit('peak_ready', room=private_chat_room_name, skip_sid=other_user_sid)
    else:
        logging.info(f"Unknown value of video_audio_on in webrtc_connect_request: {video_audio_on}")

    # generate the broadcast content (user info that all clients should have access to)
    broadcast_content = generate_broadcast_content()
    await sio.emit('broadcast_connection_update', broadcast_content, room=LOBBY)

@sio.event
async def webrtc_disconnect_request(sid, other_user_sid):
    private_chat_room = sid_and_user_info[sid]["current_chat_room"]
    user_1 = sid_and_user_info[sid]["user_id"]
    user_2 = sid_and_user_info[other_user_sid]["user_id"]
    print(f"WebRTC disconnect request from {sid} to {other_user_sid}")
    logging.info(f"WebRTC disconnect request from <{user_1}/{sid}> to <{user_2}/{other_user_sid}>")
    
    # broadcast the other side for further actions
    await sio.emit('webrtc_disconnect', room=private_chat_room, skip_sid=sid)
    
    # remove the private chatroom, and update the server-side user info cache
    remove_user_from_room(private_chat_room, sid)
    remove_user_from_room(private_chat_room, other_user_sid)
    sio.leave_room(sid, private_chat_room)
    sio.leave_room(other_user_sid, private_chat_room)
    close_room(private_chat_room)
    
    # generate the broadcast content (user info that all clients should have access to)
    broadcast_content = generate_broadcast_content()
    await sio.emit('broadcast_connection_update', broadcast_content, room=LOBBY)

@sio.event
async def disconnect(sid):
    # leave the main room
    sio.leave_room(sid, LOBBY)
    print('Disconnected', sid)
    logging.info(f"User disconnects from the server: {sid_and_user_info[sid]}")
    
    # 1. update rooms_and_user_info (stored at server side)
    # 1. broadcast latest rooms_and_user_info to everyone in the room
    remove_user_from_room(LOBBY, sid)
    # generate the broadcast content (user info that all clients should have access to)
    broadcast_content = generate_broadcast_content()
    await sio.emit('broadcast_connection_update', broadcast_content, room=LOBBY)

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
    private_chat_room = sid_and_user_info[sid]["current_chat_room"]
    user_data_sender = sid_and_user_info[sid]["user_id"]
    print('Local data from {}: {}'.format(sid, data["type"]))
    logging.info("Local data from <{}/{}> to {}: {}".format(user_data_sender, sid, private_chat_room, data["type"]))
    await sio.emit('data', data, room=private_chat_room, skip_sid=sid)

if __name__ == '__main__':
    web.run_app(app, host="10.5.65.215", port=9999)
