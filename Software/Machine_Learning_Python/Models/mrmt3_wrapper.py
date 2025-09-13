"""
Author: Alon Haviv, Stellar Intelligence.

A class that uses the MR-MT3 (Memory Retaining Multi-Track Music Transcription) model
to transcribe an audio music file (.wav) into midi (.mid).
Pipeline order:
    model = Mrmt3_wrapper(args)  # Create a new transcriber.
    model.set_audio_dir(audio_dir_path)  # Set the audio source directory.
    model.run()  # Resulted .mid files are saved in audio_dir_path.

Credits:
The MR-MT3 model is trained by: 
Tan, Hao Hao and Cheuk, Kin Wai and Cho, Taemin and Liao, Wei-Hsiang and Mitsufuji, Yuki.
Paper: https://arxiv.org/pdf/2403.10024.pdf
The model is based on the MT3 model, made by kunato. Paper: https://github.com/kunato.
"""

#################################################
# Usage of 2 MT3Net models:
# MT3Net: path="../../../pretrained/mt3.pth, eval.contiguous_inference=False, eval.use_tf_spectral_ops=False
# MT3NetSegMemV2WithPrev: model_segmem_length=64, eval.contiguous_inference=True, eval.use_tf_spectral_ops=False, 
#     path="../../../pretrained/exp_segmemV2_prev_context\=64_prevaug_frame\=3.ckpt"
# 
# Required parameters:
# model's name (or cfg.model._target_), cfg.path, cfg.eval.audio_dir, cfg.model.config, cfg.optim, cfg.eval.contiguous_inference, cfg.eval.use_tf_spectral_ops=False
# 
# Run it like this:
# -----------------
# python try.py --config-dir="MR-MT3/config" --config-name="config_slakh_f1_0.65" \
#   model="MT3Net" \
#   path="../MR-MT3/pretrained/mt3.pth" \
#   eval.audio_dir="a/b/c" \
#   eval.contiguous_inference=False
# OR:
# python try.py --config-dir="MR-MT3/config" --config-name="config_slakh_segmem" \
#   model="MT3NetSegMemV2WithPrev" \
#   path="../MR-MT3/pretrained/exp_segmemV2_prev_context\=64_prevaug_frame\=3.ckpt" \
#   eval.audio_dir="a/b/c" \
#   eval.contiguous_inference=True
#################################################

import os, sys
import json

# Load the consts.json as a json dict:
solutionBasePath = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '..'))
with open(os.path.join(solutionBasePath, 'Consts.json'), 'r') as consts_file:
    consts = json.load(consts_file)

# Add the AI model to sys.path:
sys_path_ai_dir = os.path.normpath(os.path.join(solutionBasePath, consts["mrmt3DirPath"]))
if not sys_path_ai_dir in sys.path:
    sys.path.insert(0, sys_path_ai_dir)

# Import project utilities:
from utils_py.serialized_objects import TranscribedMidiData
from utils_py.loggers import ENVS, log, error_log
from .base_model import BaseModel
# Imports for the AI model itself:
import hydra
from tqdm import tqdm
from torch import load as torchLoad
from inference import InferenceHandler
import librosa
import numpy as np

# Important AI parameters:
sampling_rate = 16000
batch_size = 8

# Other constants:
script_name = os.path.basename(__file__)  # Will be usefull for logging.

