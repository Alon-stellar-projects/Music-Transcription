/**
 * Author: Alon Haviv, Stellar Intelligence.
 * 
 * A router module that connects incoming requests to their handler control functions.
 */

'use strict';
const express = require('express');
const path = require('path');

var router = express.Router();
const solutionBasePath = path.join(__dirname, '..', '..');
const f_controller = require(path.join(solutionBasePath, 'Music_Transcription_App', 'controllers', 'file_controller_stdio.js'));
const p_controller = require(path.join(solutionBasePath, 'Music_Transcription_App', 'controllers', 'page_controller.js'));


/* GET home page. */
router.get('/', p_controller.get_home_page);

/* Get about page. */
router.get('/about', p_controller.get_about_page);

/* Get an image file by id. */
router.get('/file/img/:id', f_controller.get_image_by_id);

/* Get a pdf file by id. */
router.get('/file/pdf/:id', f_controller.get_pdf_by_id);

/* Get a midi file by id. */
router.get('/file/midi/:id', f_controller.get_midi_by_id);

/* Get a json data object by id. */
router.get('/file/data/:id', f_controller.get_data_by_id);

/* Post an audio file. */
router.post('/file', f_controller.upload_middleware, f_controller.post_audio_and_convert);


module.exports = router;
