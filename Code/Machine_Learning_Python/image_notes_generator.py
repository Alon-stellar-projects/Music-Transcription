import os, sys, json
#from pdf2image import convert_from_path # Uncomment. Maybe I need to install the package or choose a different one.

solutionBasePath =  os.path.join(os.getcwd(), '..')
consts = json.load(open(os.path.join(solutionBasePath, 'Consts.json'), 'r'))


def is_valid_audio_dir(dir_path):
    # Check if the directory exists
    if not os.path.isdir(dir_path):
        print(f"The directory '{dir_path}' does not exist.")
        return False

    # Check if the JSON file exists and valid, and get its data:
    jData = get_is_valid_json_file(dir_path)
    if not jData:
        return False

    # Check if the PDF file exists and valid:
    if not is_valid_pdf_file(dir_path, jData):
        return False

    return True


def get_is_valid_json_file(dir_path):
    # Path to the JSON file
    json_file_path = os.path.join(dir_path, consts['json_data_file_name'])

    # Check if the JSON file exists
    if not os.path.isfile(json_file_path):
        print(f"The JSON file '{consts['json_data_file_name']}' does not exist in the directory '{dir_path}'.")
        return False
    
    # Read and parse the JSON file
    try:
        with open(json_file_path, 'r') as json_file:
            jData = json.load(json_file)
    except e: #json.JSONDecodeError:
        print(f"Failed to decode JSON from the file '{json_file_path}'.")
        return False

    return jData


def is_valid_pdf_file(dir_path, jData):
    pdf_file_path_lst = os.path.join(dir_path, jData[consts['img_key_in_jData']])
    for pdf_path in pdf_file_path_lst:
        if not is_valid_file_type(pdf_path, [consts['pdf_ext']]):
            return False
    return True


def is_valid_file_type(file_path, valid_extensions):
    if not os.path.isfile(file_path):  # Use os.path.exists() for any file or directory.
        return False
        
    if not os.access(file_path, os.R_OK):
        return False
        
    _, ext = os.path.splitext(file_path)
    if ext.lower() not in valid_extensions:
        return False
        
    return True


def generate_and_save_notes_image(audio_dir_path):
    # Path to the JSON file
    json_file_path = os.path.join(audio_dir_path, consts['json_data_file_name'])
    # Open the JSON file and use it to find & load the pdf file, convert it to img and save it:
    with open(json_file_path, 'r+') as json_file:
        j_data = json.load(json_file)

        pdf_path = os.path.join(audio_dir_path, j_data[consts["pdf_key_in_jData"]])
        # Check if a valid file (move it into is_valid_audio_dir()!):
        if not is_valid_file_type(pdf_path, [consts['pdf_ext']]):
            return consts["invalid_audio_dir"]

        try:
            image_file_lst = create_image(pdf_path)
            image_path_lst = save_image_update_j_data(image_file_lst, json_file, j_data)
        except Exception as e:
            print(e)
            return consts["image_generation_failed"]

        print(image_path_lst)
        return consts["convertion_success"]


def create_image(self, pdf_path):
    images = convert_from_path(pdf_path)
    return images


def save_image_update_j_data(image_file_lst, json_file, j_data):
    if len(image_file_lst) == 0:
        return

    file_path_lst = []
    jd_img_key = 'img_key_in_jData'
    if consts[jd_img_key] not in j_data:
        j_data[consts[jd_img_key]] = []
    try:
        for img_i in range(len(image_file_lst)):
            file_path = os.path.splitext(j_data['newName'])[0] + '_' + str(img_i) + consts['img_ext']
            image_file_lst[img_i].save(file_path, consts['img_ext'][1:].upper())
            j_data[consts[jd_img_key]].append(os.path.basename(file_path))
            file_path_lst.append(file_path)
        json_file.seek(0)
        json.dump(j_data, json_file)
    except e:
        raise e

    return file_path_lst


def run_generator(audio_dir):
    # Check if the directory is valid:
    if not is_valid_audio_dir(audio_dir):
        return consts["invalid_audio_dir"]

    # Generates and saves the image and exit:
    gen_result_code = generate_and_save_notes_image(audio_dir)
    return gen_result_code


def moc_run(audio_dir):
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
    audio_dir = sys.argv[1]
    #result_code = run_generator(audio_dir)
    result_code = moc_run(audio_dir)
    sys.exit(result_code)