import 'dotenv/config'
import https from 'https';
import stream from 'stream';
import { create } from "ipfs-http-client";
import fs, { link, writeFileSync } from "fs";
import axios from "axios";
import pixels from "image-pixels";
import { MongoClient } from "mongodb";
import web3 from "web3";
import { clonex_contract } from './contract_script.js';

import { DB_URI } from "./constants.js";

const Stream = stream.Transform;


// For connection to IPFS client
const ipfsClient = async () => {
  const ipfs = await create({
    host: "ipfs.infura.io",
    port: 5001,
    protocol: "https"
  });
  return ipfs;
}

// For connection to mongoDB database
const connectDB = async () => {
  try {
    const client = new MongoClient(DB_URI);
    await client.connect();
    console.log('Connected to MongoDb');
    return client;
  } catch (error) {
    console.log(error);
  }
}

// Get generic data from ipfs -> returns array of Uint8Array chunks
const getData = async (hash) => {
  try {
    const node = await ipfsClient();
    const chunks = [];
    for await (const chunk of node.cat(hash)) {
      chunks.push(chunk);
    }
    // writeFileSync('bayc9245.json', Buffer.concat(chunks), {
    //   encoding: 'utf-8'
    // });
    // const info = JSON.parse(Buffer.concat(chunks));
    return chunks;
  } catch (error) {
    console.log(error);
  }
}

// Uses multiple api calls at once using Promise.all()
const getColorDataForNFTCollectionMulti = async (rootIpfsURL, collectionName, numNFT) => {
  try {
    if (!fs.existsSync(`./${collectionName}`)) fs.mkdirSync(`./${collectionName}`);
    let imageArray = [];
    let imageDataArray = [];
    const metadataArray = [];
    let getMetaData = [];
    for(let i=0;i<numNFT;i++) {
      getMetaData.push(getData(`${rootIpfsURL}/${i+1}`));
    }
    getMetaData = await Promise.all(getMetaData);
    for(let i = 0;i < numNFT;i++) {
      metadataArray.push(JSON.parse(Buffer.concat(getMetaData[i])));
      // console.log(metadata);
      imageArray.push(getData(metadataArray[i].image.substring(7)));
      // writeFileSync(`./${collectionName}/${collectionName}${i + 1}.png`, Buffer.concat(imageArray[i]), { encoding: 'utf-8' });
      // imageDataArray.push(extractProminentColors(`./${collectionName}/${collectionName}${i + 1}.png`));
      // console.log(imageData);
      // fs.appendFileSync(`./${collectionName}.json`, JSON.stringify({
      //   ...imageData,
      //   metadata,
      //   cid: metadata.image.substring(7),
      //   collectionName,
      //   index: i + 1,
      // }, null, 2));
    }
    imageArray = await Promise.all(imageArray);
    for (let i=0;i<numNFT;i++) {
      writeFileSync(`./${collectionName}/${collectionName}${i + 1}.png`, Buffer.concat(imageArray[i]), { encoding: 'utf-8' });
    }
    for(let i=0;i<numNFT;i++) {
      imageDataArray.push(extractProminentColors(`./${collectionName}/${collectionName}${i + 1}.png`));
    }
    imageDataArray = await Promise.all(imageDataArray);
    for(let i = 0;i < numNFT;i++) {
      fs.appendFileSync(`./${collectionName}.json`, (i === 0 ? "[" : ",") + JSON.stringify({
        ...imageDataArray[i],
        metadata: metadataArray[i],
        cid: metadataArray[i].image.substring(7),
        collectionName,
        index: i + 1,
        tokenId: i + 1,
      }, null, 2) + (i === numNFT - 1 ? "]" : ""));
    }
  } catch (error) {
    console.log(error);
  }
}

