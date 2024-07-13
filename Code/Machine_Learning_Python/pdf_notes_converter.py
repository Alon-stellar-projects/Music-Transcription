import os, sys, json
import socket

solutionBasePath =  os.path.join(os.getcwd(), '..')
consts = json.load(open(os.path.join(solutionBasePath, 'Consts.json'), 'r'))
totalclient = consts['max_files_transfer']  # max backlog of connections


def generate_notes(data_audio):
    works = True
    if works:
        print('In pdf_notes_converter.py: returning data!') # Remove!
        return 'This is a music notes sheet PDF.'
    else:
        return consts["pdf_generation_failed"]


def handle_client_connection(client_socket):
    data_audio = client_socket.recv(1024).decode()
    if not data_audio:
        #print('In pdf_notes_converter.py: no data_audio!', file=sys.stderr) # Remove!
        return
    data_pdf = generate_notes(data_audio)
    #print('In pdf_notes_converter.py: sending data back!') # Remove!
    client_socket.send(str(data_pdf).encode())
    client_socket.close()


if __name__ == "__main__":
    #print('In pdf_notes_converter.py: Starting') # Remove!
    server_soc = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    #print('In pdf_notes_converter.py: Before bind') # Remove!
    server_soc.bind((consts["py_converter_host"], consts["py_converter_port"])) # Consider get the port via argv.
    #print('In pdf_notes_converter.py: before listening') # Remove!
    server_soc.listen(totalclient)  # max backlog of connections
    print(f'{consts["server_is_ready_msg"]} on host {consts["py_converter_host"]} and port {consts["py_converter_port"]}', flush=True)

    # Establishing Connections
    #connections = []
    for i in range(totalclient):
        client_sock, _ = server_soc.accept()
        #connections.append(client_sock)
        handle_client_connection(client_sock)
    #print('The end.')
    sys.exit(consts["convertion_success"])

