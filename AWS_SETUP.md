# AWS Configuration Guide for S3 Manager

Use this guide to configure your AWS account to work perfectly with the S3 Manager Backend.

## 1. S3 Bucket Settings (`main-bucket-digitech`)

### Step A: Unblock Public Access

1. Go to the **S3 Console** > Select your bucket (`main-bucket-digitech`).
2. Go to the **Permissions** tab.
3. Under **Block public access (bucket settings)**, click **Edit**.
4. **Uncheck** "Block all public access".
5. Click **Save changes** and confirm the result.

### Step B: Bucket Policy (Make Files Public)

To ensure every file uploaded (images, recordings) is automatically accessible via its link without access errors, add this policy.

1. In the **Permissions** tab, scroll to **Bucket policy**.
2. Click **Edit** and paste this JSON:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::main-bucket-digitech/*"
    }
  ]
}
```

### Step C: Cross-Origin Resource Sharing (CORS)

This allows your frontend/browser to upload and view files directly.

1. In the **Permissions** tab, scroll to **Cross-origin resource sharing (CORS)**.
2. Click **Edit** and paste this JSON:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": [
      "ETag",
      "x-amz-server-side-encryption",
      "x-amz-request-id",
      "x-amz-id-2"
    ],
    "MaxAgeSeconds": 3000
  }
]
```

---

## 2. Backend Admin IAM User Policy

The IAM User whose credentials (`AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`) are inside your `.env` file needs permission to create other users and manage the bucket.

1. Go to the **IAM Console** > **Users**.
2. Click on your backend user (e.g., `s3-manager-admin`).
3. Go to **Permissions** > **Add permissions** > **Create inline policy**.
4. Select **JSON** and paste the following:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ManageBucket",
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket",
        "s3:PutBucketCORS",
        "s3:GetBucketCORS",
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:PutObjectAcl"
      ],
      "Resource": [
        "arn:aws:s3:::main-bucket-digitech",
        "arn:aws:s3:::main-bucket-digitech/*"
      ]
    },
    {
      "Sid": "ManageClientUsers",
      "Effect": "Allow",
      "Action": [
        "iam:CreateUser",
        "iam:DeleteUser",
        "iam:CreateAccessKey",
        "iam:DeleteAccessKey",
        "iam:ListAccessKeys",
        "iam:UpdateAccessKey",
        "iam:PutUserPolicy",
        "iam:DeleteUserPolicy",
        "iam:GetUser"
      ],
      "Resource": "arn:aws:iam::*:user/client_*"
    }
  ]
}
```

### Summary of what this does:

- **ManageBucket**: Allows the backend to create folders, upload files if needed, and set CORS.
- **ManageClientUsers**: Allows the backend to automatically create and delete restricted IAM users for each of your clients (users starting with `client_`).