// Normal function to ingest data into mongoDB
const getColorDataForNFTCollection = async (rootIpfsURL, collectionName, startNum, numNFT) => {
  try {
    const mongoClient = await connectDB();
    if (!fs.existsSync(`./${collectionName}`)) fs.mkdirSync(`./${collectionName}`);
    let dbDataArray = [];
    for (let i = startNum;i < numNFT;i++) {
      const metadata = JSON.parse(Buffer.concat(await getData(`${rootIpfsURL}/${i+1}`)));
      // console.log(metadata);
      const image = await getData(metadata.image.substring(7));
      writeFileSync(`./${collectionName}/${collectionName}${i + 1}.png`, Buffer.concat(image), { encoding: 'utf-8' });
      const imageData = await extractProminentColors(`./${collectionName}/${collectionName}${i + 1}.png`);
      // console.log(imageData);
      const dbData = {
        ...imageData,
        metadata: metadata,
        cid: metadata.image.substring(7),
        collectionName,
        index: i + 1,
        tokenId: i + 1,
        created_at: new Date(),
        updated_at: new Date(),
      };
      dbDataArray.push(dbData);
      fs.appendFileSync(`./${collectionName}.json`, (i === 0 ? "[" : ",") + JSON.stringify(dbData, null, 2) + (i === numNFT - 1 ? "]" : ""));
      if ((i + 1) % 10 === 0) {
        console.log(`${i+1} done...`);
        const dbResponse = await mongoClient.db('color-data').collection('nft-color-data').insertMany(dbDataArray);
        if (dbResponse.acknowledged) dbDataArray = [];
        else {
          console.log(`Error occurred in uploading at index: ${i+1}`);
          break;
        }
      }
    }
    mongoClient.close();
  } catch (error) {
    console.log(error);
  }
}

// getColorDataForNFTCollection('bafybeihpjhkeuiq3k6nqa3fkgeigeri7iebtrsuyuey5y6vy36n345xmbi', 'bayc', 0, 10000);

const getColorDataForNFTCollectionHybrid = async (rootIpfsURL, collectionName, startNum, numNFT, step) => {
  try {
    const mongoClient = await connectDB();
    if (!fs.existsSync(`./${collectionName}`)) fs.mkdirSync(`./${collectionName}`);
    let imageArray = [];
    let imageDataArray = [];
    let metadataArray = [];
    let getMetaData = [];
    let linkArray = [];
    let dbDataArray = [];

    let imageDataArrayPre = [];
    let getMetaDataPre = [];
    let linkArrayPre = [];
    for (let j=startNum;j<numNFT;j+=step) {
      if (j+step > numNFT) step = numNFT - j;

      for (let i=0;i<step;i++) {
        linkArrayPre.push(clonex_contract.methods.tokenURI(i+j+1).call());
      }
      linkArray = await Promise.all(linkArrayPre);

      // Get Metadata over here
      for (let i=0;i<step;i++) {
        // Using IPFS
        // getMetaData.push(getData(`${rootIpfsURL}/${i+1}`));

        // Get using axios
        getMetaDataPre.push(axios.get(linkArray[i]));
      }
      getMetaData = await Promise.all(getMetaDataPre);

      // Get each individual image here
      for (let i=0;i<step;i++) {
        // Get Metadata from Buffer
        // metadataArray.push(JSON.parse(Buffer.concat(getMetaData[i])));
        // console.log(metadata);

        // Get image from IPFS
        // imageArray.push(getData(metadataArray[i].image.substring(7)));


        // Get metadata from given URI in contract
        // metadataArray.push(JSON.parse(getMetaData[i].data));
        metadataArray.push(getMetaData[i].data);

        // Get Image from required URL
      //   imageArray.push(axios({
      //     method: 'GET',
      //     url: metadataArray[i].image,
      //     responseType: 'stream',
      //   }));
      }
      // imageArray = await Promise.all(imageArray);
      // for (let i=0;i<step;i++) {
      //   // For IPFS
      //   // writeFileSync(`./${collectionName}/${collectionName}${i + 1}.png`, Buffer.concat(imageArray[i]), { encoding: 'utf-8' });

      //   // For all other calls
      //   // writeFileSync(`./${collectionName}/${collectionName}${i + 1}.png`, Buffer.from(imageArray[i]), { encoding: 'utf-8' });
      //   // writeFileSync(`./${collectionName}/${collectionName}${i + 1}.png`, imageArray[i].toString(), { encoding: 'utf-8' });
      //   imageArray[i].data.pipe(fs.createWriteStream(`./${collectionName}/${collectionName}${i + j + 1}.png`));
      // }
      for (let i=0;i<step;i++) {
        imageDataArrayPre.push(extractProminentColors(`./${collectionName}/${collectionName}${i + j + 1}.png`));
      }
      imageDataArray = await Promise.all(imageDataArrayPre);
      for (let i=0;i<step;i++) {
        dbDataArray.push({
          ...imageDataArray[i],
          metadata: metadataArray[i],
          cid: metadataArray[i].image,
          collectionName,
          index: parseInt(metadataArray[i].name.substring(8)),
          tokenId: i + j + 1,
          created_at: new Date(),
          updated_at: new Date(),
        });
        // fs.appendFileSync(`./${collectionName}.json`, (j === 0 ? "[" : ",") + JSON.stringify(dbDataArray[i], null, 2) + (i + j === numNFT - 1 ? "]" : ""));
      }
      console.log(`${j+step} done...`);
      const dbResponse = await mongoClient.db('color-data').collection('nft-color-data').insertMany(dbDataArray);
      if (!dbResponse.acknowledged) {
        console.log(`Error occurred in uploading at index: ${i+1}`);
        break;
      } else {
        imageArray = [];
        imageDataArray = [];
        getMetaData = [];
        linkArray = [];
        dbDataArray = [];
        metadataArray = [];

        imageDataArrayPre = [];
        getMetaDataPre = [];
        linkArrayPre = [];
      }
    }
    mongoClient.close();
  } catch (error) {
    console.log(error);
  }
}

