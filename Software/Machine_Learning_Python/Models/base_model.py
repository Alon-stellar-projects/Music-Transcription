"""
Author: Alon Haviv, Stellar Intelligence.

Abstract class for the Model Wrappers to implement.
Whenever a new implementer class is added, remember to add its name, module (file name) and 
required arguments to consts.json in the filed: "models_arguments".
"""

import os
from abc import ABC, abstractmethod

class BaseModel(ABC):
    """
    This is an abstract class that should be implemented by subclasses.
    It lets a user to generate transcriber objects from .wav to .mid. After a 
    setup, an object can perform an inference over an audio directory.
    Pipeline order:
        model = Model(args)  # Create a new transcriber.
        model.set_audio_dir(audio_dir_path)  # Set the audio source directory.
        model.run()  # Resulted .mid files are saved in audio_dir_path.
    """


    @abstractmethod
    def __init__(self, args: list[str]):
        """Creates a new transcriber."""
        self.audio_dir_path = None


    @abstractmethod
    def set_audio_dir(self, audio_dir_path: str) -> bool:
        """
        Set the given audio directory to be the one the transciber's model inference over. 
        The resulted midis shall be stored there.
        Return True if the setup succeeded, False if the directory is invalid.

        audio_dir_path - The audio directory. should contain audio files.
        """
        # Check input validity:
        if not (audio_dir_path and type(audio_dir_path) is str and os.path.isdir(audio_dir_path)):
            return False
        return True


    @abstractmethod
    def run(self):
        """
        Generate midi files for each of the .wav audio files located inside "audio_dir_path" directory.
        The midi files are saved in the same directory with appropriate names and results may or may not be returned.
        """
        pass
