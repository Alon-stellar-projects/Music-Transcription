# Music_Transcription_App

This website allows the user to load audio files from the librosa supported types, and generate musical notes, also known as "transcription". The server side uses machine learning models (basic-pitch) to convert the audio data into MIDI, then to PDF and presents a priview image to the user. The user can then download the resulted MIDI and PDF files, within a given time window (before the server deletes the files).The website also presents a gallery with several transcribed pieces of music. The user can download them and get a taste of the application's potential.

**TIP:** You can set the application to permanently keep all the files instead of deleting them, by opening the file: `"Music Transcription/Software/consts.json"` and changing the value of the field `"save_every_file"` to `true`.

#### How To Install and Use The Music Transcription App?

First, you need to make sure that Python and NodeJS is installed on your machine. Then follow the guide here to install and launch the application.


## Quick Summary: Install & Launch
1. Download ALL the files and place them under `"Music Transcription"` folder.

2. Open a terminal (Mac/Linux) or CMD/PowerShell (Windows) and cd to "Music Transcription" folder.

3. Run the setup script:  
  _On Linux/MacOS:_ `> bash ./setup.sh`  
  _On Windows:_ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; `> .\setup.bat`

4. Launch the app:  
  _On Linux/MacOS:_ `> bash ./start_app.sh`  
  _On Windows:_ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; `> .\start_app.bat`

5. Open a browser and type: [http://localhost:3000](http://localhost:3000) (or whatever host and port the application tells you)

Enjoy :)

-----------------------------------------------------------------------------

## Installation

1. Download ALL the files into a designated location. Everything should be under `"Music Transcription"` folder.
  The files also contain the `bin/` parts of the application "MuseScore4" (you can download the full version [here](https://musescore.org/en/download)).

2. Open a terminal (Mac/Linux) or CMD/PowerShell (Windows) and cd to "Music Transcription" folder.

3. Either run the setup script (see bellow), or install the Python and Node.js dependencies manually.

    ##### Setup scripts:

    1. Make sure you're in "Music Transcription" folder.

    2. Launch the script:  
        _On Linux/MacOS run:_ `> bash ./setup.sh`  
        _On Windows run:_ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; `> .\setup.bat`

    _OR:_
    #### Manual setup:

    1. Make sure you're in `"Music Transcription"` folder.

    2. Create a virtual python environment:  
        _On Linux/MacOS run:_  
        `> python3.10 -m venv "Software/Machine_Learning_Python/venv"`  
        _On Windows run:_  
        `> py -3.10 -m venv "Software\Machine_Learning_Python\venv"`

    3. Activate the virtual environment and install the dependencies:  
        _Linux/Mac:_  
        ````  
        > source Software/Machine_Learning_Python/venv/bin/activate  
        > python -m pip install --upgrade pip  
        > python -m pip install -r Software/Machine_Learning_Python/requirements.txt  
        ````
        _Windows:_
        ````
        > Software\Machine_Learning_Python\venv\Scripts\activate  
        > python -m pip install --upgrade pip  
        > python -m pip install -r Software\Machine_Learning_Python\requirements.txt  
        ````

        **Note:**  
        If you get compatibility errors (might happen on Windows OS), see **"Install packages manually"** (bellow), or visit the "requirements.txt" file and install the packages one by one. You might still get some compatibility errors, but you can ignore them.

    4. cd to `"Software\Music_Transcription_App"` and install the Node.js dependencies by running (works for any OS):  
      `> npm install`

    #### Install packages manually:

      If there's no "requirements.txt" file, if it's corrupted, or if you just want to do it manually, you can install the packages by hand:
      
      1. **Make sure you're in the right virtual Python environment**.
      
      2. Install the following packages:
      ```
      > python -m pip install --upgrade pip
      > python -m pip install basic-pitch==0.4.0 --no-cache-dir
      > python -m pip install "onnxruntime-gpu==1.22.0; platform_system == 'Windows'"
      > python -m pip install "tensorflow-gpu==2.10.0; platform_system == 'Linux'"
      > python -m pip install pdf2image==1.17.0
      > python -m pip install PyMuPDF==1.26.4
      ```


## Launching the App

Once the app is installed, there are 2 ways to launch it: Using a script or manually.

#### 1) Launcher Script:

  1. Open a CMD/PowerShell (Windows) or terminal (Mac/Linux) and cd to "Music Transcription" folder.

  2. launch the script:  
     _On Linux/MacOS run:_ `> bash ./start_app.sh`  
     _On Windows run:_ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; `> .\start_app.bat`

  3. Open a browser and type: [http://localhost:3000](http://localhost:3000) (or whatever host and port the application tells you).

#### 2) Manual Launch:

  1. Open a CMD/PowerShell (Windows) or terminal (Mac/Linux).

  2. cd to: `"Music Transcription/Software/Music_Transcription_App"` (On Windows replace / with \ ).

  3. Activate the python environment (located inside:  
     "Music Transcription/Software/Machine_Learning_Python"):  
     _On Linux/macOS run:_  
     `> source ../Machine_Learning_Python/venv/bin/activate`  
     _On Windows run:_  
     `> ..\Machine_Learning_Python\venv\Scripts\activate`

  4. Add the Python root directory into the PYTHONPATH:  
     _On Linux/macOS run:_  
     `> export PYTHONPATH="$PYTHONPATH:$(pwd)/Software/Machine_Learning_Python"`  
     _On Windows PowerShell run:_  
     `> $env:PYTHONPATH="$env:PYTHONPATH;$(pwd)/Software/Machine_Learning_Python"`  
     _On Windows CMD run:_  
     `> set PYTHONPATH=%PYTHONPATH%;%~dp0Software\Machine_Learning_Python`

  5. Set the node.js environment:  
     _On Linux/macOS run:_   
     `> export NODE_ENV=production` (or `development`)  
     Check via: `> echo $NODE_ENV`  

     _On Windows PowerShell run:_  
     `> $env:NODE_ENV="production"` (or `"development"`)  
     Check via: `> $env:NODE_ENV`  

     _On Windows CMD run:_  
     `> set NODE_ENV=production` (or `development`)  
     Check via: `> echo %NODE_ENV%`  

  6. Run the application (located in Music_Transcription_App/):  
     `> node app.js`

  7. Open a browser and type: [http://localhost:3000](http://localhost:3000) (or whatever host and port the application tells you)


Enjoy :)