getColorDataForNFTCollectionHybrid(null, 'clonex', 18900, 19165, 10);

// HELPER function -> extracts color array
const extractProminentColors = async (fileSource) => {
  try {
    const img = await pixels(fileSource);
    let map = {};
    let arr = [];
    let count = 0;
    // console.log(img.data.length);
    for(let i=0;i<img.data.length;i+=4) {
      count++;
      const color = rgbToHex(img.data[i], img.data[i+1], img.data[i+2]);
      if (map[color] === undefined) {
        map[color] = arr.length;
        arr.push({ color, count: 1 });
      } else {
        arr[map[color]].count++;
      }
    }
    map = null;
    let percentSum = 0;
    arr = arr.map((elem) => {
      elem.percent = parseFloat((elem.count / count * 100));
      percentSum+=elem.percent;
      return elem;
    });
    arr = arr.filter((elem) => elem.percent > 0.01);
    const constArr = arr;
    arr = [];
    return {
      colorArray: constArr,
      colorCoverage: percentSum,
      numPixels: img.data.length / 4,
    };
  } catch (error) {
    console.log(error);
  }
}

// Converts conponent to Hex value
const componentToHex = (c) => {
  var hex = c.toString(16);
  return hex.length == 1 ? "0" + hex : hex;
}

// Converts rgba format to Hex value
const rgbToHex = (r, g, b) => {
  return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

const downloadImageFromURL = (url, filename, callback) => {
  https.request(url, function(response) {
    const data = new Stream();
    response.on('data', function(chunk) {
      data.push(chunk);
    });

    response.on('end', function() {
      fs.writeFileSync(filename, data.read());
    });
  }).end();
};

// downloadImageFromURL('https://clonex-assets.rtfkt.com/images/1.png', 'test.png')

// const checkMissingData = async (limit) => {
//   try {
//     console.log('started');
//     const mongoClient = await connectDB();
//     const missing = [];
//     console.log('starting loop');
//     for (let i=1;i<=limit;i++) {
//       const doc = await mongoClient.db('color-data').collection('nft-color-data').find({
//         collectionName: 'clonex',
//         tokenId: i,
//       }).toArray();
//       if (doc.length === 0) {
//         missing.push(i);
//         console.log(i, ' is missing');
//       }
//       console.log(i, ' is done');
//     }
//     console.log(missing);
//   } catch (error) {
//     console.log(error);
//   }
// }

// checkMissingData(19147);

export {
  getData
};