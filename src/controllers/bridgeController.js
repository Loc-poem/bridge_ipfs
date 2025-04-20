const AWS = require('aws-sdk');
const Mapping = require('../models/Mapping');
const ipfsController = require('./ipfsController');

// Configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const s3 = new AWS.S3();
const BUCKET_NAME = process.env.S3_BUCKET_NAME;

/**
 * Upload a file from S3 to IPFS
 */
exports.uploadFromS3ToIpfs = async (req, res) => {
  try {
    const { s3Key } = req.body;
    
    if (!s3Key) {
      return res.status(400).json({
        success: false,
        message: 'S3 object key is required'
      });
    }
    
    // Check if mapping already exists
    const existingMapping = await Mapping.findOne({ s3Key });
    if (existingMapping) {
      return res.status(200).json({
        success: true,
        message: 'File already uploaded to IPFS',
        data: existingMapping
      });
    }
    
    // Get the object from S3
    const s3Params = {
      Bucket: BUCKET_NAME,
      Key: s3Key
    };
    
    // Get object metadata
    const headData = await s3.headObject(s3Params).promise();
    
    // Get the actual object data
    const s3Data = await s3.getObject(s3Params).promise();
    
    // Extract file name from S3 key
    const fileName = s3Key.split('/').pop();
    
    // Upload to IPFS
    const ipfsResult = await ipfsController.uploadToIpfs(
      s3Data.Body,
      fileName,
      { 
        contentType: headData.ContentType,
        originalSource: `s3://${BUCKET_NAME}/${s3Key}`
      }
    );
    
    // Create a new mapping
    const mapping = new Mapping({
      s3Key,
      ipfsCid: ipfsResult.cid,
      size: ipfsResult.size,
      mimeType: ipfsResult.mimeType || headData.ContentType,
      metadata: {
        s3Metadata: headData.Metadata,
        lastModified: headData.LastModified,
        ipfsMetadata: {
          id: ipfsResult.id,
          name: ipfsResult.name,
          numberOfFiles: ipfsResult.numberOfFiles,
          network: ipfsResult.network,
          createdAt: ipfsResult.createdAt
        }
      }
    });
    
    // Save mapping to database
    await mapping.save();
    
    res.status(200).json({
      success: true,
      message: 'File successfully uploaded from S3 to IPFS',
      data: {
        s3Key,
        ipfsCid: ipfsResult.cid,
        ipfsUrl: `${process.env.PINATA_GATEWAY_URL || 'https://gateway.pinata.cloud'}/ipfs/${ipfsResult.cid}`,
        size: ipfsResult.size,
        name: ipfsResult.name,
        mimeType: ipfsResult.mimeType,
        createdAt: ipfsResult.createdAt
      }
    });
  } catch (error) {
    console.error('Error uploading from S3 to IPFS:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload from S3 to IPFS',
      error: error.message
    });
  }
};

/**
 * Download a file from IPFS to S3
 */
exports.downloadFromIpfsToS3 = async (req, res) => {
  try {
    const { ipfsCid, s3Key } = req.body;
    
    if (!ipfsCid || !s3Key) {
      return res.status(400).json({
        success: false,
        message: 'IPFS CID and S3 Key are required'
      });
    }
    
    // Check if mapping already exists but in reverse (different s3Key)
    const existingMapping = await Mapping.findOne({ ipfsCid });
    if (existingMapping && existingMapping.s3Key !== s3Key) {
      return res.status(409).json({
        success: false,
        message: 'CID already mapped to a different S3 key',
        data: existingMapping
      });
    }
    
    // Download from IPFS via Pinata gateway
    const pinataGatewayUrl = process.env.PINATA_GATEWAY_URL || 'https://gateway.pinata.cloud';
    const ipfsUrl = `${pinataGatewayUrl}/ipfs/${ipfsCid}`;
    
    const axios = require('axios');
    const response = await axios.get(ipfsUrl, {
      responseType: 'arraybuffer'
    });
    
    // Upload to S3
    const s3Params = {
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: response.data,
      ContentType: response.headers['content-type'] || 'application/octet-stream',
      Metadata: {
        ipfsCid,
        ipfsSource: ipfsUrl
      }
    };
    
    const s3Result = await s3.putObject(s3Params).promise();
    
    // Create or update mapping
    let mapping;
    if (existingMapping) {
      existingMapping.s3Key = s3Key;
      existingMapping.size = response.headers['content-length'];
      existingMapping.mimeType = response.headers['content-type'];
      mapping = await existingMapping.save();
    } else {
      mapping = new Mapping({
        s3Key,
        ipfsCid,
        size: response.headers['content-length'],
        mimeType: response.headers['content-type']
      });
      await mapping.save();
    }
    
    res.status(200).json({
      success: true,
      message: 'File successfully downloaded from IPFS to S3',
      data: {
        ipfsCid,
        s3Key,
        s3Url: `https://${BUCKET_NAME}.s3.amazonaws.com/${s3Key}`,
        eTag: s3Result.ETag,
        size: response.headers['content-length']
      }
    });
  } catch (error) {
    console.error('Error downloading from IPFS to S3:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download from IPFS to S3',
      error: error.message
    });
  }
};

/**
 * Get all mappings with pagination
 */
exports.getMappings = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const mappings = await Mapping.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Mapping.countDocuments();
    
    res.status(200).json({
      success: true,
      data: mappings,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error getting mappings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get mappings',
      error: error.message
    });
  }
};

/**
 * Get mapping by ID
 */
exports.getMappingById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const mapping = await Mapping.findById(id);
    
    if (!mapping) {
      return res.status(404).json({
        success: false,
        message: 'Mapping not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: mapping
    });
  } catch (error) {
    console.error('Error getting mapping by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get mapping',
      error: error.message
    });
  }
}; 