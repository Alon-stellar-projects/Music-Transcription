"""
Author: Alon Haviv, Stellar Intelligence.

This file handles conversion of presaved midi files into PDF musical notes-sheet files, and 
save them.

The script expects as arguments the source path to the presaved midi file, a target path for 
the generated PDF file to be saved at, and an optional title for the PDF file's first page.
The script ends with a proper exit code. consts["convertion_success"] for success.
"""

import sys, os, json
import subprocess
import fitz
from datetime import datetime
from utils_py.loggers import ENVS, log, error_log

solutionBasePath =  os.path.normpath(os.path.join(os.path.dirname(__file__), '..'))
with open(os.path.join(solutionBasePath, 'Consts.json'), 'r') as consts_file:
    consts = json.load(consts_file)

script_name = os.path.basename(__file__)  # Will be usefull for logging.

# The signature for the PDF footer:
signature = f'© {datetime.now().strftime("%d %b %Y")} Stellar Intelligence. All Rights Reserved.'

# Path to a program that generates PDF:
musescore_path = os.path.join(solutionBasePath, consts['musescore_path'])


class TextObj:
    """
    The class represents a text object for the PDF document, with the text, fontsize, styles and eact location.
    """
    def __init__(self, text: str = '', fontsize: int = 12, fontname: str = 'helv', 
                    x0: int = 0, y0: int = 0, x1: int = 0, y1: int = 0):
        """
        Generate a new object of TextObj."""
        self.text = text
        self.fontsize = fontsize
        self.fontname = fontname
        self.x0 = x0
        self.y0 = y0
        self.x1 = x1
        self.y1 = y1
        self.widthPxl = fitz.get_text_length(self.text, fontsize=self.fontsize, fontname=self.fontname)
        
    def trancate_width(self, max_width_pxl: int):
        """
        Trancate the text if longer than "max_width_pxl"."""
        if self.widthPxl > max_width_pxl:
            self.text = self.text[: int(len(self.text) * max_width_pxl / self.widthPxl)]
            self.widthPxl = fitz.get_text_length(self.text, fontsize=self.fontsize, fontname=self.fontname)


def create_pdf_from_midi(midi_path, target_path):
    """
    Call the musescore program to generate a PDF base file from the midi file.
    midi_path - Path to the saved midi file.
    target_path - Path for the PDF file to be saved at."""
    subprocess.run([musescore_path, midi_path, "-o", target_path])

def create_title_and_footer(doc: fitz.Document, title: str = None) -> tuple[TextObj]:
    """
    Create a title and a footer objects for the given PDF document "doc". If no title is provided, the 
    default title is the document's base-name.
    The footer is a signature of Stellar Intelligence and copyrights.
    Return 2 TextObj objects: title and footer.
    doc - A fitz (PyMuPDF) document object of a PDF file.
    title - A string for the title. If not provided it'll be the doc's basename."""
    
    # Get page dimensions:
    page_width = doc[0].rect.width
    page_height = doc[0].rect.height
    
    # Initializing the title:
    name = title if title else os.path.basename(os.path.splitext(doc.name)[0])
    title_obj = TextObj(name, 24, "helv", y0=50)  # 50 units from the top
    
    # Initializing the footer:
    footer_obj = TextObj(signature, 10, "helv", y0=(page_height - 30)) # 30 units from the bottom or (812 from the top).
    
    # Trancate the title and footer if their width is longer than the page width:
    max_width = 0.8 * page_width
    title_obj.trancate_width(max_width)
    footer_obj.trancate_width(max_width)
    
    # Centering the positions on the x axis:
    title_obj.x0 = (page_width - title_obj.widthPxl) / 2
    footer_obj.x0 = (page_width - footer_obj.widthPxl) / 2

    return title_obj, footer_obj

def add_text_to_pdf(pdf_path: str, title: str):
    """
    Add a title and a footer for the PDF file in the given "pdf_path" path.
    The title is added to the top of the first page and the footer to the bottom of every page.
    The title is given by the "title" (str) argument. If not provided, the default will be the file's basename.
    """
    doc = fitz.open(pdf_path)
    if len(doc) == 0:
        doc.close()
        return
    
    # Creating the title and footer:
    title, footer = create_title_and_footer(doc, title)
    
    # Updating the doc page by page:
    for i, page in enumerate(doc):
        if i == 0:
            page.insert_text((title.x0, title.y0), title.text, fontsize=title.fontsize, fontname=title.fontname)
        page.insert_text((footer.x0, footer.y0), footer.text, fontsize=footer.fontsize, fontname=footer.fontname)
    
    # Save:
    tmp_pdf_path = os.path.splitext(pdf_path)[0] + '_tmp.pdf'
    doc.save(tmp_pdf_path)
    doc.close()
    os.replace(tmp_pdf_path, pdf_path)

def save_midi_as_pdf(midi_path: str, target_path: str, title: str) -> int:
    """
    Given a path to a midi file "midi_path", convert it to a PDF and save it in "target_path".
    The PDF file will have in its first page the title given in "title" (or just the file's 
    basename if title is empty).
    Return consts["convertion_success"] code upon success, or other error codes upon failure.
    """
    try:
        create_pdf_from_midi(midi_path, target_path)
        add_text_to_pdf(target_path, title)
        log(ENVS.DEVELOPMENT, f'{script_name}: created and titled a PDF file successfully.')
    except Exception as exp:
        error_log(ENVS.ALL, f'{script_name}: Failed to create and title a PDF file. Error:\n{exp}')
        return consts["pdf_generation_failed"]
    return consts["convertion_success"]

def main(argv) -> int:
    """
    The main function. Convert a presaved midi file into a pdf and save it in the given target path.
    argv: [<name>, source_midi_file_path, target_pdf_file_path, (optional) title]
    Return a code that signals success/failure.
    """
    # Check input arguments validity:
    if len(argv) < 3 or not os.path.isfile(argv[1]) or os.path.dirname(argv[1]) != os.path.dirname(argv[2]) or \
        os.path.splitext(argv[1])[-1] != consts["midi_ext"] or os.path.splitext(argv[2])[-1] != consts["pdf_ext"]:
        return consts['pdf_generation_failed_bad_input']

    # Extract arguments:
    midi_path = argv[1]
    pdf_path = argv[2]
    title = str(argv[3]) if len(argv) >= 4 else None

    # Run the convertion and return the result code:
    res_code = save_midi_as_pdf(midi_path, pdf_path, title)
    return res_code


if __name__ == "__main__":
    """Usage: python convert_to_pdf.py path/to/source_file.mid path/to/target_file.pdf title(optional)"""
    code = main(sys.argv)
    sys.exit(code)