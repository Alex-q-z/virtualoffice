from flask import Flask, request, redirect, url_for, render_template

app = Flask(__name__)

@app.route('/')
def login():
    return '''
        <form method="POST">
            <h1>Stanford Virtual Office Project</h1>
            <label>Username:</label>
            <input type="text" name="username"><br><br>
            <label>Device type:</label>
            <input type="text" name="device_type"><br><br>
            <input type="submit" value="Login">
        </form>
    '''

@app.route('/', methods=['POST'])
def login_submit():
    username = request.form['username']
    device_type = request.form['device_type']
    # Store the username and device_type in a database or file
    # ...
    return redirect(url_for('new_page', username=username, device_type=device_type))

@app.route('/new_page')
def new_page():
    # Get the username and device_type from the URL parameters
    username = request.args.get('username')
    device_type = request.args.get('device_type')

    # Render the new page with the username and device_type
    return render_template('index.html', username=username, device_type=device_type)

if __name__ == '__main__':
    app.run(host='10.28.68.45', port=5000)