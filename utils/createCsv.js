const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const csvWriter = createCsvWriter({
  path: '../client-app/phoneNumbers.csv',
  header: [
    {id: 'phoneNumber', title: 'phoneNumber'},
    {id: 'message', title: 'message'},
    {id: 'firstName', title: 'firstName'},
    {id: 'lastName', title: 'lastName'},
  ]
});
const asteriskOutputs = require('../client-app/src/asterisk-outputs.json')
const names = require('./names.json')

const phoneNumber = asteriskOutputs.AsteriskEndpoint.PhoneNumber

function getRandomIntInclusive(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min); //The maximum is inclusive and the minimum is inclusive
  }

const data = []
for(let i=0; i<20; i++){
    randomName = getRandomIntInclusive(1, names.length)
    data[i] = {
        phoneNumber: phoneNumber,
        message: "Hello.  Have a nice day.",
        firstName: names[randomName].firstName,
        lastName: names[randomName].lastName
    };
}  

csvWriter
  .writeRecords(data)
  .then(()=> console.log('The CSV file was written successfully'));