class Mrmt3_wrapper(BaseModel):
    """
    The class implements the BaseModel abstract class. It wraps the InferenceHandler of 
    MR-MT3 and lets a user to generate transcriber objects from .wav to .mid. After a 
    setup, an object can perform an inference over an audio directory.
    Pipeline order:
        model = Mrmt3_wrapper(args)  # Create a new transcriber.
        model.set_audio_dir(audio_dir_path)  # Set the audio source directory.
        model.run()  # Resulted .mid files are saved in audio_dir_path."""

    def __init__(self, args: list[str]):
        """
        Creates a new transcriber.
        Raise an exception upon an invalid setup arguments.

        args - A list of command-line arguments (strings) for InferenceHandler.
            You can check with check_arguments(args) to verify their validity."""

        super().__init__(args)

        if Mrmt3_wrapper.check_arguments(args) is False:
            # Check that the arguments are valid.
            raise Exception("Invalid input argument: args.")

        # Set the 2 config arguments, which start  with "--", and the rest of the override arguments:
        config_name, config_dir, overrides = self._parse_arguments(args)
        # Set the hydra's cfg object:
        try:
            cfg = self._set_hydra_cfg(config_name, config_dir, overrides)
            if not cfg:
                raise Exception("Couldn't initialize and compose cfg for hydra with the given arguments.")
        except Exception as e:
            raise e

        self.cfg = cfg


    @classmethod
    def check_arguments(cls, args: list[str]) -> bool:
        """
        Return True if the given arguments are valid for the InferenceHandler. False if not.
        args - A list of command-line arguments (strings) for InferenceHandler.
        A valid format looks like:
            ["--config-name=<name>", "--config-dir=<path>", "Arg3=Val3", "Arg4=Val4", ...]
            Where "config_name" is The name of the .yaml configuration file (without the extension),
            "config_dir" is The *relative* path to the directory where the configuration file is,
            and the rest are overriding the default values of other arguments."""

        if type(args) not in (list, tuple):
            return False
        for arg in args:
            if type(arg) is not str:
                return False
            argSplit = arg.split("=", 1)
            if len(argSplit) < 2 or len(argSplit[0]) == 0 or len(argSplit[1]) == 0:
                return False
        return True


    def set_audio_dir(self, audio_dir_path: str) -> bool:
        """
        Set the given audio directory to be the one the transciber's model inference over. 
        The resulted midis shall be stored there.
        Return True if the setup succeeded, False if the directory is invalid.

        audio_dir_path - The audio directory. should contain .wav files."""

        # Check input validity:
        if not super().set_audio_dir(audio_dir_path):
            return False
        
        # Setup:
        self.audio_dir_path = audio_dir_path
        self.cfg.eval.audio_dir = audio_dir_path
        return True


    def run(self) -> TranscribedMidiData:
        """
        Generate midi files for each of the .wav audio files located inside "audio_dir_path" directory.
        The midi files are saved in the same directory with appropriate names and a TranscribedMidiData object 
        is then returned.
        The process of converting .wav into midi ("transcription") involves an AI model whose configurations 
        are given in "cfg".
        Raise exception upon failure.
        """

        # Verify that the audio dir is set:
        if not self.audio_dir_path:
            return

        # Create a handler object with an AI model to later transcribe the audio:
        try:
            model = self._load_model()
            log(ENVS.DEVELOPMENT, f'{script_name}: The model loaded for the InferenceHandler is: {type(model).__name__}')
            mel_norm = False if "mt3.pth" in self.cfg.path else True  # This is MT3 official checkpoint.
            handler = InferenceHandler(model, mel_norm=mel_norm, contiguous_inference=self.cfg.eval.contiguous_inference, use_tf_spectral_ops=False)
        except Exception as exp:
            error_log(ENVS.ALL, f'{script_name}: Couldn\'t load the model under "{self.cfg.model._target_}" ' +\
                'and generate an "InferenceHandler" object.' + \
                f'\n\tAdditional information: cfg.path = {self.cfg.path}')
            raise exp

        # Audio files to transcribe:
        audio_file_paths = self._get_audio_paths_list()
        # Prefix for each of the transcription result files:
        out_name_postfix = ('_' + self.cfg.eval.exp_tag_name) if self.cfg.eval.exp_tag_name != '' else ''
        # The transcription result file names:
        midi_names = []

        # Scan the audio files one by one and generate a midi file for each wav file:
        for audio_fname in tqdm(audio_file_paths):
            try:
                path_to_save_midi = (os.path.splitext(audio_fname)[0] + out_name_postfix + '.mid').replace('\\','/')
                audio = self._load_audio(audio_fname)
                handler.inference(audio, audio_path=audio_fname.replace('\\','/'), outpath=path_to_save_midi, batch_size=batch_size, verbose=True)
                midi_names.append(os.path.basename(path_to_save_midi))
            except Exception as exp:
                # Error occurred. log it and continue to the next file.
                error_log(ENVS.ALL, f'{script_name}: Couldn\'t transcribe the file "{audio_fname}". The error:\n{exp}')
                continue
    
        # Wrap the results in a data ocject that can be serialized and sent via socket connection:
        code = self._calculate_code_result(audio_file_paths, midi_names)
        return TranscribedMidiData(code=code, fnames=midi_names)


    def _parse_arguments(self, args: list[str]) -> tuple:
        """
        Parse the given arguments into: 
        config-name - name of .yaml configuration file (without the extension). 
            Format: "--config-name=<name>". If missing the diffault value is then "config".
        config-dir - directory's path where the configuration file is. Must be a relative path.
            Format: "--config-dir=<path>". If missing the diffault value is then "<sys_path_ai_dir>/config".
        overrides - extra command line arguments to override their default values.
            Format: "Arg=Val"
        Return their values.
        
        args - A list of command-line arguments (strings). Assume its correct."""

        config_name = "config"
        config_dir = os.path.relpath(os.path.join(sys_path_ai_dir, "config"), start=os.path.dirname(__file__))
        overrides = []

        # Respect --config-dir and --config-name passed via args
        for arg in args:
            if arg.startswith("--config-dir="):
                config_abs_dir = os.path.normpath(os.path.join(sys_path_ai_dir, arg.split("=", 1)[1]))
                config_dir = os.path.relpath(config_abs_dir, start=os.path.dirname(__file__))
            elif arg.startswith("--config-name="):
                config_name = arg.split("=", 1)[1]
            elif not arg.startswith("--"):
                # Remove hydra args before appending to overrides.

                if arg.startswith("path="):
                    # Fix the path to the pretrained weights with the location of the sys_path_ai_dir:
                    path_arg_parts = arg.split("=", 1)
                    path_arg_parts[1] = os.path.normpath(os.path.join(sys_path_ai_dir, path_arg_parts[1]))
                    arg = '='.join(path_arg_parts)

                overrides.append(arg)

        return config_name, config_dir, overrides


    def _set_hydra_cfg(self, config_name: str, config_dir: str, overrides: tuple[str]):
        """
        Set the configurations for hydra, with the given arguments, which are required 
        for the InferenceHandler.
        Raise an exception upon failure (hydra.initialize or hydra.compose).
        
        config_name - The name of the .yaml configuration file (without the extension).
        config_dir - The path to the directory where the configuration file is.
        overrides - A list of extra command line arguments, to override their default values"""

        try:
            with hydra.initialize(config_path=config_dir, version_base="1.1"):
                cfg = hydra.compose(config_name=config_name, overrides=overrides)
                # Fix paths notation:
                cfg.path = os.path.normpath(os.path.join(solutionBasePath, cfg.path))
                return cfg
        except Exception as e:
            raise Exception(f'{script_name}: Error when initializing and composing hydra cfg: {e}')


    def _load_audio(self, fname: str) -> np.ndarray:
        """
        Use librosa library to load an audio file from the given in "fname" path, 
        resample it to the relevant resampling rate (16000) and return it audio 
        content as a numpy array (librosa's format).
        Raise an exception upon failure.
    
        fname - The path of the audio file.
        """

        try:
            audio, sr = librosa.load(fname, sr=None)
            if sr != sampling_rate:
                log(ENVS.DEVELOPMENT, f'{script_name}: Resampling {fname}. file\'s sampling rate = {sr} instead of {sampling_rate}')
                audio = librosa.resample(audio, orig_sr=sr, target_sr=sampling_rate)
            # For NSynth dataset (single instrument audios) (I use Slakh):
            #audio = np.pad(audio, (int(0.05 * 16000), 0), "constant", constant_values=0)
        except Exception as exc:
            error_log(ENVS.ALL, f'{script_name}: Librosa couldn\'t load or resample the audio file in "{fname}".')
            raise exc
    
        return audio

    def _get_audio_paths_list(self) -> list[str]:
        """Return a list of all the .wav audio files' paths within "audio_dir" directory."""
        audio_dir = self.cfg.eval.audio_dir
        return [os.path.join(audio_dir, audio_fname) for audio_fname in os.listdir(audio_dir) \
                if (os.path.isfile(os.path.join(audio_dir, audio_fname)) and \
                os.path.splitext(audio_fname)[1] == '.wav')]

    def _load_model(self):
        """
        Generate and return a model object based on the configuration object "self.cfg".
        The model object is a pytorch instance of a class whose module is given in self.cfg.model, 
        and the checkpoint's weights are give in self.cfg.path.
        Raise an error if can't generate the object and load the weights.
    
        self.cfg - A configuration object, with the important fields: path, model (model._target_, model.config), optim."""
        try:
            if self.cfg.path.endswith(".ckpt"):  # Usually we enter here.
                model_cls = hydra.utils.get_class(self.cfg.model._target_)  # Same as: model_cls = get_class(self.cfg.model._target_)
                pl = model_cls.load_from_checkpoint(self.cfg.path, config=self.cfg.model.config, optim_cfg=self.cfg.optim)
                model = pl.model
            else:
                pl = hydra.utils.instantiate(self.cfg.model, optim_cfg=self.cfg.optim)  # Same as: pl = get_class(self.cfg.model._target_)(config=self.cfg.model.config, optim_cfg=self.cfg.optim)
                model = pl.model
                model.load_state_dict(torchLoad(self.cfg.path), strict=False)
        except Exception as exp:
            raise RuntimeError(f'Error: Can\'t locate the module "{self.cfg.model._target_}". Possible reasons:\n' + \
                '- Wrong input path.\n' + \
                f'- The path\'s parrent directory isn\'t in sys.path (should be located in "{sys_path_ai_dir}")\n' + \
                '- Bad package "typing_extensions" installation (check version against requirements.txt)')

        model.eval()
        return model


    def _calculate_code_result(self, source_names: list[str], target_names: list[str]) -> int:
        """Compare the source and target lists and based on their sizes, return the result code."""

        if len(target_names) == len(source_names):
            return consts["convertion_success"]
        elif len(target_names) == 0:
            return consts["midi_generation_failed"]
        else:
            return consts["convertion_partial_success"]

__all__ = ['Mrmt3_wrapper']