"""
Author: Alon Haviv, Stellar Intelligence.

Convert an audio data into music notes in a PDF format (transcription).

The script opens a socket server that listens to a number of clients, on port and host, 
all specified in Consts.json. When the script is ready and listening, it prints to the 
stdout a message given in Consts.json under "server_is_ready_msg". Once a socket connection 
is established, it reads a serialized data buffer of an audio file (as a socket request), 
and uses a Machine Learning algorithm to convert it into notes and sends back the transcription 
as a response. It can handle a single musical instrument, or multiple instruments. Set by 
instruments_mode argument.
"""


# General system imports:
import importlib, os, sys
import json
import socket
from utils_py.serialized_objects import TranscribedMidiData, AudioDataToTranscribe
from utils_py.loggers import ENVS, log, error_log
import threading
import time

solutionBasePath = os.path.normpath(os.path.join(os.path.dirname(__file__), '..'))
with open(os.path.join(solutionBasePath, 'Consts.json'), 'r') as consts_file:
    consts = json.load(consts_file)

# Other constants:
totalclient = consts['max_files_transfer']  # max backlog of connections
script_name = os.path.basename(__file__)  # Will be usefull for logging.
ai_model = consts["ai_model"]  # The AI model that is used to transcribe.
models_dir = "Models"  # The directory of the models classes.


def import_AI_model(ai_model: str):
    """Import the AI model and return its wrapper class."""

    module_name = consts["models_arguments"][ai_model]["module"]
    class_name = consts["models_arguments"][ai_model]["class"]
    module = importlib.import_module(f"{models_dir}.{module_name}")
    return getattr(module, class_name)

def transcribe_wav_to_midi(audio_dir_path: str, instruments_mode: int) -> TranscribedMidiData:
    """
    Transcribe the audio files in the given "audio_dir_path" source directory into midi.
    Return a "TranscribedMidiData" object containing the results (the .mid files shall 
    be saved in the directory). Uses an AI model from the "Models" directory.
    Raise an exception upon failure.

    audio_dir_path - The path to the directory with the source audio files. It's also 
        the target directory for saving the resulted midi files.
    instruments_mode - Determine how to treat the musical instruments of in the audio file.
    """
    Model = import_AI_model(ai_model)
    args = consts["models_arguments"][ai_model]["args"]
    # Run the model from Models/
    try:
        model = Model(args)
        model.set_audio_dir(audio_dir_path)
        return model.run()
    except Exception as exp:
        raise exp

def receive_data_from_client(client_socket: socket.SocketType) -> str:
    """
    Read incoming message from the "client_socket" socket connection, decode it and return it.
    Raise an exception upon failure or if the message is too long.

    client_socket - The client socket the sends the incoming message.
    """

    bytes_received = 0
    max_bytes_len = consts["max_size_Bytes"]  # The max file size + directory's path and other metadata.
    chunk = b''  # Each chunk of data.
    chunks = []  # The total combined data recieved.
    CHUNK_SIZE = 16384  # 16 KB to read

    # Read all the data in a loop (it might be too long for one read). Continue 
    # until no more data arrives or until we've passed "max_bytes_len" (in which 
    # case raise an exception):
    while True:
        if bytes_received > max_bytes_len:
            # Prevent memory abuse, DoS attack or corrupted peer.
            raise RuntimeError("Stopped receiving incoming data because the Client socket message " + \
                f"is too long ( > {max_bytes_len} Bytes).")

        # Read a chunk:
        chunk = client_socket.recv(CHUNK_SIZE)
        if not chunk or len(chunk) == 0:
            # We've finished.
            break

        # Append and continue:
        chunks.append(chunk)
        bytes_received += len(chunk)

    data = b''.join(chunks).decode('utf-8')
    return data

def receive_and_parse_data_from_client(client_socket: socket.SocketType) -> AudioDataToTranscribe:
    """
    Read the socket request message from the client socket "client_socket", 
    parse it into a "AudioDataToTranscribe" object and return it.
    Raise an exception upon failure in the reading or parsing, or if the parsed 
    data is invalid (not a legitimate directory)
    
    client_socket - A connection object from socket.accept().
    """

    # Read the message from the client socket and parse it into AudioDataToTranscribe object:
    try:
        received_data = receive_data_from_client(client_socket)
        audio_data_obj = AudioDataToTranscribe.from_json(json.loads(received_data))
    except Exception as e:
        raise e

    # Check the input validity:
    audio_dir_path = audio_data_obj.audio_dir_path
    if not audio_dir_path or not os.path.isdir(audio_dir_path):
        raise ValueError(f'The path sent by the client socket isn\'t a valid directory: "{audio_dir_path}"')

    return audio_data_obj

def send_response_to_client(client_socket: socket.SocketType, transcribed_data: TranscribedMidiData):
    """Send a response message  through "client_socket". The message is a json string of "transcribed_data"."""
    data_message = transcribed_data.get_json_str()  # Get the data as a json string.
    client_socket.sendall(data_message.encode('utf-8'))  # ".encode()" converts the string to a byte string (default encoding is UTF-8).

