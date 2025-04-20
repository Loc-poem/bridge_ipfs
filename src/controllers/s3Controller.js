const AWS = require('aws-sdk');

// Configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const s3 = new AWS.S3();
const BUCKET_NAME = process.env.S3_BUCKET_NAME;

/**
 * List objects in the S3 bucket
 */
exports.listObjects = async (req, res) => {
  try {
    const prefix = req.query.prefix || '';
    const maxKeys = parseInt(req.query.maxKeys) || 1000;
    
    const params = {
      Bucket: BUCKET_NAME,
      Prefix: prefix,
      MaxKeys: maxKeys
    };
    
    const data = await s3.listObjectsV2(params).promise();
    
    res.status(200).json({
      success: true,
      data: data.Contents,
      nextContinuationToken: data.NextContinuationToken
    });
  } catch (error) {
    console.error('Error listing S3 objects:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list objects from S3',
      error: error.message
    });
  }
};

/**
 * Get a specific object from S3 by key
 */
exports.getObject = async (req, res) => {
  try {
    const key = req.params.key;
    
    if (!key) {
      return res.status(400).json({
        success: false,
        message: 'Object key is required'
      });
    }
    
    const params = {
      Bucket: BUCKET_NAME,
      Key: key
    };
    
    // Get the object metadata first
    const headData = await s3.headObject(params).promise();
    
    // Then get the object data
    const data = await s3.getObject(params).promise();
    
    // If response format is requested as stream
    if (req.query.format === 'stream') {
      res.setHeader('Content-Type', headData.ContentType);
      res.setHeader('Content-Length', headData.ContentLength);
      s3.getObject(params).createReadStream().pipe(res);
    } else {
      // Return object data as JSON response
      res.status(200).json({
        success: true,
        data: {
          body: data.Body.toString('base64'), // Convert to base64 for JSON transport
          contentType: headData.ContentType,
          contentLength: headData.ContentLength,
          metadata: headData.Metadata,
          lastModified: headData.LastModified
        }
      });
    }
  } catch (error) {
    console.error('Error getting S3 object:', error);
    
    if (error.code === 'NoSuchKey') {
      return res.status(404).json({
        success: false,
        message: 'Object not found in S3 bucket',
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to get object from S3',
      error: error.message
    });
  }
}; 