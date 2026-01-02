# S3 Manager API Integration Guide

This guide details how to integrate your frontend with the S3 Manager Backend and how to use the generated credentials in your external Node.js applications.

## 1. Management Frontend Integration (Creating Clients)

To create a new "Sub-Bucket" (Client Folder) and get its credentials:

### Create Client Endpoint

**POST** `/api/clients`

**Headers:**

```
Content-Type: application/json
Authorization: Bearer <ADMIN_TOKEN>
```

_(Note: If you haven't implemented Auth middleware yet, Authorization might be optional, but recommended)_

**Payload:**

```json
{
  "name": "Client Alpha",
  "storage_limit_bytes": 1073741824 // 1 GB (Optional, default is 1GB)
}
```

**Success Response (201 Created):**
**IMPORTANT:** This is the **ONLY** time the `secret_access_key` will be shown. Save it immediately!

```json
{
  "status": "success",
  "data": {
    "client": {
      "id": "uuid-string...",
      "name": "Client Alpha",
      "s3_prefix": "client_alpha/", // <--- Derived from Client Name
      "access_key_id": "AKIA...",
      "secret_access_key": "wJalr...", // <--- SAVE THIS!
      "storage_limit_bytes": "1073741824",
      "status": "active"
    },
    "config": {
      "region": "us-east-1",
      "bucket": "main-bucket-digitech"
    }
  }
}
```

---

## 4. Direct File Upload via API (Optional)

If you prefer to proxy uploads through this backend instead of direct S3 upload:

**POST** `/api/clients/:id/storage/upload`

**Headers:**

```
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: multipart/form-data
```

**Body:**

- `file`: The file binary (form-data)

**Response:**

```json
{
  "status": "success",
  "data": {
    "url": "https://main-bucket-digitech.s3.amazonaws.com/client_alpha/my-image.png",
    "key": "client_alpha/my-image.png"
  }
}
```

---

## 2. Managing Lost Credentials

If you lose the Secret Key for a client, you cannot retrieve it. You must **rotate** it, which invalidates the old one.

### Rotate Keys Endpoint

**POST** `/api/clients/:id/rotate-key`

**Response:**

```json
{
  "status": "success",
  "data": {
    "client": {
      "id": "...",
      "access_key_id": "NEW_ACCESS_KEY...",
      "secret_access_key": "NEW_SECRET_KEY..." // <--- New Secret
    }
  }
}
```

---

## 3. Using Credentials in External Node.js Backend

Here is how you use the credentials obtained above to connect to the specific "Sub-Bucket".

### Installation

```bash
npm install @aws-sdk/client-s3
```

### Connection Code Example

```javascript
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";

// 1. Setup the Client with the specific credentials you got from the API
const clientS3 = new S3Client({
  region: "us-east-1", // Use the region from the 'config' response
  credentials: {
    accessKeyId: "CLIENT_ACCESS_KEY_HERE", // From Create Client response
    secretAccessKey: "CLIENT_SECRET_KEY_HERE", // From Create Client response
  },
});

const BUCKET_NAME = "main-bucket-digitech";
const CLIENT_PREFIX = "client_uuid.../"; // From 's3_prefix' in response

// --- EXAMPLE 1: Uploading a File ---
async function uploadFile(fileName, fileBuffer, mimeType) {
  // IMPORTANT: You MUST prepend the CLIENT_PREFIX to the Key!
  // If you try to upload to just "my-image.png", it will fail (Access Denied).
  const key = `${CLIENT_PREFIX}${fileName}`;

  await clientS3.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
      ACL: "public-read", // Optional: Makes the file public immediately
    })
  );

  // The public link format:
  return `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`;
}

// --- EXAMPLE 2: Listing Files ---
async function listFiles() {
  const command = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: CLIENT_PREFIX, // You must specify this to see your files
  });

  const response = await clientS3.send(command);

  // Filter out the folder itself
  return response.Contents?.filter((item) => item.Key !== CLIENT_PREFIX) || [];
}

// Usage
// uploadFile("profile.jpg", bufferData, "image/jpeg").then(url => console.log(url));
```

### Key Considerations for "Sub-Bucket" Usage:

1. **The Prefix Rule**: The credentials are strictly locked to the `s3_prefix`. You cannot read or write anything outside `client_ID/`.

---

## 5. Storage Management APIs

These endpoints are for the management dashboard to display usage stats and manage files/limits.

### Get Storage Usage (File Count included)

**GET** `/api/clients/:id/storage/usage`

**Response:**

```json
{
  "status": "success",
  "data": {
    "totalSize": 1048576,
    "totalFiles": 12, // <--- New: Total number of files
    "fileTypeDistribution": [
      { "name": "images", "value": 1024000 },
      { "name": "others", "value": 24576 }
    ],
    "extensionDistribution": [
      { "name": ".png", "value": 1024000 },
      { "name": ".txt", "value": 24576 }
    ]
  }
}
```

### Delete File

**DELETE** `/api/clients/:id/storage/object`

**Body:**

```json
{
  "key": "client_alpha/my-image.png"
}
```

**Response:**

```json
{
  "status": "success",
  "message": "Object deleted"
}
```

### Update Storage Limit

Use this to extend or decrease the storage limit for a specific client.

**PATCH** `/api/clients/:id/limit`

**Body:**

```json
{
  "storage_limit_bytes": 2147483648 // New limit in bytes (e.g., 2GB)
}
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "client": {
      "id": "...",
      "name": "Client Alpha",
      "storage_limit_bytes": "2147483648"
      // ... other fields
    }
  }
}
```