def handle_client_connection(client_socket: socket.SocketType, instruments_mode: int):
    """
    Read the socket request message from the client socket "client_socket", which should be a 
    json in the format "AudioDataToTranscribe" ({audio_dir_path: str, data (optional): str}) 
    representing data of an audio file, then transcribe it and generate and save a midi file.
    Then send its data through the socket as a response. The respond format is a json of 
    "TranscribedMidiData".
    Raise an exception upon failure.

    client_socket - A connection object from socket.accept().
    instruments_mode - Determine how to treat the musical instruments of in the audio file.
    """

    # Read the message from the client socket as an "AudioDataToTranscribe" object:
    try:
        audio_data_obj = receive_and_parse_data_from_client(client_socket)
        audio_dir_path = audio_data_obj.audio_dir_path
        audio_data_bytes = audio_data_obj.data  # Not really required here.
    except Exception as e:
        error_log(ENVS.ALL, f'{script_name}: Received invalid message from client socket.')
        raise e

    # Log that the data was received successfully.
    log(ENVS.DEVELOPMENT, f'{script_name}: Received data from client socket:\n' + \
        f'\tlen(data) = {len(audio_data_bytes)}, audio_dir_path = {audio_dir_path}')

    # Sending a keep-alive message to the client as long as the process is running:
    keep_alive_running = True
    def send_keep_alive():
        while keep_alive_running:
            try:
                client_socket.sendall(consts["KEEP_ALIVE_MSG"].encode('utf-8'))
            except Exception as e:
                error_log(ENVS.ALL, f'{script_name}: Failed to send Keep-Alive message to the client socket.')
                break
            time.sleep(consts["KEEP_ALIVE_INTERVAL_SEC"])

    # Start the keep-alive thread
    keep_alive_thread = threading.Thread(target=send_keep_alive, daemon=True)
    keep_alive_thread.start()
    # Transcribe the audio data into midi:
    try:
        transcribed_data = transcribe_wav_to_midi(audio_dir_path, instruments_mode)
    except Exception as e:
        error_log(ENVS.ALL, f'{script_name}: Failed to transcribe the audio file in "{audio_dir_path}" into midi.')
        raise e
    finally:
        # Stop keep-alive and clean up
        keep_alive_running = False
        keep_alive_thread.join(timeout=consts["KEEP_ALIVE_INTERVAL_SEC"] + 1)

    # Log that the transcription was successful.
    log(ENVS.DEVELOPMENT, f'{script_name}: Transcribed the audio files into midi.\n' + \
        f'\tcode = {transcribed_data.code}, len(data) = {len(transcribed_data.data)}, midi fnames = {transcribed_data.fnames}')

    # Send a response with the transcribed data to the client socket:
    try:
        send_response_to_client(client_socket, transcribed_data)
    except Exception as e:
        error_log(ENVS.ALL, f'{script_name}: Failed to send the respose back to the client socket.')
        raise e

    # Log that the response is sent successfully:
    log(ENVS.DEVELOPMENT, f'{script_name}: Transcribed results sent.')

def open_socket():
    """
    Create and open a server socket on the host and port provided in "consts". 
    Print an important consts["server_is_ready_msg"] message to the STDOUT, 
    and return the server socket."""
    server_soc = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_soc.bind((consts["py_converter_host"], consts["py_converter_port"]))
    server_soc.listen(totalclient)  # max backlog of connections

    # IMPORTANT! Print server_is_ready_msg message to the STDOUT, signaling to the other side of the socket that the process is running:
    print(f'{consts["server_is_ready_msg"]} on host {consts["py_converter_host"]} and port {consts["py_converter_port"]}', flush=True)

    return server_soc

def main(argv):
    """
    Open a socket connection and print a ready message to the STDOUT once the connection is ready 
    and listening. for each connection, receive a json with a source audio file in the format of 
    "AudioDataToTranscribe" and use an AI model to transcribe it and generate and save a midi file. 
    Send back a json response in the format of "TranscribedMidiData". At the end, return a code 
    that signals a success/failure."""

    # Get the instruments mode:
    if len(argv) == 2 and argv[1].isdigit:
        instruments_mode = int(argv[1])
    else:
        instruments_mode = consts["instruments_options"]["many"]["value"]

    # Open a "server" socket that listens to calls from the "clients" (the controller.js).
    # Note: In application terms, both socket parts (the python and nodejs) are parts of the App's server side.
    server_soc = open_socket()

    # Establishing Connections
    conn_results = []  # To keep track over each connection results.
    for i in range(totalclient):
        try:
            # Connect with a client and handle its request.
            client_sock, address = server_soc.accept()
            handle_client_connection(client_sock, instruments_mode)
            conn_results.append(True)
        except Exception as e:
            # An error in 1 connection shouldn't stop us from continue handling other connection requests.
            # A possible collapse of the connection will trigger a sudden "close" event on the client side, 
            # and they'll handle it.
            conn_results.append(False)
            error_log(ENVS.ALL, f'{script_name}: Transcription process for connection number {i} failed. ' + \
                f'Continue to the next connection.\n\tFailure reason: {e}')
            continue
        finally:
            # Ensure this client connection is closed.
            if client_sock:
                client_sock.close()

    server_soc.close()

    # Return success if ALL the connection succeeded (at last partialy), return partial-success if 
    # only some succeeded, and return failure if non succeeded:
    status_code = consts["convertion_success"] if (len(conn_results) > 0 and all(conn_results)) else \
        consts["convertion_partial_success"] if any(conn_results) else consts["midi_generation_failed"]
    log(ENVS.DEVELOPMENT, f'{script_name}: Finished all transcribings. Returning code {status_code}.')
    return status_code

if __name__ == "__main__":
    """Usage: python transcribe.py [optional: 1|2]
    Then, on another terminal, open a client connection to the printed port and host.
    Send a json in the "AudioDataToTranscribe" format: 
    {audio_dir_path: str, data (optional): str (binary buffer)}
    and receive its transcription response in the "TranscribedMidiData" format: 
    {code: int, fnames: list[str], data (optional): str (binary buffer)}.
    """
    code = main(sys.argv)
    sys.exit(code)