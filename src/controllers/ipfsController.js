const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { PinataSDK } = require('pinata');

// Initialize Pinata SDK with JWT token and gateway
const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT,
  pinataGateway: process.env.PINATA_GATEWAY_URL || 'gateway.pinata.cloud',
});

/**
 * Upload file to IPFS via Pinata
 * @param {Buffer} fileData - File buffer data
 * @param {String} fileName - Original file name
 * @param {Object} metadata - Additional metadata for the file
 * @returns {Promise<Object>} - IPFS response with CID
 */
exports.uploadToIpfs = async (fileData, fileName, metadata = {}) => {
  try {
    // Create a temporary file
    const tempFilePath = path.join(os.tmpdir(), fileName);
    fs.writeFileSync(tempFilePath, fileData);
    
    // Create a File object from the file path
    const fileStream = fs.createReadStream(tempFilePath);
    
    // Upload to IPFS via Pinata
    const upload = await pinata.upload.public.file(fileStream);
    
    // Clean up temporary file
    fs.unlinkSync(tempFilePath);
    
    // Map new Pinata SDK response format to our API format
    return {
      success: true,
      cid: upload.cid,
      ipfsHash: upload.cid, // For backward compatibility
      size: upload.size,
      name: upload.name,
      id: upload.id,
      mimeType: upload.mime_type,
      numberOfFiles: upload.number_of_files,
      createdAt: upload.created_at,
      network: upload.network,
      timestamp: upload.created_at
    };
  } catch (error) {
    console.error('Error uploading to IPFS:', error);
    throw new Error(`Failed to upload to IPFS: ${error.message}`);
  }
};

/**
 * Get file from IPFS by CID
 */
exports.getFileByCid = async (req, res) => {
  try {
    const cid = req.params.cid;
    
    if (!cid) {
      return res.status(400).json({
        success: false,
        message: 'CID is required'
      });
    }
    
    // If format is stream, pipe directly to response
    if (req.query.format === 'stream') {
      // Get gateway URL from Pinata SDK or fallback to environment variable
      const gatewayUrl = pinata.getGatewayURL() || 
                        process.env.PINATA_GATEWAY_URL || 
                        'https://gateway.pinata.cloud';
      
      const response = await axios({
        method: 'get',
        url: `${gatewayUrl}/ipfs/${cid}`,
        responseType: 'stream'
      });
      
      res.setHeader('Content-Type', response.headers['content-type']);
      res.setHeader('Content-Length', response.headers['content-length']);
      
      return response.data.pipe(res);
    }
    
    // Otherwise, return file data in JSON response
    try {
      // Get content from Pinata using the SDK
      const content = await pinata.gateway.getContent(cid);
      
      // Convert to base64 for JSON transport
      const base64Data = Buffer.from(content).toString('base64');
      
      res.status(200).json({
        success: true,
        data: {
          body: base64Data,
          contentType: 'application/octet-stream', // Default content type
          contentLength: content.length
        }
      });
    } catch (pinataError) {
      // Fallback to direct gateway access if SDK method fails
      const gatewayUrl = process.env.PINATA_GATEWAY_URL || 'https://gateway.pinata.cloud';
      const response = await axios.get(`${gatewayUrl}/ipfs/${cid}`, {
        responseType: 'arraybuffer'
      });
      
      // Convert to base64 for JSON transport
      const base64Data = Buffer.from(response.data).toString('base64');
      
      res.status(200).json({
        success: true,
        data: {
          body: base64Data,
          contentType: response.headers['content-type'],
          contentLength: response.headers['content-length']
        }
      });
    }
  } catch (error) {
    console.error('Error getting file from IPFS:', error);
    
    // Handle 404 error
    if (error.response && error.response.status === 404) {
      return res.status(404).json({
        success: false,
        message: 'File not found on IPFS',
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to get file from IPFS',
      error: error.message
    });
  }
}; 