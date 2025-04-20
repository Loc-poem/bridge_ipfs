# S3-IPFS Bridge Project

This project explores building a bridge between Amazon S3 and IPFS storage systems.

### 1. Analytics the requirements
First: I need to clarify the requirements. let's start with the 2 main our system
- **Amazon S3**: Object storage service with REST API
- **IPFS**: Content-addressed, peer-to-peer distributed storage system. when add a file, we will recivev the Content Identifier(CID) - a unique hash of file which can be compared to a fingerprint. Think of Ipfs like Bittorrent(a protocol, not a platform), anyone can run a node and when node is alive, user can get the file that they want by CID

I have worked with both of these systems (Ipfs when worked in the nft projects - using our private ipfs) before so basically, I understand how its works. So the question is "What is bridge ?". From what I can tell, S3 and IPFS are both object storage systems, but they work in completely different ways. I think the bridge is basically middleware that connects these two storage worlds, letting data flow smoothly between them.

- **Primary Function**: Connect S3 (centralized storage) with IPFS (decentralized network) for two-way data transfer
- **Key Purpose**: Make S3-stored content available on the decentralized web while maintaining content addressability

Based on these points, here is the list features that i think the system needs

#### Bridge Capabilities:
| Feature | Description |
|---------|-------------|
| Read from S3 | Use AWS SDK to access and read objects from an S3 bucket |
| Upload to IPFS | Use IPFS client (HTTP API, JS/Go/CLI) to add those files to IPFS |
| Track CIDs | Store or log the Content IDs (CIDs) returned from IPFS for future reference |
| Sync to S3 from IPFS | Download content from IPFS and store it in S3 (reverse bridge) |
| Metadata mapping | Maintain a map of S3 object keys <-> IPFS CIDs |

The bridge ultimately facilitates:
- Uploading files from S3 to IPFS, making them available on the decentralized web
- Downloading or syncing files from IPFS back to S3, as needed
- Managing metadata, content identifiers (CIDs), and ensuring data integrity

Here is overview diagram about system:

```
+-------------------+        +------------------+        +-------------------+
|                   |        |                  |        |                   |
|   AWS S3 Bucket   |<------>|   Bridge API    |<------>|   IPFS Network    |
|   (Centralized)   |        |   (Node.js)     |        |  (Decentralized)  |
|                   |        |                  |        |                   |
+-------------------+        +------------------+        +-------------------+
                                     ^
                                     |
                                     v
                             +----------------+
                             |                |
                             |   MongoDB      |
                             | (Metadata/CIDs)|
                             |                |
                             +----------------+
                                     ^
                                     |
                                     v
                             +----------------+
                             |                |
                             |   Admin UI     |
                             |  (Optional)    |
                             |                |
                             +----------------+

Data Flow:
1. Files from S3 → Bridge API → IPFS Network (Upload)
2. Content from IPFS → Bridge API → S3 Bucket (Download)
3. Metadata stored and retrieved from MongoDB
```

### 2. Setting Up the Environment
- S3: Create an Aws account and setting up a s3 bucket
- IPFS: I choose private ipfs of pinata service (https://app.pinata.cloud/gateway)
- VPS: Build API, database and UI (if needed)
  - **API**: Will use Node.js server because:
    - Non-blocking I/O model is ideal for handling multiple concurrent file operations
    - Native JSON support simplifies metadata handling between S3 and IPFS
    - Rich ecosystem of libraries for both AWS SDK and IPFS integration
    - Excellent streaming capabilities for handling large files
    - Lightweight and efficient for resource-constrained VPS environments
- Database: MongoDB for storing metadata and CID mappings
  - **MongoDB**:
    - Fast read and write operations for efficient metadata retrieval
    - Flexible schema ideal for diverse metadata structures from both systems
    - Easy scaling as the bridge's data volume grows
    - Query capabilities optimize mapping lookups between S3 paths and IPFS CIDs
    - Seamless JSON integration with Node.js architecture

### 3. Core Functionality Implementation

#### Approach

My approach to building this S3-IPFS bridge focused on creating a middleware layer that seamlessly connects centralized and decentralized storage systems:

1. **Modular Architecture**: Separated concerns into controllers for S3, IPFS, and bridge operations
2. **Robust Data Mapping**: Implemented MongoDB schema to track relationships between S3 objects and IPFS CIDs
3. **API-First Design**: Created RESTful endpoints for all core operations with clear inputs/outputs
4. **Stream Processing**: Utilized Node.js streams for efficient handling of large files
5. **Error Handling**: Implemented comprehensive error management with appropriate HTTP status codes

#### File upload from S3 to IPFS
- **Flow**: S3 object → Bridge API → IPFS Network
- **Input**: S3 object key
- **Output**: IPFS Content ID (CID)

#### Content retrieval from IPFS
- **Flow**: IPFS Network → Bridge API → Client
- **Input**: IPFS CID
- **Output**: File content (JSON or stream)

#### CID mapping and storage
- **Flow**: MongoDB ↔ Bridge API
- **Input**: Query parameters (page, limit)
- **Output**: List of S3-to-IPFS mappings 

#### IPFS to S3 syncing
- **Flow**: IPFS Network → Bridge API → S3 Bucket
- **Input**: IPFS CID and destination S3 key
- **Output**: Success status and S3 URL

#### Project Structure

```
bridge/
├── src/
│   ├── controllers/
│   │   ├── bridgeController.js  # S3-IPFS bridge operations
│   │   ├── ipfsController.js    # IPFS operations
│   │   └── s3Controller.js      # S3 operations
│   ├── models/
│   │   └── Mapping.js           # MongoDB model for mappings
│   ├── routes.js                # API routes
│   └── index.js                 # Entry point
├── .env                         # Environment variables
├── .env.example                 # Example environment file
├── package.json                 # Project metadata and dependencies
└── README.md                    # This file
```



## Getting Started

```bash
# Clone this repository
git clone https://github.com/Loc-poem/bridge_ipfs.git
cd bridge_ipfs

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your AWS credentials and IPFS settings
```

## Resources

- [IPFS Documentation](https://docs.ipfs.tech/)
- [AWS S3 API Reference](https://aws.amazon.com/s3/)
- [AWS SDK for JavaScript](https://aws.amazon.com/sdk-for-javascript/)
- [PINATA SDK for JavaScript](https://docs.pinata.cloud/quickstart)

## Implementation Approach & Considerations

### Challenges

During implementation, I encountered several challenges inherent to bridging these different storage paradigms:

1. **Network Dependencies**: IPFS operations depend on network availability and node connections
2. **Gateway Reliability**: Using Pinata's gateway service introduces a potential single point of failure

### Production Implementation

To deploy this system in production, I would recommend:

1. **Infrastructure**:
   - Deploy on container orchestration (Kubernetes/ECS) for scalability
   - Implement auto-scaling based on queue length and CPU utilization
   - Use managed MongoDB service (Atlas/DocumentDB) with proper indexing

2. **Performance Optimizations**:
   - Implement caching layer for frequently accessed CIDs
   - Add queue system (SQS/RabbitMQ) for large file transfers
   - Set up CDN for IPFS gateway content delivery

3. **Security**:
   - Add JWT authentication for API access
   - Implement rate limiting to prevent abuse
   - Encrypt sensitive data in MongoDB and in transit

4. **Reliability**:
   - Set up multiple IPFS pinning services for redundancy
   - Implement retry mechanisms for failed uploads/downloads
   - Create comprehensive monitoring and alerting

5. **Operational**:
   - Establish automated testing for all core functions
   - Implement CI/CD pipeline for seamless deployments
   - Create detailed logging for troubleshooting and auditing
