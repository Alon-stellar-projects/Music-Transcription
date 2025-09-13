"""
Author: Alon Haviv, Stellar Intelligence.

Classes that can be serialized and sent between processes using sockets.
"""

import json
import base64

class SerializedDataClass():
    """Base class for serialized objects that can be sent in a TCP protocol as jsons."""

    def __init__(self, id: str = ""):
        """
        Create a new instance of the Base class.
        id - An identifier for the data."""
        self.id = id

    def get_dict(self) -> dict:
        """Return a dictionary of the object and its fields."""
        return self.__dict__

    def get_json_str(self) -> str:
        """Return a string representing the object as a json."""
        return json.dumps(self.get_dict())

    @classmethod
    def from_json(cls, json_data_dict: dict):
        """
        Create and return a new instance of the class, with the parameters' values 
        given in the dictionary \"json_data_dict\"."""
        return cls(**json_data_dict)

    def __str__(self) -> str:
        """Return a string representing the object."""
        return self.get_json_str()

    def __repr__(self) -> str:
        """Return a string representing the object."""
        return self.__class__.__name__ + f'({str(self)})'


class TranscribedMidiData(SerializedDataClass):
    """This class represents a transcribed midi data file, that can be serialized and sent as json."""
    def __init__(self, code: int, fnames: list[str] = [], data: str = "", id: str = ""):
        """
        Create a new instance of the class.
        code - The code of the transcription process (success/failure/...).
        fnames - List of relevant file names (not whole paths).
        data - The raw binary midi data.
        id - An identifier for the data."""
        super().__init__(id)
        self.code = code
        self.fnames = fnames
        self.data = ""#base64.b64encode(data).decode('ascii') ?

    def __str__(self) -> str:
        """Return a string representing the TranscribedMidiData object."""
        return '{' + f'"code": {self.code}' +\
            f', "fnames": {self.fnames}' +\
            f', "data": b"{self.data[:10]}"' + ('...' if len(self.data) > 10 else '') +\
            f', "id": {self.id}' +\
           '}'
        

class AudioDataToTranscribe(SerializedDataClass):
    """This class represents an audio data file to be transcribed, and that can be serialized and sent as json."""
    def __init__(self, audio_dir_path: str, data: str = "", id: str = ""):
        """
        Create a new instance of the class.
        audio_dir_path - The path for the audio file.
        data - The raw binary audio data.
        id - An identifier for the data."""
        super().__init__(id)
        self.audio_dir_path = audio_dir_path
        self.data = base64.b64decode(data)

    def __str__(self) -> str:
        """Return a string representing the AudioDataToTranscribe object."""
        return '{' + f'"audio_dir_path": {self.audio_dir_path}' +\
            f', "data": b"{self.data[:10]}"' + ('...' if len(self.data) > 10 else '') +\
            f', "id": {self.id}' +\
           '}'


__all__ = ['SerializedDataClass', 'TranscribedMidiData', 'AudioDataToTranscribe']
