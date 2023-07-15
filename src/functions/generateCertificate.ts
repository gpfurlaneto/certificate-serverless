import { APIGatewayProxyHandler } from 'aws-lambda';
import { S3 } from 'aws-sdk';
import chromiun from 'chrome-aws-lambda';
import daysjs from 'dayjs';
import { readFileSync } from 'fs';
import { compile } from 'handlebars';
import { join } from 'path';

import { document } from '../utils/dynamodbClient';

interface ICreateCertificate {
  id: string;
  name: string;
  grade: string;
}

interface ITemplate {
  id: string
  name: string
  grade: string
  medal: string
  date: string
}

const compileTemplate = (data: ITemplate) => {
  const filePath = join(process.cwd(), "src", "templates", "certificate.hbs")
  const html = readFileSync(filePath, "utf-8")
  return compile(html)(data)
}

export const handler: APIGatewayProxyHandler = async (event) => {
  const { id, name, grade } = JSON.parse(event.body) as ICreateCertificate

  const response = await document.query({
    TableName: "users_certificate",
    KeyConditionExpression: "id = :id",
    ExpressionAttributeValues: {
      ":id": id
    }
  }).promise()

  const userAlreadyExists = response.Items[0]

  if(!userAlreadyExists){
    document.put({
      TableName: "users_certificate",
      Item: {
        id, name, grade, created_at: new Date().getTime()
      }
    }).promise()
  }
 
  const medalPath = join(process.cwd(), "src", "templates", "selo.png")
  const medal  = readFileSync(medalPath, "base64")
  const data: ITemplate = {
    id,
    name,
    grade,
    date: daysjs().format('DD/MM/YYYY'),
    medal
  }

  const content = compileTemplate(data)
  const browser = await chromiun.puppeteer.launch({
    args: chromiun.args,
    defaultViewport: chromiun.defaultViewport,
    executablePath: await chromiun.executablePath,
  })

  const page = await browser.newPage()
  page.setContent(content)

  const pdf = await page.pdf({
    format: 'a4',
    landscape: true,
    printBackground: true,
    preferCSSPageSize: true,
    path: process.env.IS_OFFLINE ? "./certificate.pdf" : null
  })
  
  if(!process.env.IS_OFFLINE){
    const s3 = new S3()
    await s3.putObject({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: `${id}.pdf`,
      ACL: "public-read",
      Body: pdf,
      ContentType: "application/pdf"
    }).promise()
  } 

  return {
    statusCode: 201,
    body: JSON.stringify({
      message: "Certified generated succefully",
      url: `http://${process.env.AWS_S3_BUCKET}.s3.amazonaws.com/${id}.pdf`
    })
  }
}