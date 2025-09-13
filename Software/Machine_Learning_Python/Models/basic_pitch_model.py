"""
Author: Alon Haviv, Stellar Intelligence.

Full instructions at: https://github.com/spotify/basic-pitch
To install basic-pitch library: pip install basic-pitch
To run basic-pitch in CMD:
basic-pitch <output-directory> <input-audio-path>
"""

import os, sys, logging
import json

# Import project utilities:
from utils_py.serialized_objects import TranscribedMidiData
from utils_py.loggers import ENVS, log, error_log

# Load the consts.json as a json dict:
solutionBasePath = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '..'))
with open(os.path.join(solutionBasePath, 'Consts.json'), 'r') as consts_file:
    consts = json.load(consts_file)

# Add the zlibwapi.dll to the process' environment path:
dll_dir_path = os.path.normpath(os.path.join(solutionBasePath, consts["dllDirPat"]))
if dll_dir_path not in os.environ["PATH"]:
    os.environ["PATH"] = dll_dir_path + os.pathsep + os.environ["PATH"]

# To silence basic_pitch spam outputs:
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
logging.getLogger("basic_pitch").setLevel(logging.CRITICAL)
logging.getLogger("tensorflow").setLevel(logging.CRITICAL)
logging.getLogger().setLevel(logging.CRITICAL)

# Import AI model:
from basic_pitch.inference import predict_and_save, Model, build_output_path, OutputExtensions
from basic_pitch import ICASSP_2022_MODEL_PATH
from .base_model import BaseModel

script_name = os.path.basename(__file__)  # Will be usefull for logging.

class BasicPitch(BaseModel):
    """
    The class implements the BaseModel abstract class. It uses spotify's basic-pitch AI 
    model and lets a user to generate transcriber objects that transcribe librosa-supported 
    audio formats (.mp3, .ogg, .wav, .flac, .m4a) to midi (.mid). After a setup, an 
    object can perform an inference over an audio directory.
    Pipeline order:
        model = BasicPitch(args)  # Create a new transcriber.
        model.set_audio_dir(audio_dir_path)  # Set the audio source directory.
        model.run()  # Resulted .mid files are saved in audio_dir_path.
    """

    def __init__(self, args: list[str] = []):
        """
        Creates a new transcriber.
        args - Not required."""

        super().__init__(args)
        self.basic_pitch_model = Model(ICASSP_2022_MODEL_PATH)


    def set_audio_dir(self, audio_dir_path: str) -> bool:
        """
        Set the given audio directory to be the one the transciber's model inference over. 
        The resulted midis shall be stored there.
        Return True if the setup succeeded, False if the directory is invalid.

        audio_dir_path - The audio directory. should contain librosa supported sound files (.mp3, .wav, ...)."""

        # Check input validity:
        if not super().set_audio_dir(audio_dir_path):
            return False

        self.audio_dir_path = audio_dir_path
        return True


    def run(self) -> TranscribedMidiData:
        """
        Generate midi files for each of the .wav audio files located inside "audio_dir_path" directory.
        The midi files are saved in the same directory with appropriate names and a TranscribedMidiData object 
        is then returned.
        The process of converting audio into midi ("transcription") involves a basic_pitch AI model.
        Raise exception upon failure.
        """

        # Verify that the audio dir is set:
        if not self.audio_dir_path:
            return
        # Audio files to transcribe:
        audio_file_paths = self._get_audio_paths_list()
        target_dir = self.audio_dir_path
        # The transcription result file names:
        midi_names = []

        # Get the paths of the resulted midi files:
        for audio_fname in audio_file_paths:
            try:
                # To silence basic_pitch spam outputs.
                original_stdout = sys.stdout
                original_stderr = sys.stderr
                sys.stdout = open(os.devnull, 'w')
                sys.stderr = open(os.devnull, 'w')

                # Transcribe and save:
                predict_and_save(audio_path_list=[audio_fname], output_directory=target_dir, save_midi=True, 
                                    sonify_midi=False, save_model_outputs=False, save_notes=False, 
                                    model_or_model_path=self.basic_pitch_model)
                midi_fname = os.path.splitext(audio_fname)[0] + '_basic_pitch.mid'
                if os.path.exists(midi_fname):
                    midi_names.append(os.path.basename(midi_fname))

                # Restore sys.stdio:
                sys.stdout = original_stdout
                sys.stderr = original_stderr
            except Exception as exp:
                # Restore sys.stdio:
                sys.stdout = original_stdout
                sys.stderr = original_stderr
                # Error occurred. log it and continue to the next file.
                error_log(ENVS.ALL, f'{script_name}: Couldn\'t transcribe the file "{audio_fname}". The error:\n{exp}')
                continue

        # Wrap the results in a data ocject that can be serialized and sent via socket connection:
        code = self._calculate_code_result(audio_file_paths, midi_names)
        return TranscribedMidiData(code=code, fnames=midi_names)


    def _get_audio_paths_list(self) -> list[str]:
        """Return a list of all the .wav audio files' paths within "audio_dir" directory."""
        audio_dir = self.audio_dir_path
        return [os.path.join(audio_dir, audio_fname) for audio_fname in os.listdir(audio_dir) \
                if (os.path.isfile(os.path.join(audio_dir, audio_fname)) and \
                os.path.splitext(audio_fname)[1] == '.wav')]


    def _calculate_code_result(self, source_names: list[str], target_names: list[str]) -> int:
        """Compare the source and target lists and based on their sizes, return the result code."""

        if len(target_names) == len(source_names):
            return consts["convertion_success"]
        elif len(target_names) == 0:
            return consts["midi_generation_failed"]
        else:
            return consts["convertion_partial_success"]

__all__ = ['BasicPitch']
