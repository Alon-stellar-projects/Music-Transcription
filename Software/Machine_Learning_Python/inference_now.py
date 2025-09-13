##################
# This file is a quick model runner, to transcribe a given audio file into midi right away.
# The audio directory and model name should be set here, but other parameters (s.a. model's arguments) 
# are set in consts.json.
# Enjoy.
##################

import importlib, os, sys
import json
from utils_py.serialized_objects import TranscribedMidiData, AudioDataToTranscribe

solutionBasePath = os.path.normpath(os.path.join(os.path.dirname(__file__), '..'))
consts = json.load(open(os.path.join(solutionBasePath, 'Consts.json'), 'r'))
models_dir = "Models"  # The directory of the models classes.

# The AI model that is used to transcribe:
# Manual options: "basic-pitch", "MT3NetSegMemV2WithPrev_context64_f3_ep100_random", ...
ai_model = consts["ai_model"]

# The source file's directory:
audio_dir_path = r"/insert/path/to/dir"  # Inside there should be an audio file.
#audio_dir_path = r"C:/Users/alonh/workspace/Stellar Intelligence/Music Transcription/Software/uploads/audio/Dragon Smasher"
#audio_dir_path = r"C:/Users/alonh/workspace/Stellar Intelligence/Music Transcription/Software/uploads/audio/Pirates of Caribbean OST violin cover"
#audio_dir_path = r"C:/Users/alonh/workspace/Stellar Intelligence/Music Transcription/Software/uploads/audio/pirates of the caribbean piano"
#audio_dir_path = r"C:/Users/alonh/workspace/Stellar Intelligence/Music Transcription/Software/uploads/audio/Zoltraak - Frieren： Beyond Journeys End - Violin Cover multi"
#audio_dir_path = r"C:/Users/alonh/workspace/Stellar Intelligence/Music Transcription/Test files/He's a Pirate (Pirates of the Caribbean Theme) - Viola Cover"


def main(argv):
    # Use the directory path given by argv, or if not given then use preset audio_dir_path:
    audio_dir_path = argv[1:] if len(argv) > 1 else audio_dir_path

    if not is_valid_audio_dir(audio_dir_path):
        sys.exit()

    print(f'audio source folder: {audio_dir_path}')
    print(f'AI model: {ai_model}')

    Model = import_AI_model(ai_model)
    args = consts["models_arguments"][ai_model]["args"]

    model = Model(args)
    model.set_audio_dir(audio_dir_path)
    model.run()

    print("\nDone!\n")

def is_valid_audio_dir(audio_dir_path):
    if (not audio_dir_path or audio_dir_path == r"/insert/path/to/dir"):
        print("Please set the source audio file's directory.")
        return False
    if not os.path.isdir(audio_dir_path):
        print(f"The given path \"{audio_dir_path}\" is not a valid directory.")
        return False
    return True

def import_AI_model(ai_model: str):
    """Import the AI model and return its wrapper class."""

    module_name = consts["models_arguments"][ai_model]["module"]
    class_name = consts["models_arguments"][ai_model]["class"]
    module = importlib.import_module(f"{models_dir}.{module_name}")
    return getattr(module, class_name)

if __name__ == '__main__':
    main(sys.argv)