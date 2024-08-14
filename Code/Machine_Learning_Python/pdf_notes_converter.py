"""
Author: Alon Haviv, Stellar Intelligence.

Convert an audio data into music notes in a PDF format (transcription).

The script opens a socket server that listens to a number of clients, on port and host, 
all specified in Consts.json. When the script is ready and listening, it prints to the 
stdout a message given in Consts.json under "server_is_ready_msg". Once a socket connection 
is established, it reads a serialized data buffer of an audio file (as a socket request), 
and uses a Machine Learning algorithm to convert it into notes and sends back the transcription 
as a response.
"""

import os, sys, json
import socket

solutionBasePath =  os.path.join(os.getcwd(), '..')
consts = json.load(open(os.path.join(solutionBasePath, 'Consts.json'), 'r'))
totalclient = consts['max_files_transfer']  # max backlog of connections


def generate_notes(data_audio):
    """
    Transcript the given raw audio data (str) into music notes, and return it (as a string).

    data_audio (str) - The serialized raw data of an audio file, in UTF-8 format.
    """

    works = True
    if works:
        return {'code': consts['convertion_success'], 'data': 'This is a music notes sheet PDF.'}
    else:
        return {'code': consts['pdf_generation_failed_bad_input'], 'data': ''}  # Should it be bad_input or not?


def handle_client_connection(client_socket):
    """
    Read the request, which should be an audio file's data, generates music notes and send its treanscriptions as a response.

    client_socket - A connection object from socket.accept().
    """

    data_audio = client_socket.recv(1024).decode()
    if not data_audio:
        return
    data_pdf = generate_notes(data_audio)
    client_socket.send(json.dumps(data_pdf).encode())  # ".encode()" converts the string to a byte string (default encoding is UTF-8).
    client_socket.close()


if __name__ == "__main__":
    """Usage: python pdf_notes_converter.py
    Then, on another terminal, open a client connection to the printed port and host.
    Send an audio serialized data and receive its transcription.
    """

    server_soc = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_soc.bind((consts["py_converter_host"], consts["py_converter_port"]))
    server_soc.listen(totalclient)  # max backlog of connections
    print(f'{consts["server_is_ready_msg"]} on host {consts["py_converter_host"]} and port {consts["py_converter_port"]}', flush=True)

    # Establishing Connections
    for i in range(totalclient):
        try:
            client_sock, address = server_soc.accept()
            handle_client_connection(client_sock)
        except:
            # An error in 1 connection shouldn't stop us from continue handling other connection requests.
            # A possible collapse of the connection will trigger a sudden "close" event on the client side, 
            # and they'll handle it.
            print(f'Socket connection error for {address}.', file=sys.stderr)
            continue
    #print('The end.')
    sys.exit(consts["convertion_success"])

