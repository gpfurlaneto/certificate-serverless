import { DynamoDB } from 'aws-sdk';

const options = {
  region: "localhost",
  endpoint: "http://localhost:8000",
  accessKeyId: 'S3RVER',
  secretAccessKey: 'S3RVER',
}

const isOffline = () => {
  return process.env.IS_OFFLINE
}

export const document = isOffline() ? new DynamoDB.DocumentClient(options) : new DynamoDB.DocumentClient()