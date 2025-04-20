const express = require('express');
const router = express.Router();
const s3Controller = require('./controllers/s3Controller');
const ipfsController = require('./controllers/ipfsController');
const bridgeController = require('./controllers/bridgeController');

// S3 Routes
router.get('/s3/objects', s3Controller.listObjects);
router.get('/s3/object/:key', s3Controller.getObject);

// IPFS Routes
router.get('/ipfs/file/:cid', ipfsController.getFileByCid);

// Bridge Routes
router.post('/bridge/s3-to-ipfs', bridgeController.uploadFromS3ToIpfs);
router.post('/bridge/ipfs-to-s3', bridgeController.downloadFromIpfsToS3);
router.get('/bridge/mappings', bridgeController.getMappings);
router.get('/bridge/mapping/:id', bridgeController.getMappingById);

module.exports = router; 