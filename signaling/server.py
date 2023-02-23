from aiohttp import web
import socketio
from collections import defaultdict

ROOM = 'room'
user_list = defaultdict(list)

sio = socketio.AsyncServer(cors_allowed_origins='*', ping_timeout=35)
app = web.Application()
sio.attach(app)

def add_user_to_list(room, user_info):
    user_list[room].append(user_info)

def remove_user_from_list(room, sid):
    for k in range(len(user_list[room])):
        if user_list[room][k]["sid"] == sid:
            user_list[room].remove(user_list[room][k])
            break

@sio.event
def connect(sid, environ):
    print('Connected', sid)

@sio.event
async def broadcast_update(sid, user_info):
    print('New user info', user_info)
    user_info["sid"] = sid
    await sio.emit('ready', room=ROOM, skip_sid=sid)
    # enter the chat room
    sio.enter_room(sid, ROOM)
    # 1. update user_list (stored at server side)
    # 1. broadcast latest user_list to everyone in the room
    add_user_to_list(room=ROOM, user_info=user_info)
    await sio.emit('broadcast_update', user_list[ROOM], room=ROOM)

@sio.event
async def disconnect(sid):
    sio.leave_room(sid, ROOM)
    print('Disconnected', sid)
    # 1. update user_list (stored at server side)
    # 1. broadcast latest user_list to everyone in the room
    remove_user_from_list(room=ROOM, sid=sid)
    await sio.emit('broadcast_update', user_list[ROOM], room=ROOM)

@sio.event
async def data(sid, data):
    # print('Message from {}: {}'.format(sid, data))
    await sio.emit('data', data, room=ROOM, skip_sid=sid)

if __name__ == '__main__':
    web.run_app(app, host="172.27.76.160", port=9999)
