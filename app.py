from functools import lru_cache

from flask import Flask, jsonify, render_template

import preprocessing as pp

app = Flask(__name__)


@lru_cache(maxsize=1)
def get_payload():
    return pp.build_payload()


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/tracks")
def tracks():
    return jsonify(get_payload())


if __name__ == "__main__":
    app.run(debug=True)
