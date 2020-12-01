#### Uploading and saving files 
Amazon Web Services (AWS) is a cloud platform, which provides customers with a wide variety of cloud services. Manabu uses S3 for the uploading of videos. 

If S3 is not an option for you, look at an alternative or change the code where the upload occurs.
```
        const s3 = new aws.S3({
            s3BucketEndpoint: true,
            endpoint: process.env.AWS_S3_ENDPOINT,
            accessKeyId:process.env.AWS_S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
            region: 'symphony'
        });
```        
Keep the original code but use a setting to switch to the alternative.

The below will allow saving to local file storage

```
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './public/docs');
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage: storage });
```


#### Uploading Files to an AWS Bucket

1. Sign up for AWS by creating an account on https://aws.amazon.com. If your organisation already has an account, and you are allowed to use it, then log in with the appropriate credentials.
2. Once you are logged in, search for the S3 service. S3 is a cloud service which stores files.
3. Create a bucket. A bucket is a folder that contains all the files that will be uploaded. Choose a bucket name and choose a region.
4. Navigate to the bucket you just created. Take note of the url: this will be your endpoint.
5. Navigate through your profile, and find your security credentials: access key id and secret access key.
6. Install the following four packages: `multer`, `multer-s3`, `https` and `aws-sdk`:
   `npm install --save aws-sdk multer multer-s3 https`
7. Navigate to the js file where the code for uploading will be placed, i.e. `routes/admin.js`.
8. Import the installed packages:
   `const multer = require('multer');`
   `const aws = require('aws-sdk');`
   `const https = require('https');`
   `const multerS3 = require('multer-s3');`
9. Configure the aws object so that the AWS service API's can be used:
   `aws.config.update({`
     `httpOptions: {`
     `agent: new https.Agent({`
       `rejectUnauthorized: false,`
       `}),`
     `},`
   `});`
10. Create an instance of the Amazon S3 that was created on the AWS website, and fill in the required credentials:
   `const s3 = new aws.S3({`
     `s3BucketEndpoint: true,`
     `endpoint: '',`
     `accessKeyId: '',`
     `secretAccessKey: '',`
     `region: '',`
   `});`
11. Put all the configuration information into a `multerS3` object:
   `const s3Storage = multerS3({`
     `s3,`
     `bucket: 'nameOfYourBucket',`
     `acl: 'public-read',` // this is access control for the uploaded file
     `key: () => {`
       `'nameOfFileThatIsBeingUploaded';`
     `},`
   `});`
12. Tell the `multer` object where to upload the file. This information has been configured into the `multerS3` object already (previous step):
    `const uploadWithMulter = multer({ storage: s3Storage });`
13. Call the single function on `uploadWithMulter` to upload one file. Do this in the appropriate route:
   `router.post('/uploadFile', uploadWithMulter.single('nameOfFile'), function (req, res, next) {`
     `// req.file is the 'nameOfFile' file`
   `})`
14. Multer can be used to upload more than one file at a time. Refer to https://www.npmjs.com/package/multer for more information.
15. (Aside): For security reasons, it is safer to store all AWS credentials in a config file as environment variables.