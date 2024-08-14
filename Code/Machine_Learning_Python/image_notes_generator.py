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
#from pdf2image import convert_from_path  # UNCOMMENT!

solutionBasePath =  os.path.join(os.getcwd(), '..')
consts = json.load(open(os.path.join(solutionBasePath, 'Consts.json'), 'r'))


def is_valid_audio_dir(dir_path):
    """Check if the given directory is valid, with the necessary files (JSON-data-file and a PDF file). False otherwise."""

    # Check if the directory exists
    if not os.path.isdir(dir_path):
        print(f"The directory '{dir_path}' does not exist.", file=sys.stderr)
        return False

    # Check if the JSON file exists and valid, and get its data:
    jData = has_valid_jData_file(dir_path)
    if not jData:
        return False

    # Check if the PDF file exists and valid:
    if not is_valid_pdf_file(dir_path, jData):
        return False

    return True


def has_valid_jData_file(dir_path):
    """Return True if the given directory has a valid JSON data file, with the necessary fields. False otherwise."""

    # Path to the JSON file
    json_file_path = os.path.join(dir_path, consts['json_data_file_name'])

    # Check if the JSON file exists
    if not os.path.isfile(json_file_path):
        print(f"The JSON file '{consts['json_data_file_name']}' does not exist in the directory '{dir_path}'.", file=sys.stderr)
        return False
    
    # Read and parse the JSON file
    try:
        with open(json_file_path, 'r') as json_file:
            jData = json.load(json_file)
            if (consts["pdf_key_in_jData"] not in jData) or ('newName' not in jData):
                print(f"JSON file '{json_file_path}' is missing critical data fields!", file=sys.stderr)
                return False
    except Exception as e: #json.JSONDecodeError:
        print(f"Failed to decode JSON from the file '{json_file_path}'.", file=sys.stderr)
        return False

    return jData


def is_valid_pdf_file(dir_path, jData):
    """Return True if 'dir_path' (str) contains a valid PDF file, whose name is in jData (dict).False otherwise."""

    pdf_file_path = os.path.join(dir_path, jData[consts['pdf_key_in_jData']])
    if not is_valid_file_type(pdf_file_path, [consts['pdf_ext']]):
        print(f"PDF file '{pdf_file_path}' is not valid.", file=sys.stderr)
        return False
    return True


def is_valid_file_type(file_path, valid_extensions):
    """Return True if 'file_path' (str) is a valid, accessible file, with an allowed extension (valid_extensions (list of str))."""

    if not os.path.isfile(file_path):  # Use os.path.exists() for any file or directory.
        return False
        
    if not os.access(file_path, os.R_OK):
        return False
        
    _, ext = os.path.splitext(file_path)
    if ext.lower() not in valid_extensions:
        return False
        
    return True


def generate_and_save_notes_image(audio_dir_path):
    """
    Generate images from a PDF file located in the given directory (audio_dir_path), save them and update the JSON-data-file that's in there.
    """

    # Path to the JSON file
    json_file_path = os.path.join(audio_dir_path, consts['json_data_file_name'])
    # Open the JSON file and use it to find & load the pdf file, convert it to img and save it:
    with open(json_file_path, 'r+') as json_file:
        j_data = json.load(json_file)
        pdf_path = os.path.join(audio_dir_path, j_data[consts["pdf_key_in_jData"]])
        ## Check if a valid file (move it into is_valid_audio_dir()!):
        #if not is_valid_file_type(pdf_path, [consts['pdf_ext']]):
        #    return consts["invalid_audio_dir"]

        try:
            image_file_lst = create_image(pdf_path)
            image_path_lst = save_images(audio_dir_path, image_file_lst, j_data)
            update_json_data_file(audio_dir_path, image_path_lst, json_file, j_data)
        except Exception as e:
            print(e, file=sys.stderr)
            return consts["image_generation_failed"]

        print(image_path_lst)  # For a lazy user.
        return consts["convertion_success"]


def create_image(pdf_path):
    """Given a PDF file path (str), generate and return an image files list."""
    images = convert_from_path(pdf_path)
    return images


def save_images(audio_dir, image_file_lst, j_data):
    """
    Save the given images in the given destination directory.

    audio_dir (str) - The destination directory.
    image_file_lst - A list of image objects (see pdf2image.convert_from_path).
    j_data (dict) - A dictionary with relevant data (such as the files' future names).
    """

    if len(image_file_lst) == 0:
        return
    
    file_path_lst = []  # The image files paths after being saved.
    try:
        for img_i in range(len(image_file_lst)):
            file_path = os.path.join(audio_dir, os.path.splitext(j_data['newName'])[0] + '_' + str(img_i) + consts['img_ext'])
            image_file_lst[img_i].save(file_path, consts['img_ext'][1:])
            file_path_lst.append(file_path)
    except Exception as e:
        raise 'Image file save failed! ' + repr(e)

    return file_path_lst


def update_json_data_file(audio_dir, img_path_lst, json_file, j_data):
    """
    Update the given JSON file with the given image files paths.

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
        raise 'JSON file update failed! ' + repr(e)
    return


def run_generator(audio_dir):
    """
    Generate images from the PDF file located in the given directory (audio_dir), save them and update the JSON-data-file.

    audio_dir (str) - The path to the directory.
    """

    # Check if the directory is valid:
    if not is_valid_audio_dir(audio_dir):
        return consts["invalid_audio_dir"]

    # Generates and saves the images and update the JSON-data-file:
    gen_result_code = generate_and_save_notes_image(audio_dir)
    return gen_result_code


def moc_run(audio_dir):
    """Copy and save a fixed SnowGirl.jpg image to the given 'audio_dir' directory (str). Update the JSON-data-file."""

    import shutil

    sourcePath = os.path.join(solutionBasePath, 'Music_Transcription_App', 'public', 'images', 'SnowGirl.jpg')
    destinationPath = os.path.join(audio_dir, 'SnowGirl.jpg')
    shutil.copyfile(sourcePath, destinationPath)

    json_file_path = os.path.join(audio_dir, consts['json_data_file_name'])
    # Open the JSON file and update it:
    with open(json_file_path, 'r+') as json_file:
        j_data = json.load(json_file)
        j_data[consts['img_key_in_jData']] = ['SnowGirl.jpg']
        json_file.seek(0)
        json.dump(j_data, json_file)

    return consts["convertion_success"]


if __name__ == "__main__":
    """Usage: python image_notes_generator.py "/destination/directory" """
    audio_dir = sys.argv[1]
    #result_code = run_generator(audio_dir)  # Generates the files, saves them and updates the JSON-data-file.
    result_code = moc_run(audio_dir)  # A moc run that saves a fixed picture and updates the JSON-data-file.
    sys.exit(result_code)