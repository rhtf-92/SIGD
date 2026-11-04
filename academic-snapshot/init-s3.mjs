import { createRequire } from 'node:module';

const require = createRequire('/app/package.json');
const { S3Client, HeadBucketCommand, CreateBucketCommand } = require('@aws-sdk/client-s3');
const client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
});
const bucket = process.env.S3_BUCKET;
try {
  await client.send(new HeadBucketCommand({ Bucket: bucket }));
} catch (error) {
  if (error.$metadata?.httpStatusCode !== 404 && error.name !== 'NotFound') throw error;
  await client.send(new CreateBucketCommand({ Bucket: bucket }));
}
console.log('Academic S3 bucket ready.');
