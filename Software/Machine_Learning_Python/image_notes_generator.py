"""
Author: Alon Haviv, Stellar Intelligence.

Generate and save images from a PDF file in a directory given as an argument to the script.

The script expects as an argument a path to a directory. In it there should be a JSON-data-
file whose fixed name is given in Consts.json (under 'json_data_file_name'). The directory 
should also have a PDF file, whose name is specified in the JSON-data-file. The script then 
generates a list of images of the PDF, saves them in the given directory and adds their names 
into the JSON-data-file under the key given by Consts.json ('img_key_in_jData'). The script 
ends with a proper exit code. consts["convertion_success"] for success.
"""

import os, sys, json
from typing import TextIO
from PIL import Image
from pdf2image import convert_from_path
from utils_py.loggers import ENVS, log, error_log

solutionBasePath = os.path.normpath(os.path.join(os.path.dirname(__file__), '..'))
with open(os.path.join(solutionBasePath, 'Consts.json'), 'r') as consts_file:
    consts = json.load(consts_file)

script_name = os.path.basename(__file__)  # Will be usefull for logging.


def is_valid_audio_dir(dir_path: str) -> bool:
    """Check if the given directory is valid, with the necessary files (JSON-data-file and a PDF file). False otherwise."""

    # Check if the directory exists
    if not os.path.isdir(dir_path):
        error_log(ENVS.ALL, f'{script_name}: The directory "{dir_path}" does not exist.')
        return False

    # Check if the JSON file exists and valid, and get its data:
    jData = has_valid_jData_file(dir_path)
    if not jData:
        return False

    # Check if the PDF file exists and valid:
    if not is_valid_pdf_file(dir_path, jData):
        return False

    return True


def has_valid_jData_file(dir_path: str) -> bool | dict:
    """Return True if the given directory has a valid JSON data file, with the necessary fields. False otherwise."""

    # Path to the JSON Data file
    json_file_path = os.path.join(dir_path, consts['json_data_file_name'])

    # Check if the JSON file exists
    if not os.path.isfile(json_file_path):
        error_log(ENVS.ALL, 
                  f'{script_name}: The JSON file "{consts["json_data_file_name"]}" does not exist in the directory "{dir_path}".')
        return False
    
    # Read and parse the JSON file
    try:
        with open(json_file_path, 'r') as json_file:
            jData = json.load(json_file)
            if (consts["pdf_key_in_jData"] not in jData) or (consts["media_key_in_jData"] not in jData):
                error_log(ENVS.ALL, f'{script_name}: JSON file "{json_file_path}" is missing critical data fields!')
                return False
    except Exception as e: #json.JSONDecodeError:
        # Failed to open and load the file as json.
        error_log(ENVS.ALL, f'{script_name}: Failed to decode JSON from the file "{json_file_path}".')
        return False

    return jData


def is_valid_pdf_file(dir_path: str, jData: dict) -> bool:
    """Return True if 'dir_path' contains a valid PDF file, whose name is in jData.False otherwise."""

    pdf_file_path = os.path.join(dir_path, jData[consts['pdf_key_in_jData']])
    if not is_valid_file_type(pdf_file_path, [consts['pdf_ext']]):
        error_log(ENVS.ALL, f'{script_name}: PDF file "{pdf_file_path}" is not valid.')
        return False
    return True


def is_valid_file_type(file_path: str, valid_extensions: list[str]):
    """
    Return True if 'file_path' is a valid, accessible file, with an allowed extension (according 
    to valid_extensions list)."""

    if not os.path.isfile(file_path):  # Use os.path.exists() for any file or directory.
        return False
        
    if not os.access(file_path, os.R_OK):
        return False
        
    _, ext = os.path.splitext(file_path)
    if ext.lower() not in valid_extensions:
        return False
        
    return True


