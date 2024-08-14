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
const controller = require(path.join(solutionBasePath, 'Music_Transcription_App', 'controllers', 'controller.js'));


/* GET home page. */
router.get('/', controller.get_home_page);

/* Get about page. */
router.get('/about', controller.get_about_page);

/* Get an image file by id. */
router.get('/file/img/:id', controller.get_image_by_id);

/* Get a pdf file by id. */
router.get('/file/pdf/:id', controller.get_pdf_by_id);

/* Get a json data object by id. */
router.get('/file/data/:id', controller.get_data_by_id);

/* Post an audio file. */
router.post('/file', controller.upload_middleware, controller.post_audio_and_convert);


module.exports = router;
