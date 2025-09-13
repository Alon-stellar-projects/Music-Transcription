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

# Seperate audio tracks with Demucs: https://github.com/facebookresearch/demucs
# To use demucs to clean an audio from bass, vocals, drums and others, do the following:
# Make sure PyTorch with CUDA is installed.
# Install demucs: 
#     pip install demucs
# In python: 
#     import demucs.separate
#     demucs.separate.main([audio_path, '-o', '/target/directory'])
# This creates a directory named "separated" with 4 resulted audio files. 
#     run the transcriber on "others.wav" and delete the rest.
# Or check a more advanced API for a better control: https://github.com/facebookresearch/demucs/blob/main/docs/api.md

# General system imports:
import importlib, os, sys
import json
from utils_py.serialized_objects import TranscribedMidiData, AudioDataToTranscribe
from utils_py.loggers import ENVS, log, error_log
from utils_py.error_objects import BaseException

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
        transcribed_data = model.run()
        if transcribed_data.code == consts["midi_generation_failed"]:
            raise BaseException(consts["status_codes"]["bad_input"], 'AI model failed to generate midi.')
        return transcribed_data
    except Exception as exp:
        raise exp

def parse_task_message(message: str) -> AudioDataToTranscribe:
    """
    Parse the message into a "AudioDataToTranscribe" object and return it.
    Raise an exception upon failure in the parsing, or if the parsed 
    data is invalid (not a legitimate directory)
    
    message - The data to be parsed.
    """

    # Parse the message into AudioDataToTranscribe object:
    try:
        audio_data_obj = AudioDataToTranscribe.from_json(json.loads(message))
    except Exception as e:
        raise e

    # Check the input validity:
    audio_dir_path = audio_data_obj.audio_dir_path
    if not audio_dir_path or not os.path.isdir(audio_dir_path):
        raise ValueError(f'id={audio_data_obj.id}: The path received isn\'t a valid directory: "{audio_dir_path}"')

    return audio_data_obj

def send_response(transcribed_data: TranscribedMidiData) -> None:
    """Send a response message through STDOUT. The message is a json string of "transcribed_data"."""
    data_message = transcribed_data.get_json_str()  # Get the data as a json string.
    sys.stdout.write(consts["STDIO_DATA_MSG_PREFIX"] + data_message + consts["STDIO_MSG_POSTFIX"] + '\n')
    sys.stdout.flush()

def handle_task(task_msg: str, instruments_mode: int) -> bool:
    """
    Parse the given task-message (task_msg), which should be a 
    json in the format "AudioDataToTranscribe" ({audio_dir_path: str, data (optional): str}) 
    representing data of an audio file, then transcribe it and generate and save a midi file.
    Then send its data through STDIO as a response. The respond format is a json of 
    "TranscribedMidiData".
    Return True upon success.
    Raise an exception upon failure.

    task_msg - The string representing the audio data to be transcribed.
    instruments_mode - Determine how to treat the musical instruments of in the audio file.
    """

    # Parse the task-message as an "AudioDataToTranscribe" object:
    try:
        audio_data_obj = parse_task_message(task_msg)
        audio_dir_path = audio_data_obj.audio_dir_path
        audio_data_bytes = audio_data_obj.data  # Not really required here.
    except Exception as e:
        raise BaseException(consts["status_codes"]["bad_input"], 
                            f'Received invalid message task from stdin.\n\tMore details: {e}')

    # Log that the data was received successfully.
    log(ENVS.DEVELOPMENT, f'{script_name} | id={audio_data_obj.id}: Received data from the server app:\n' + \
        f'\tlen(data) = {len(audio_data_bytes)}, audio_dir_path = {audio_dir_path}' + consts["STDIO_MSG_POSTFIX"])

    # Transcribe the audio data into midi:
    try:
        transcribed_data = transcribe_wav_to_midi(audio_dir_path, instruments_mode)
        transcribed_data.id = audio_data_obj.id
    except Exception as e:
        raise BaseException(consts["status_codes"]["unsupported_media_type_code"], 
                            f'id={audio_data_obj.id}: Failed to transcribe the audio file in "{audio_dir_path}" into midi.\n\tMore details: {e}')

    # Log that the transcription was successful.
    log(ENVS.DEVELOPMENT, f'{script_name} | id={audio_data_obj.id}: Audio to MIDI transcription succeeded!\n' + \
        f'\tcode = {transcribed_data.code}, len(data) = {len(transcribed_data.data)}, ' +\
        f'midi fnames = {transcribed_data.fnames}' + consts["STDIO_MSG_POSTFIX"])

    # Send a response with the transcribed data via STDIO:
    try:
        send_response(transcribed_data)
    except Exception as e:
        raise BaseException(consts["status_codes"]["internal_server_error_code"], 
                            f'id={audio_data_obj.id}: Failed to send the response back to the server app.\n\tMore details: {e}')

    # Log that the response is sent successfully and return True:
    log(ENVS.DEVELOPMENT, f'{script_name} | id={audio_data_obj.id}: Transcribed results sent.' + consts["STDIO_MSG_POSTFIX"])
    return True

def main(argv: list[str]) -> int:
    """
    Listen to the STDIN for task messages to read (separated by line-break). 
    For each task, receive a json with a source audio file in the format of 
    "AudioDataToTranscribe" and use an AI model to transcribe it and generate and save a midi file. 
    Send back a json response in the format of "TranscribedMidiData". At the end, return a code 
    that signals a success/failure.
    Optionally: Get the type and number of instruments from sys.argv."""

    # Get the instruments mode:
    if len(argv) == 2 and argv[1].isdigit:
        instruments_mode = int(argv[1])
    else:
        instruments_mode = consts["instruments_options"]["many"]["value"]
    
    task_results = []  # Keep tracking over each task's result.
    # Read incoming task messages from the server app, each one in a separate line:
    for line in sys.stdin:  # Runs until EOF is read which means the other side closed the stdin stream.
        task = line.strip()

        if not task:
            continue

        try:
            task_res = handle_task(task, instruments_mode)
            task_results.append(task_res)
        except Exception as e:
            # A failure in 1 task shouldn't stop us from continue handling the next tasks.
            task_results.append(False)
            n = len(task_results)
            error_log(ENVS.ALL, f'{script_name}: Transcription process for task number {n} failed. ' + \
                f'Continue to the next task.\n\tFailure reason: {e}')
            continue

    # Return success if ALL the tasks succeeded (at last partialy), return partial-success if 
    # only some succeeded, and return failure if non succeeded:
    status_code = consts["convertion_success"] if (len(task_results) > 0 and all(task_results)) else \
        consts["convertion_partial_success"] if any(task_results) else consts["midi_generation_failed"]
    #log(ENVS.DEVELOPMENT, f'{script_name}: Finished all transcribings tasks. Returning code {status_code}.' + consts["STDIO_MSG_POSTFIX"])
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