def generate_and_save_notes_image(audio_dir_path: str) -> int:
    """
    Generate images from a PDF file located in the given directory (audio_dir_path), 
    save them and update the JSON-data file that's in the same directory.
    """

    # Path to the JSON file
    json_file_path = os.path.join(audio_dir_path, consts['json_data_file_name'])
    # Open the JSON file and use it to find & load the pdf file, convert it to img and save it:
    with open(json_file_path, 'r+') as json_file:
        j_data = json.load(json_file)
        pdf_path = os.path.join(audio_dir_path, j_data[consts["pdf_key_in_jData"]])

        try:
            # Generate the images (convert from a PDF):
            image_file_lst = create_image(pdf_path)
            log(ENVS.DEVELOPMENT, 
                f'{script_name}: generated {len(image_file_lst)} images successfully (not saved yet).')

            # Save the images in a directory:
            image_path_lst = save_images(audio_dir_path, image_file_lst, j_data)
            log(ENVS.DEVELOPMENT, 
                f'{script_name}: saved {len(image_path_lst)} images successfully under {os.path.dirname(image_path_lst[0])}.')

            # Update the json-data file:
            update_json_data_file(audio_dir_path, image_path_lst, json_file, j_data)
        except Exception as e:
            error_log(ENVS.ALL, str(e))
            return consts["image_generation_failed"]

        log(ENVS.DEVELOPMENT, f'{script_name}: images = {image_path_lst}')  # For a lazy user.
        return consts["convertion_success"]


def create_image(pdf_path: str) -> list[Image.Image]:
    """Given a PDF file path (pdf_path), generate and return a PIL image files list."""
    try:
        images = convert_from_path(pdf_path)
    except Exception as e:
        raise Exception(f'{script_name}: Error when converting PDF to images: ' + str(e))
    return images


def save_images(audio_dir: str, image_file_lst: list[Image.Image], j_data: dict) -> list[str]:
    """
    Save the given images in the given destination directory. 
    Return a list of the paths of the saved image files.
    Raise an error with a proper message if any of the images saving failed.

    audio_dir (str) - The destination directory.
    image_file_lst - A list of image objects (see pdf2image.convert_from_path).
    j_data (dict) - A dictionary with relevant data (such as the files' future names).
    """

    if len(image_file_lst) == 0:
        return
    
    file_path_lst = []  # The image files paths after being saved.
    try:
        for img_i in range(len(image_file_lst)):
            file_path = os.path.join(audio_dir, os.path.splitext(j_data[consts["media_key_in_jData"]])[0] + '_' + str(img_i) + consts['img_ext'])
            image_file_lst[img_i].save(file_path, consts['img_ext'][1:])
            file_path_lst.append(file_path)
    except Exception as e:
        raise Exception(f'{script_name}: Error when saving a file: ' + str(e))

    return file_path_lst


def update_json_data_file(audio_dir: str, img_path_lst: list[str], json_file: TextIO, j_data: dict):
    """
    Update the given JSON file with the given image files paths.
    Raise an error with a proper message upon failure.

    audio_dir (str) - The destination directory.
    img_path_lst - A list of the image paths (str).
    json_file - A file object that should be updated.
    j_data (dict) - A dictionary for the new, updated data for 'json_file'.
    """

    jd_img_key = 'img_key_in_jData'

    # The new key for the image list:
    if consts[jd_img_key] not in j_data:
        j_data[consts[jd_img_key]] = []
    # Add the paths to j_data:
    for img_path in img_path_lst:
        j_data[consts[jd_img_key]].append(os.path.basename(img_path))

    # Save the updated data into json_file:
    try:
        json_file.seek(0)
        json.dump(j_data, json_file)
    except Exception as e:
        raise Exception(f'{script_name}: Error when updating a JSON file: ' + str(e))
    return


def run_generator(argv: list[str]) -> int:
    """
    Generate images from the PDF file located in the given directory in the given arguments, 
    save them and update the JSON-data file that's in the same directory.
    Return a code (int) that signals a success or failure.

    argv: [<name>, path to directory]
    """

    # Check input arguments validity:
    if len(argv) < 2 or not os.path.isdir(argv[1]):
        return consts['image_generation_failed_bad_input']

    # Extract arguments:
    audio_dir = argv[1]

    # Check if the directory is valid:
    if not is_valid_audio_dir(audio_dir):
        return consts["invalid_audio_dir"]

    # Generates and saves the images and update the JSON-data-file:
    gen_result_code = generate_and_save_notes_image(audio_dir)
    if gen_result_code == consts["convertion_success"]:
        log(ENVS.DEVELOPMENT, f'{script_name}: generated all images successfully.')

    return gen_result_code


if __name__ == "__main__":
    """Usage: python image_notes_generator.py "/destination/directory" """
    result_code = run_generator(sys.argv)
    sys.exit(result_code)